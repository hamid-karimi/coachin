package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// AuthStore implements auth.Store on the coachin_auth pool.
type AuthStore struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

var _ auth.Store = (*AuthStore)(nil)

// NewAuthStore wraps a pool connected as coachin_auth.
func NewAuthStore(pool *pgxpool.Pool) *AuthStore {
	return &AuthStore{pool: pool, q: queries.New(pool)}
}

const uniqueViolation = "23505"

// notFound maps "no rows" to auth.ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.ErrNotFound
	}
	return err
}

// CreateAccount inserts the user and profile together.
func (s *AuthStore) CreateAccount(ctx context.Context, email, passwordHash, fullName string) (uuid.UUID, error) {
	var id uuid.UUID
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		user, err := q.CreateUser(ctx, queries.CreateUserParams{Email: email, PasswordHash: passwordHash})
		if err != nil {
			return err
		}
		id = user.ID
		return q.CreateProfile(ctx, queries.CreateProfileParams{ID: user.ID, Email: &user.Email, FullName: &fullName})
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return uuid.Nil, auth.ErrEmailTaken
	}
	return id, err
}

// AccountByEmail finds a user by address (case-insensitive).
func (s *AuthStore) AccountByEmail(ctx context.Context, email string) (auth.Account, error) {
	row, err := s.q.GetUserByEmail(ctx, email)
	if err != nil {
		return auth.Account{}, notFound(err)
	}
	return auth.Account{ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, EmailVerifiedAt: row.EmailVerifiedAt}, nil
}

// AccountByID finds a user by id.
func (s *AuthStore) AccountByID(ctx context.Context, id uuid.UUID) (auth.Account, error) {
	row, err := s.q.GetUserByID(ctx, id)
	if err != nil {
		return auth.Account{}, notFound(err)
	}
	return auth.Account{ID: row.ID, Email: row.Email, PasswordHash: row.PasswordHash, EmailVerifiedAt: row.EmailVerifiedAt}, nil
}

// SetPasswordHash replaces the stored hash.
func (s *AuthStore) SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	return s.q.UpdatePasswordHash(ctx, queries.UpdatePasswordHashParams{ID: id, PasswordHash: hash})
}

// MarkEmailVerified records verification once.
func (s *AuthStore) MarkEmailVerified(ctx context.Context, id uuid.UUID) error {
	return s.q.MarkEmailVerified(ctx, id)
}

// ProfileSummary returns the display name and role.
func (s *AuthStore) ProfileSummary(ctx context.Context, id uuid.UUID) (fullName, role string, err error) {
	row, err := s.q.GetProfileSummary(ctx, id)
	if err != nil {
		return "", "", notFound(err)
	}
	return deref(row.FullName), deref(row.Role), nil
}

// CreateSession stores a new session digest.
func (s *AuthStore) CreateSession(ctx context.Context, session auth.NewSession) error {
	var agent *string
	if session.UserAgent != "" {
		agent = &session.UserAgent
	}
	return s.q.CreateSession(ctx, queries.CreateSessionParams{
		IDHash: session.Digest, UserID: session.UserID, ExpiresAt: session.ExpiresAt, UserAgent: agent, Ip: session.IP,
	})
}

// SessionByDigest finds an unexpired session.
func (s *AuthStore) SessionByDigest(ctx context.Context, digest []byte) (auth.StoredSession, error) {
	row, err := s.q.GetSession(ctx, digest)
	if err != nil {
		return auth.StoredSession{}, notFound(err)
	}
	return auth.StoredSession{UserID: row.UserID, LastSeenAt: row.LastSeenAt, ExpiresAt: row.ExpiresAt}, nil
}

// ExtendSession slides the expiry forward.
func (s *AuthStore) ExtendSession(ctx context.Context, digest []byte, expiresAt time.Time) error {
	return s.q.TouchSession(ctx, queries.TouchSessionParams{IDHash: digest, ExpiresAt: expiresAt})
}

// DeleteSession removes one session.
func (s *AuthStore) DeleteSession(ctx context.Context, digest []byte) error {
	return s.q.DeleteSession(ctx, digest)
}

// DeleteSessions removes a user's sessions, optionally keeping one.
func (s *AuthStore) DeleteSessions(ctx context.Context, userID uuid.UUID, keep []byte) error {
	if keep == nil {
		return s.q.DeleteUserSessions(ctx, userID)
	}
	return s.q.DeleteOtherUserSessions(ctx, queries.DeleteOtherUserSessionsParams{UserID: userID, KeepIDHash: keep})
}

// CreateToken stores an emailed token's digest.
func (s *AuthStore) CreateToken(ctx context.Context, digest []byte, userID uuid.UUID, purpose string, expiresAt time.Time) error {
	return s.q.CreateAuthToken(ctx, queries.CreateAuthTokenParams{TokenHash: digest, UserID: userID, Purpose: purpose, ExpiresAt: expiresAt})
}

// ConsumeToken uses a valid token once.
func (s *AuthStore) ConsumeToken(ctx context.Context, digest []byte, purpose string) (uuid.UUID, error) {
	id, err := s.q.ConsumeAuthToken(ctx, queries.ConsumeAuthTokenParams{TokenHash: digest, Purpose: purpose})
	return id, notFound(err)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
