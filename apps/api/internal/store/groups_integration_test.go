package store_test

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestGroupsOnPostgres(t *testing.T) {
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
	svc := community.NewGroupsService(store.NewCommunityStore(pool), nil)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	ada := seedUser(t, owner, "ada@example.com")
	bob := seedUser(t, owner, "bob@example.com")
	exec(`UPDATE profiles SET full_name = 'Ada' WHERE id = $1`, ada)

	var appErr *apperr.Error
	if _, err := svc.CreateGroup(ctx, ada, "ab"); !errors.As(err, &appErr) {
		t.Fatalf("short name: %v", err)
	}
	msg, err := svc.CreateGroup(ctx, ada, "Dawn Patrol")
	code := regexp.MustCompile(`share code (\S+) with`).FindStringSubmatch(msg)
	if err != nil || code == nil {
		t.Fatalf("create = %q, %v", msg, err)
	}
	if _, err := svc.JoinGroup(ctx, bob, "NOPE"); !errors.As(err, &appErr) || appErr.Message != "Invite code not found" {
		t.Fatalf("bad code: %v", err)
	}
	if j, err := svc.JoinGroup(ctx, bob, code[1]); err != nil || j.Message != "Joined the group." {
		t.Fatalf("join = %+v, %v", j, err)
	}
	if j, _ := svc.JoinGroup(ctx, bob, code[1]); j.Status != "info" {
		t.Fatalf("rejoin = %+v", j)
	}

	// Both trained yesterday → once both were members then, a full day: streak 1, +12 XP each.
	yesterday := dates.ToYMD(time.Now().AddDate(0, 0, -1))
	var sport int64
	_ = owner.QueryRow(ctx, `SELECT min(id) FROM sport_types`).Scan(&sport)
	exec(`INSERT INTO logs (user_id, sport_type_id, date, status) VALUES ($1, $3, $4, 'completed'), ($2, $3, $4, 'completed')`, ada, bob, sport, yesterday)
	exec(`INSERT INTO logs (user_id, sport_type_id, date, status) VALUES ($1, $2, CURRENT_DATE, 'completed')`, bob, sport)
	// A group is never paid for a day before it existed (legacy settled yesterday).
	if fresh, err := svc.Groups(ctx, ada); err != nil || fresh[0].StreakCount != 0 || len(fresh[0].RecentDays) != 0 {
		t.Fatalf("new group settled a day before it existed: %+v, %v", fresh, err)
	}
	exec(`UPDATE group_members SET joined_at = now() - interval '1 day'`)
	groups, err := svc.Groups(ctx, ada)
	if err != nil || len(groups) != 1 {
		t.Fatalf("groups = %+v, %v", groups, err)
	}
	g := groups[0]
	if g.StreakCount != 1 || g.BestStreak != 1 || len(g.RecentDays) != 1 || !g.RecentDays[0].AllTrained || len(g.Members) != 2 {
		t.Fatalf("group = %+v", g)
	}
	// Weekly XP is read by id (legacy read user_id and always showed 0).
	for _, m := range g.Members {
		if m.WeeklyXP != 12 {
			t.Errorf("%v weekly xp = %d", m.UserID, m.WeeklyXP)
		}
		if m.TrainedToday != (m.UserID == bob) {
			t.Errorf("%v trained today = %v", m.UserID, m.TrainedToday)
		}
	}
	if again, _ := svc.Groups(ctx, bob); again[0].StreakCount != 1 {
		t.Fatal("re-evaluation paid twice")
	}

	// Nudge: Ada hasn't logged today; Bob has.
	if n, err := svc.Nudge(ctx, ada); err != nil || n == nil || n.GroupName != "Dawn Patrol" || n.StreakCount != 1 {
		t.Fatalf("ada nudge = %+v, %v", n, err)
	}
	if n, _ := svc.Nudge(ctx, bob); n != nil {
		t.Fatalf("bob nudged after logging: %+v", n)
	}

	// Ten members max.
	for i := range 8 {
		id := seedUser(t, owner, fmt.Sprintf("m%d@example.com", i))
		if _, err := svc.JoinGroup(ctx, id, code[1]); err != nil {
			t.Fatal(err)
		}
	}
	late := seedUser(t, owner, "late@example.com")
	if _, err := svc.JoinGroup(ctx, late, code[1]); !errors.As(err, &appErr) || appErr.Message != "This group is full (10 members max)" {
		t.Fatalf("11th member: %v", err)
	}
	if _, err := svc.LeaveGroup(ctx, late, g.ID); !errors.As(err, &appErr) || appErr.Kind != apperr.NotFound {
		t.Fatalf("non-member leave: %v", err)
	}
	if msg, err := svc.LeaveGroup(ctx, bob, g.ID); err != nil || msg != "You left the group." {
		t.Fatalf("leave = %q, %v", msg, err)
	}
}
