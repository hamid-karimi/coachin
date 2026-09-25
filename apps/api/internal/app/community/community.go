// Package community is the social surfaces (feature-flagged off by
// default): weekly leaderboards (global, primary club, followed users) and
// club membership.
package community

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/coaching"
)

// Board is which leaderboard to rank.
type Board string

// Boards.
const (
	Global Board = "global"
	Club   Board = "club"
	Circle Board = "circle"
)

// LeaderboardSize is how many rows a board shows (legacy).
const LeaderboardSize = 50

// Row is one ranked athlete. Weekly is false on the total-XP fallback.
type Row struct {
	ID         uuid.UUID
	FullName   *string
	AvatarURL  *string
	Level      int64
	LeagueTier *string
	XP         int64
}

// Membership is one of the user's clubs.
type Membership struct {
	ClubID     uuid.UUID
	Name       string
	InviteCode string
	Role       string
	IsPrimary  bool
}

// Store is the persistence the use cases need, as the signed-in user.
type Store interface {
	Memberships(ctx context.Context, userID uuid.UUID) ([]Membership, error)
	Following(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)
	ClubMemberIDs(ctx context.Context, userID, clubID uuid.UUID) ([]uuid.UUID, error)
	// WeeklyBoard ranks by this week's XP (all users when ids is nil).
	WeeklyBoard(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, limit int) ([]Row, error)
	// TotalBoard ranks by lifetime XP (all users when ids is nil).
	TotalBoard(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, limit int) ([]Row, error)
	// CreateClub returns the new club's code, or failure text from the SQL function.
	CreateClub(ctx context.Context, userID uuid.UUID, name, description, code string) (failure string, err error)
	JoinClub(ctx context.Context, userID uuid.UUID, code string) (failure string, err error)
	// SetPrimaryClub reports false when the user isn't a member.
	SetPrimaryClub(ctx context.Context, userID, clubID uuid.UUID) (bool, error)
	// LeaveClub reports false when the user isn't a member; a primary club
	// hands primary to another membership.
	LeaveClub(ctx context.Context, userID, clubID uuid.UUID) (bool, error)
}

// Service runs the use cases.
type Service struct{ store Store }

// NewService builds the service.
func NewService(store Store) *Service { return &Service{store: store} }

// Leaderboard is a ranked board.
type Leaderboard struct {
	Board           Board
	PrimaryClubName *string
	// Weekly is false when nobody on the board earned XP this week and the
	// ranking falls back to lifetime XP (legacy).
	Weekly bool
	Rows   []Row
}

// primaryOf is the primary membership, else the first.
func primaryOf(ms []Membership) *Membership {
	for i := range ms {
		if ms[i].IsPrimary {
			return &ms[i]
		}
	}
	if len(ms) > 0 {
		return &ms[0]
	}
	return nil
}

// Leaderboard ranks the global board, the primary club, or the people the
// user follows by this week's XP.
func (s *Service) Leaderboard(ctx context.Context, userID uuid.UUID, board Board) (Leaderboard, error) {
	ms, err := s.store.Memberships(ctx, userID)
	if err != nil {
		return Leaderboard{}, fmt.Errorf("memberships: %w", err)
	}
	out := Leaderboard{Board: board, Weekly: true, Rows: []Row{}}
	primary := primaryOf(ms)
	if primary != nil {
		out.PrimaryClubName = &primary.Name
	}
	ids, scoped, err := s.boardIDs(ctx, userID, board, primary)
	if err != nil || (scoped && len(ids) == 0) {
		return out, err
	}
	rows, err := s.store.WeeklyBoard(ctx, userID, ids, LeaderboardSize)
	if err != nil {
		return Leaderboard{}, fmt.Errorf("weekly board: %w", err)
	}
	for _, r := range rows {
		if r.XP > 0 {
			out.Rows = rows
			return out, nil
		}
	}
	out.Weekly = false
	if out.Rows, err = s.store.TotalBoard(ctx, userID, ids, LeaderboardSize); err != nil {
		return Leaderboard{}, fmt.Errorf("total board: %w", err)
	}
	return out, nil
}

// boardIDs is who a board ranks; scoped boards with nobody in them are empty.
func (s *Service) boardIDs(ctx context.Context, userID uuid.UUID, board Board, primary *Membership) ([]uuid.UUID, bool, error) {
	switch board {
	case Circle:
		ids, err := s.store.Following(ctx, userID)
		return ids, true, err
	case Club:
		if primary == nil {
			return nil, true, nil
		}
		ids, err := s.store.ClubMemberIDs(ctx, userID, primary.ClubID)
		return ids, true, err
	default:
		return nil, false, nil
	}
}

// Clubs lists the user's memberships.
func (s *Service) Clubs(ctx context.Context, userID uuid.UUID) ([]Membership, error) {
	return s.store.Memberships(ctx, userID)
}

// Limits (the description cap is new).
const (
	minClubName    = 3
	maxClubName    = 80
	maxDescription = 500
	codeAttempts   = 5
)

func clubCode() (string, error) {
	out := make([]byte, 6)
	limit := big.NewInt(int64(len(coaching.InviteAlphabet)))
	for i := range out {
		k, err := rand.Int(rand.Reader, limit)
		if err != nil {
			return "", err
		}
		out[i] = coaching.InviteAlphabet[k.Int64()]
	}
	return "CLUB-" + string(out), nil
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// CreateClub makes a club owned by the user (primary if they have none),
// retrying on the rare invite-code clash.
func (s *Service) CreateClub(ctx context.Context, userID uuid.UUID, name, description string) (string, error) {
	name = truncate(strings.TrimSpace(name), maxClubName)
	if name == "" {
		return "", apperr.New(apperr.Invalid, "Please enter a club name.")
	}
	if utf8.RuneCountInString(name) < minClubName {
		return "", apperr.New(apperr.Invalid, "Club name must be at least 3 characters.")
	}
	description = truncate(strings.TrimSpace(description), maxDescription)
	for range codeAttempts {
		code, err := clubCode()
		if err != nil {
			return "", err
		}
		failure, err := s.store.CreateClub(ctx, userID, name, description, code)
		if err != nil {
			return "", fmt.Errorf("create club: %w", err)
		}
		if strings.Contains(failure, "Invite code already exists") {
			continue
		}
		if failure != "" {
			return "", apperr.New(apperr.Invalid, failure)
		}
		return "Club created. Invite code: " + code, nil
	}
	return "", apperr.New(apperr.Unavailable, "Failed to generate a unique club invite code.")
}

// JoinClub joins by invite code (primary if the user has none).
func (s *Service) JoinClub(ctx context.Context, userID uuid.UUID, rawCode string) (string, error) {
	code := coaching.NormalizeCode(rawCode)
	if code == "" {
		return "", apperr.New(apperr.Invalid, "Please enter a club invite code.")
	}
	failure, err := s.store.JoinClub(ctx, userID, code)
	if err != nil {
		return "", fmt.Errorf("join club: %w", err)
	}
	if failure != "" {
		return "", apperr.New(apperr.Invalid, failure)
	}
	return "You joined the club successfully.", nil
}

var notMember = apperr.New(apperr.NotFound, "You are not a member of this club.")

// SetPrimaryClub makes one of the user's clubs their primary (My Club board).
func (s *Service) SetPrimaryClub(ctx context.Context, userID, clubID uuid.UUID) (string, error) {
	ok, err := s.store.SetPrimaryClub(ctx, userID, clubID)
	if err != nil {
		return "", fmt.Errorf("set primary club: %w", err)
	}
	if !ok {
		return "", notMember
	}
	return "Your primary club was updated.", nil
}

// LeaveClub removes the membership.
func (s *Service) LeaveClub(ctx context.Context, userID, clubID uuid.UUID) (string, error) {
	ok, err := s.store.LeaveClub(ctx, userID, clubID)
	if err != nil {
		return "", fmt.Errorf("leave club: %w", err)
	}
	if !ok {
		return "", notMember
	}
	return "You left the club.", nil
}
