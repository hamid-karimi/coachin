package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/photos"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// PhotoStore implements photos.Store on the coachin_app pool.
type PhotoStore struct {
	*RoutineStore
}

var _ photos.Store = (*PhotoStore)(nil)

// NewPhotoStore wraps a pool connected as coachin_app.
func NewPhotoStore(pool *pgxpool.Pool) *PhotoStore {
	return &PhotoStore{RoutineStore: NewRoutineStore(pool)}
}

// CountPhotos counts the user's images by kind.
func (s *PhotoStore) CountPhotos(ctx context.Context, userID uuid.UUID) (map[photos.Kind]int, error) {
	var rows []queries.CountPhotosByKindRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.CountPhotosByKind(ctx, userID)
		return err
	})
	counts := make(map[photos.Kind]int, len(rows))
	for _, r := range rows {
		counts[photos.Kind(r.Kind)] = int(r.N)
	}
	return counts, err
}

// InsertPhoto adds the row under the profile lock unless the kind is full.
func (s *PhotoStore) InsertPhoto(ctx context.Context, userID uuid.UUID, path string, kind photos.Kind, limit int) (bool, error) {
	inserted := false
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		_, err := q.InsertPhotoUnderCap(ctx, queries.InsertPhotoUnderCapParams{
			UserID: userID, StoragePath: path, Kind: string(kind), MaxCount: int32(limit), // #nosec G115 -- small cap
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		inserted = err == nil
		return err
	})
	return inserted, err
}

// Photos lists the user's images, newest first.
func (s *PhotoStore) Photos(ctx context.Context, userID uuid.UUID) ([]photos.Photo, error) {
	var rows []queries.ListPhotosRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListPhotos(ctx, userID)
		return err
	})
	out := make([]photos.Photo, len(rows))
	for i, r := range rows {
		out[i] = photos.Photo{ID: r.ID, Kind: photos.Kind(r.Kind), CreatedAt: r.CreatedAt, Analysis: r.Analysis, AnalyzedAt: r.AnalyzedAt}
	}
	return out, err
}

// PhotoPath finds one of the user's images.
func (s *PhotoStore) PhotoPath(ctx context.Context, userID, id uuid.UUID) (string, bool, error) {
	var path string
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		path, err = q.PhotoPath(ctx, queries.PhotoPathParams{ID: id, UserID: userID})
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return path, err == nil, err
}

// DeletePhoto removes one of the user's rows and returns its storage path.
func (s *PhotoStore) DeletePhoto(ctx context.Context, userID, id uuid.UUID) (string, bool, error) {
	var path string
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		path, err = q.DeletePhoto(ctx, queries.DeletePhotoParams{ID: id, UserID: userID})
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return path, err == nil, err
}
