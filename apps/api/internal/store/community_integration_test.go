package store_test

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestCommunityOnPostgres(t *testing.T) {
	urls := migratedDB(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	pool, err := store.Open(ctx, urls.App)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	svc := community.NewService(store.NewCommunityStore(pool))
	ada := seedUser(t, owner, "ada@example.com")
	bob := seedUser(t, owner, "bob@example.com")
	cy := seedUser(t, owner, "cy@example.com")
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`UPDATE profiles SET full_name = 'Ada', xp = 900 WHERE id = $1`, ada)
	exec(`UPDATE profiles SET xp = 300 WHERE id = $1`, bob)
	exec(`UPDATE profiles SET xp = 5000 WHERE id = $1`, cy)

	// Nobody earned XP this week → lifetime-XP fallback.
	board, err := svc.Leaderboard(ctx, ada, community.Global)
	if err != nil || board.Weekly || board.Rows[0].ID != cy {
		t.Fatalf("global fallback = %+v, %v", board, err)
	}

	// Clubs: create (primary), join by code (not primary), set primary, leave.
	msg, err := svc.CreateClub(ctx, ada, "  Night Runners  ", "Tue/Thu")
	code := regexp.MustCompile(`CLUB-[A-Z0-9]{6}`).FindString(msg)
	if err != nil || code == "" {
		t.Fatalf("create = %q, %v", msg, err)
	}
	var appErr *apperr.Error
	if _, err := svc.CreateClub(ctx, ada, "ab", ""); !errors.As(err, &appErr) || appErr.Message != "Club name must be at least 3 characters." {
		t.Fatalf("short name: %v", err)
	}
	if _, err := svc.JoinClub(ctx, bob, "club-nope"); !errors.As(err, &appErr) || appErr.Message != "Invalid club invite code" {
		t.Fatalf("bad code: %v", err)
	}
	if msg, err := svc.JoinClub(ctx, bob, " "+code+" "); err != nil || msg != "You joined the club successfully." {
		t.Fatalf("join = %q, %v", msg, err)
	}
	_, _ = svc.CreateClub(ctx, bob, "Bob's Gym", "")
	clubs, _ := svc.Clubs(ctx, bob)
	if len(clubs) != 2 || !clubs[0].IsPrimary || clubs[1].IsPrimary || clubs[1].Role != "owner" {
		t.Fatalf("bob's clubs = %+v", clubs)
	}
	if _, err := svc.SetPrimaryClub(ctx, bob, clubs[1].ClubID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetPrimaryClub(ctx, cy, clubs[1].ClubID); !errors.As(err, &appErr) || appErr.Kind != apperr.NotFound {
		t.Fatalf("non-member primary: %v", err)
	}

	// Weekly XP on the club board (Ada + Bob in Night Runners).
	exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 60, 'a'), ($2, 120, 'b'), ($3, 10, 'c')`, ada, bob, cy)
	board, err = svc.Leaderboard(ctx, ada, community.Club)
	if err != nil || !board.Weekly || len(board.Rows) != 2 || board.Rows[0].ID != bob || *board.PrimaryClubName != "Night Runners" {
		t.Fatalf("club board = %+v, %v", board, err)
	}
	// Circle: nobody followed → empty; follow Cy → Cy only.
	if board, _ := svc.Leaderboard(ctx, ada, community.Circle); len(board.Rows) != 0 {
		t.Fatalf("empty circle = %+v", board)
	}
	exec(`INSERT INTO social_graph (follower_id, following_id) VALUES ($1, $2)`, ada, cy)
	if board, _ := svc.Leaderboard(ctx, ada, community.Circle); len(board.Rows) != 1 || board.Rows[0].ID != cy || board.Rows[0].XP != 10 {
		t.Fatalf("circle = %+v", board)
	}

	// Leaving the primary club promotes the other one.
	if _, err := svc.LeaveClub(ctx, bob, clubs[1].ClubID); err != nil {
		t.Fatal(err)
	}
	clubs, _ = svc.Clubs(ctx, bob)
	if len(clubs) != 1 || !clubs[0].IsPrimary {
		t.Fatalf("after leaving = %+v", clubs)
	}
	if _, err := svc.LeaveClub(ctx, cy, clubs[0].ClubID); !errors.As(err, &appErr) {
		t.Fatalf("non-member leave: %v", err)
	}
}
