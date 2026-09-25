package store_test

import (
	"context"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/photos"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestPhotosOnPostgres(t *testing.T) {
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
	st := store.NewPhotoStore(pool)
	ada := seedUser(t, owner, "ada@example.com")
	bob := seedUser(t, owner, "bob@example.com")

	// Eight concurrent inserts against a cap of 5: exactly 5 land.
	var wg sync.WaitGroup
	for i := range 8 {
		wg.Go(func() {
			if _, err := st.InsertPhoto(ctx, ada, "ada/"+string(rune('a'+i))+".jpg", photos.BodyPhoto, 5); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if ok, _ := st.InsertPhoto(ctx, ada, "ada/p.jpg", photos.Progress, 24); !ok {
		t.Fatal("progress insert refused")
	}
	counts, err := st.CountPhotos(ctx, ada)
	if err != nil || counts[photos.BodyPhoto] != 5 || counts[photos.Progress] != 1 {
		t.Fatalf("counts = %v, %v", counts, err)
	}

	list, _ := st.Photos(ctx, ada)
	if len(list) != 6 || list[0].Kind != photos.Progress {
		t.Fatalf("list = %+v", list)
	}
	id := list[0].ID
	if _, ok, _ := st.PhotoPath(ctx, bob, id); ok {
		t.Fatal("bob can read ada's photo")
	}
	if _, ok, _ := st.DeletePhoto(ctx, bob, id); ok {
		t.Fatal("bob deleted ada's photo")
	}
	if path, ok, err := st.PhotoPath(ctx, ada, id); !ok || err != nil || path != "ada/p.jpg" {
		t.Fatalf("path = %q %v %v", path, ok, err)
	}
	if path, ok, err := st.DeletePhoto(ctx, ada, id); !ok || err != nil || path != "ada/p.jpg" {
		t.Fatalf("delete = %q %v %v", path, ok, err)
	}
	if _, ok, _ := st.PhotoPath(ctx, ada, id); ok {
		t.Fatal("deleted photo still readable")
	}
}
