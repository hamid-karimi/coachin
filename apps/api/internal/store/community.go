package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	appcommunity "github.com/hamid-karimi/coachin/apps/api/internal/app/community"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// CommunityStore implements community.Store on the coachin_app pool.
type CommunityStore struct {
	*RoutineStore
}

var _ appcommunity.Store = (*CommunityStore)(nil)

// NewCommunityStore wraps a pool connected as coachin_app.
func NewCommunityStore(pool *pgxpool.Pool) *CommunityStore {
	return &CommunityStore{RoutineStore: NewRoutineStore(pool)}
}

// Memberships lists the user's clubs (only these clubs' invite codes are read).
func (s *CommunityStore) Memberships(ctx context.Context, userID uuid.UUID) ([]appcommunity.Membership, error) {
	var rows []queries.ListClubMembershipsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListClubMemberships(ctx, userID)
		return err
	})
	out := make([]appcommunity.Membership, len(rows))
	for i, r := range rows {
		out[i] = appcommunity.Membership{ClubID: r.ClubID, Name: r.Name, InviteCode: r.InviteCode, Role: r.Role, IsPrimary: r.IsPrimary}
	}
	return out, err
}

// Following lists who the user follows.
func (s *CommunityStore) Following(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var rows []*uuid.UUID
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListFollowing(ctx, &userID)
		return err
	})
	out := []uuid.UUID{}
	for _, id := range rows {
		if id != nil {
			out = append(out, *id)
		}
	}
	return out, err
}

// ClubMemberIDs lists a club's members (visible to members only, by RLS).
func (s *CommunityStore) ClubMemberIDs(ctx context.Context, userID, clubID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		ids, err = q.ListClubMemberIDs(ctx, clubID)
		return err
	})
	return ids, err
}

// WeeklyBoard ranks by this week's XP through get_weekly_leaderboard (sqlc
// can't type the table function).
func (s *CommunityStore) WeeklyBoard(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, limit int) ([]appcommunity.Row, error) {
	out := []appcommunity.Row{}
	err := WithUser(ctx, s.pool, userID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, full_name, avatar_url, COALESCE(level, 1), league_tier, COALESCE(weekly_xp, 0)
			FROM public.get_weekly_leaderboard($1::uuid[], $2)`, ids, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r appcommunity.Row
			var level int32
			if err := rows.Scan(&r.ID, &r.FullName, &r.AvatarURL, &level, &r.LeagueTier, &r.XP); err != nil {
				return err
			}
			r.Level = int64(level)
			out = append(out, r)
		}
		return rows.Err()
	})
	return out, err
}

// TotalBoard ranks by lifetime XP.
func (s *CommunityStore) TotalBoard(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, limit int) ([]appcommunity.Row, error) {
	var rows []queries.TotalXPBoardRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.TotalXPBoard(ctx, queries.TotalXPBoardParams{Ids: ids, MaxRows: int32(limit)}) // #nosec G115 -- small constant
		return err
	})
	out := make([]appcommunity.Row, len(rows))
	for i, r := range rows {
		out[i] = appcommunity.Row{ID: r.ID, FullName: r.FullName, AvatarURL: r.AvatarUrl, Level: r.Level, LeagueTier: r.LeagueTier, XP: r.Xp}
	}
	return out, err
}

// clubResult is the club functions' answer.
type clubResult struct {
	Error string `json:"error"`
}

func (s *CommunityStore) clubCall(ctx context.Context, userID uuid.UUID, call func(q *queries.Queries) (string, error)) (string, error) {
	var result clubResult
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		raw, err := call(q)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(raw), &result)
	})
	return result.Error, err
}

// CreateClub runs create_club_with_owner.
func (s *CommunityStore) CreateClub(ctx context.Context, userID uuid.UUID, name, description, code string) (string, error) {
	return s.clubCall(ctx, userID, func(q *queries.Queries) (string, error) {
		return q.CreateClubWithOwner(ctx, queries.CreateClubWithOwnerParams{Name: name, Description: description, Code: code})
	})
}

// JoinClub runs join_club_via_invite_code.
func (s *CommunityStore) JoinClub(ctx context.Context, userID uuid.UUID, code string) (string, error) {
	return s.clubCall(ctx, userID, func(q *queries.Queries) (string, error) { return q.JoinClubByCode(ctx, code) })
}

// SetPrimaryClub moves the primary flag in one transaction.
func (s *CommunityStore) SetPrimaryClub(ctx context.Context, userID, clubID uuid.UUID) (bool, error) {
	member := false
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		var err error
		if member, err = q.IsClubMember(ctx, queries.IsClubMemberParams{ClubID: clubID, UserID: userID}); err != nil || !member {
			return err
		}
		if err := q.ClearPrimaryClub(ctx, userID); err != nil {
			return fmt.Errorf("clear primary: %w", err)
		}
		return q.MarkPrimaryClub(ctx, queries.MarkPrimaryClubParams{UserID: userID, ClubID: clubID})
	})
	return member, err
}

// LeaveClub deletes the membership and, if it was primary, promotes the
// oldest remaining one — one transaction.
func (s *CommunityStore) LeaveClub(ctx context.Context, userID, clubID uuid.UUID) (bool, error) {
	left := false
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		wasPrimary, err := q.DeleteClubMembership(ctx, queries.DeleteClubMembershipParams{UserID: userID, ClubID: clubID})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		left = true
		if wasPrimary {
			return q.PromoteNextPrimaryClub(ctx, userID)
		}
		return nil
	})
	return left, err
}
