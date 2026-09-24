// Package auth is the account use cases: registration, login, sessions,
// email verification, and password reset/change (ADR-3). Sessions are opaque
// random tokens; only their SHA-256 digests are stored.
package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/mail"
)

// Account is a stored user.
type Account struct {
	ID              uuid.UUID
	Email           string
	PasswordHash    string
	EmailVerifiedAt *time.Time
}

// StoredSession is a session row.
type StoredSession struct {
	UserID     uuid.UUID
	LastSeenAt time.Time
	ExpiresAt  time.Time
}

// NewSession is what CreateSession stores.
type NewSession struct {
	Digest    []byte
	UserID    uuid.UUID
	ExpiresAt time.Time
	UserAgent string
	IP        *netip.Addr
}

// Token purposes.
const (
	PurposeVerifyEmail   = "verify_email"
	PurposeResetPassword = "reset_password"
)

// Store is the persistence the use cases need (coachin_auth pool).
type Store interface {
	// CreateAccount inserts the user and their profile in one transaction;
	// ErrEmailTaken when the address is already registered.
	CreateAccount(ctx context.Context, email, passwordHash, fullName string) (uuid.UUID, error)
	AccountByEmail(ctx context.Context, email string) (Account, error)
	AccountByID(ctx context.Context, id uuid.UUID) (Account, error)
	SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error
	MarkEmailVerified(ctx context.Context, id uuid.UUID) error
	ProfileSummary(ctx context.Context, id uuid.UUID) (fullName, role string, err error)

	CreateSession(ctx context.Context, s NewSession) error
	SessionByDigest(ctx context.Context, digest []byte) (StoredSession, error)
	ExtendSession(ctx context.Context, digest []byte, expiresAt time.Time) error
	DeleteSession(ctx context.Context, digest []byte) error
	// DeleteSessions removes every session of the user except keep (nil keeps none).
	DeleteSessions(ctx context.Context, userID uuid.UUID, keep []byte) error

	CreateToken(ctx context.Context, digest []byte, userID uuid.UUID, purpose string, expiresAt time.Time) error
	// ConsumeToken marks a valid token used and returns its user, or ErrNotFound.
	ConsumeToken(ctx context.Context, digest []byte, purpose string) (uuid.UUID, error)
}

// Hasher hashes and verifies passwords.
type Hasher interface {
	Hash(plain string) (string, error)
	Verify(plain, encoded string) (match, needsRehash bool, err error)
}

// Mailer sends email.
type Mailer interface {
	Send(ctx context.Context, msg mail.Message) error
}

// Settings are the service's tunables.
type Settings struct {
	// BaseURL is the public origin used in emailed links.
	BaseURL string
	// SessionTTL is the sliding session lifetime.
	SessionTTL time.Duration
	// TouchEvery limits how often an active session's expiry is extended.
	TouchEvery time.Duration
	VerifyTTL  time.Duration
	ResetTTL   time.Duration
}

// DefaultSettings returns production lifetimes for baseURL.
func DefaultSettings(baseURL string) Settings {
	return Settings{
		BaseURL:    baseURL,
		SessionTTL: 30 * 24 * time.Hour,
		TouchEvery: time.Hour,
		VerifyTTL:  7 * 24 * time.Hour,
		ResetTTL:   time.Hour,
	}
}

// Service runs the account use cases.
type Service struct {
	store    Store
	hasher   Hasher
	mailer   Mailer
	settings Settings
	logger   *slog.Logger
	now      func() time.Time
	// dummyHash is verified when an email is unknown, so a login takes the
	// same time whether or not the account exists.
	dummyHash string
}

// NewService wires the use cases.
func NewService(store Store, hasher Hasher, mailer Mailer, settings Settings, logger *slog.Logger) (*Service, error) {
	dummy, err := hasher.Hash("timing-equalizer")
	if err != nil {
		return nil, err
	}
	return &Service{
		store: store, hasher: hasher, mailer: mailer, settings: settings, logger: logger,
		now: time.Now, dummyHash: dummy,
	}, nil
}

// Client describes where a request came from, for the session record.
type Client struct {
	UserAgent string
	IP        *netip.Addr
}

// Session is a freshly issued session.
type Session struct {
	Token     string
	UserID    uuid.UUID
	ExpiresAt time.Time
}

// Register creates the account and profile, signs the user in, and emails a
// verification link. Verification does not block sign-in (spec §5.1).
func (s *Service) Register(ctx context.Context, in RegisterInput, client Client) (Session, error) {
	in.Email = normalizeEmail(in.Email)
	if err := validateRegistration(in); err != nil {
		return Session{}, err
	}
	hash, err := s.hasher.Hash(in.Password)
	if err != nil {
		return Session{}, err
	}
	userID, err := s.store.CreateAccount(ctx, in.Email, hash, in.FullName)
	if errors.Is(err, ErrEmailTaken) {
		return Session{}, &Error{Kind: Conflict, Message: "User already registered"}
	}
	if err != nil {
		return Session{}, err
	}
	s.sendVerification(ctx, userID, in.Email, in.FullName)
	return s.startSession(ctx, userID, client)
}

// Login checks credentials and starts a session. A legacy (bcrypt) or
// weaker hash is upgraded on the way.
func (s *Service) Login(ctx context.Context, email, password string, client Client) (Session, error) {
	email = normalizeEmail(email)
	if err := validateLogin(email, password); err != nil {
		return Session{}, err
	}
	account, err := s.store.AccountByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		_, _, _ = s.hasher.Verify(password, s.dummyHash)
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	match, rehash, err := s.hasher.Verify(password, account.PasswordHash)
	if err != nil {
		return Session{}, fmt.Errorf("verify password: %w", err)
	}
	if !match {
		return Session{}, ErrInvalidCredentials
	}
	if rehash {
		if upgraded, err := s.hasher.Hash(password); err == nil {
			if err := s.store.SetPasswordHash(ctx, account.ID, upgraded); err != nil {
				s.logger.WarnContext(ctx, "password rehash failed", "user_id", account.ID, "error", err)
			}
		}
	}
	return s.startSession(ctx, account.ID, client)
}

// Authenticate resolves a session token to its user, extending an active
// session's expiry at most once per TouchEvery.
func (s *Service) Authenticate(ctx context.Context, token string) (uuid.UUID, error) {
	if token == "" {
		return uuid.Nil, ErrNoSession
	}
	digest := hashToken(token)
	session, err := s.store.SessionByDigest(ctx, digest)
	if errors.Is(err, ErrNotFound) {
		return uuid.Nil, ErrNoSession
	}
	if err != nil {
		return uuid.Nil, err
	}
	now := s.now()
	if now.Sub(session.LastSeenAt) >= s.settings.TouchEvery {
		if err := s.store.ExtendSession(ctx, digest, now.Add(s.settings.SessionTTL)); err != nil {
			s.logger.WarnContext(ctx, "session extend failed", "error", err)
		}
	}
	return session.UserID, nil
}

// Logout ends the session; unknown tokens are fine.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.store.DeleteSession(ctx, hashToken(token))
}

// VerifyEmail consumes an emailed verification token.
func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	userID, err := s.store.ConsumeToken(ctx, hashToken(token), PurposeVerifyEmail)
	if errors.Is(err, ErrNotFound) {
		return ErrBadToken
	}
	if err != nil {
		return err
	}
	return s.store.MarkEmailVerified(ctx, userID)
}

// ForgotPassword emails a reset link when the account exists. It never says
// whether it does.
func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	email = normalizeEmail(email)
	if !emailPattern.MatchString(email) {
		return invalid("Invalid email format")
	}
	account, err := s.store.AccountByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	token, digest, err := newToken()
	if err != nil {
		return err
	}
	if err := s.store.CreateToken(ctx, digest, account.ID, PurposeResetPassword, s.now().Add(s.settings.ResetTTL)); err != nil {
		return err
	}
	name, _, _ := s.store.ProfileSummary(ctx, account.ID)
	content := emailContent{Name: displayName(name, account.Email), Link: link(s.settings.BaseURL, "/auth/reset-password", token)}
	return s.mailer.Send(ctx, mail.Message{
		To: account.Email, Subject: "Reset your CoachIn password",
		Text: render(resetText, content), HTML: render(resetHTML, content),
	})
}

// ResetPassword sets a new password from an emailed token and signs the user
// out everywhere.
func (s *Service) ResetPassword(ctx context.Context, token, password, confirm string) error {
	if err := validateNewPassword(password, confirm); err != nil {
		return err
	}
	userID, err := s.store.ConsumeToken(ctx, hashToken(token), PurposeResetPassword)
	if errors.Is(err, ErrNotFound) {
		return ErrBadToken
	}
	if err != nil {
		return err
	}
	if err := s.setPassword(ctx, userID, password); err != nil {
		return err
	}
	// Proving control of the inbox also verifies the address.
	if err := s.store.MarkEmailVerified(ctx, userID); err != nil {
		return err
	}
	return s.store.DeleteSessions(ctx, userID, nil)
}

// ChangePassword replaces the password of a signed-in user and signs out
// their other sessions.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, sessionToken, current, password, confirm string) error {
	account, err := s.store.AccountByID(ctx, userID)
	if err != nil {
		return err
	}
	match, _, err := s.hasher.Verify(current, account.PasswordHash)
	if err != nil {
		return err
	}
	if !match {
		return invalid("Current password is incorrect")
	}
	if err := validateNewPassword(password, confirm); err != nil {
		return err
	}
	if err := s.setPassword(ctx, userID, password); err != nil {
		return err
	}
	return s.store.DeleteSessions(ctx, userID, hashToken(sessionToken))
}

// Me is the signed-in user's identity.
type Me struct {
	ID            uuid.UUID
	Email         string
	EmailVerified bool
	FullName      string
	Role          string
}

// CurrentUser returns who the session belongs to.
func (s *Service) CurrentUser(ctx context.Context, userID uuid.UUID) (Me, error) {
	account, err := s.store.AccountByID(ctx, userID)
	if err != nil {
		return Me{}, err
	}
	name, role, err := s.store.ProfileSummary(ctx, userID)
	if err != nil {
		return Me{}, err
	}
	return Me{
		ID: account.ID, Email: account.Email, EmailVerified: account.EmailVerifiedAt != nil,
		FullName: name, Role: role,
	}, nil
}

func (s *Service) setPassword(ctx context.Context, userID uuid.UUID, password string) error {
	hash, err := s.hasher.Hash(password)
	if err != nil {
		return err
	}
	return s.store.SetPasswordHash(ctx, userID, hash)
}

func (s *Service) startSession(ctx context.Context, userID uuid.UUID, client Client) (Session, error) {
	token, digest, err := newToken()
	if err != nil {
		return Session{}, err
	}
	expires := s.now().Add(s.settings.SessionTTL)
	err = s.store.CreateSession(ctx, NewSession{
		Digest: digest, UserID: userID, ExpiresAt: expires, UserAgent: client.UserAgent, IP: client.IP,
	})
	if err != nil {
		return Session{}, err
	}
	return Session{Token: token, UserID: userID, ExpiresAt: expires}, nil
}

// sendVerification emails a confirmation link. A mail failure is logged, not
// returned: the account exists and verification doesn't block sign-in.
func (s *Service) sendVerification(ctx context.Context, userID uuid.UUID, email, name string) {
	token, digest, err := newToken()
	if err == nil {
		err = s.store.CreateToken(ctx, digest, userID, PurposeVerifyEmail, s.now().Add(s.settings.VerifyTTL))
	}
	if err == nil {
		content := emailContent{Name: displayName(name, email), Link: link(s.settings.BaseURL, "/auth/verify-email", token)}
		err = s.mailer.Send(ctx, mail.Message{
			To: email, Subject: "Confirm your CoachIn email",
			Text: render(verifyText, content), HTML: render(verifyHTML, content),
		})
	}
	if err != nil {
		s.logger.ErrorContext(ctx, "verification email not sent", "user_id", userID, "error", err)
	}
}

func displayName(fullName, email string) string {
	if fullName != "" {
		return fullName
	}
	return email
}
