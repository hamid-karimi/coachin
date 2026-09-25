package store_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/community"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestCircleOnPostgres(t *testing.T) {
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
	svc := community.NewCircleService(store.NewCommunityStore(pool))
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	me := seedUser(t, owner, "me@example.com")
	grace := seedUser(t, owner, "grace.hopper@navy.example")
	exec(`UPDATE profiles SET full_name = 'Grace Hopper', xp = 900 WHERE id = $1`, grace)
	odd := seedUser(t, owner, "odd@example.com")
	exec(`UPDATE profiles SET full_name = '100% Effort', xp = 10 WHERE id = $1`, odd)
	for i := range 11 {
		id := seedUser(t, owner, fmt.Sprintf("runner%d@example.com", i))
		exec(`UPDATE profiles SET full_name = $2, xp = $3 WHERE id = $1`, id, fmt.Sprintf("Runner %02d", i), 100+i)
	}

	names := func(p community.PeoplePage) []string {
		out := []string{}
		for _, person := range p.People {
			out = append(out, *person.FullName)
		}
		return out
	}
	page, _ := svc.People(ctx, me, "", 1)
	if len(page.People) != 10 || !page.HasNext || *page.People[0].FullName != "Grace Hopper" {
		t.Fatalf("first page = %v", names(page))
	}
	for _, p := range page.People {
		if p.ID == me {
			t.Fatal("search listed the caller")
		}
	}
	if page, _ := svc.People(ctx, me, "", 2); len(page.People) != 3 || page.HasNext {
		t.Fatalf("second page = %v", names(page))
	}
	if page, _ := svc.People(ctx, me, "runner 1", 1); len(page.People) != 1 || *page.People[0].FullName != "Runner 10" {
		t.Fatalf("name search = %v", names(page))
	}
	if page, _ := svc.People(ctx, me, "0%", 1); len(page.People) != 1 || *page.People[0].FullName != "100% Effort" {
		t.Fatalf("literal %% = %v", names(page))
	}
	if page, _ := svc.People(ctx, me, "navy.example", 1); len(page.People) != 0 {
		t.Fatalf("partial email leaked users: %v", names(page))
	}
	if page, _ := svc.People(ctx, me, "GRACE.HOPPER@navy.example", 1); len(page.People) != 1 {
		t.Fatalf("exact email = %v", names(page))
	}

	// Follow / unfollow.
	if msg, err := svc.Follow(ctx, me, grace); err != nil || msg != "User followed." {
		t.Fatalf("follow = %q, %v", msg, err)
	}
	var appErr *apperr.Error
	for id, want := range map[uuid.UUID]apperr.Kind{grace: apperr.Conflict, me: apperr.Invalid, uuid.New(): apperr.NotFound} {
		if _, err := svc.Follow(ctx, me, id); !errors.As(err, &appErr) || appErr.Kind != want {
			t.Fatalf("follow %v: %v", id, err)
		}
	}
	if page, _ := svc.People(ctx, me, "grace", 1); !page.People[0].Following {
		t.Fatal("following flag missing")
	}
	circle, err := svc.Circle(ctx, me)
	if err != nil || len(circle.Following) != 1 || circle.Following[0].ID != grace || len(circle.Coaches) != 0 {
		t.Fatalf("circle = %+v, %v", circle, err)
	}
	if _, err := svc.Unfollow(ctx, me, grace); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Unfollow(ctx, me, grace); !errors.As(err, &appErr) || appErr.Kind != apperr.NotFound {
		t.Fatalf("second unfollow: %v", err)
	}

	// My coaches.
	exec(`INSERT INTO coaching_relationships (coach_id, student_id, sport_type_id) VALUES ($1, $2, (SELECT min(id) FROM sport_types))`, grace, me)
	circle, _ = svc.Circle(ctx, me)
	if len(circle.Coaches) != 1 || circle.Coaches[0].ID != grace || circle.Coaches[0].SportName == nil {
		t.Fatalf("coaches = %+v", circle.Coaches)
	}
}
