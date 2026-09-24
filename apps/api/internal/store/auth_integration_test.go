package store_test

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/mail"
	"github.com/hamid-karimi/coachin/apps/api/internal/adapters/password"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// outbox records sent mail.
type outbox struct {
	mu   sync.Mutex
	sent []mail.Message
}

func (o *outbox) Send(_ context.Context, m mail.Message) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.sent = append(o.sent, m)
	return nil
}

var linkToken = regexp.MustCompile(`\?token=([A-Za-z0-9_%-]+)`)

// lastToken returns the token in the newest email with this subject.
func (o *outbox) lastToken(t *testing.T, subject string) string {
	t.Helper()
	o.mu.Lock()
	defer o.mu.Unlock()
	for i := len(o.sent) - 1; i >= 0; i-- {
		if o.sent[i].Subject != subject {
			continue
		}
		m := linkToken.FindStringSubmatch(o.sent[i].Text)
		if m == nil {
			t.Fatalf("no link in %q", o.sent[i].Text)
		}
		token, err := url.QueryUnescape(m[1])
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	t.Fatalf("no email with subject %q", subject)
	return ""
}

var fastHash = password.Params{MemoryKiB: 1024, Iterations: 1, Threads: 1, SaltLen: 16, KeyLen: 32}

func newAuthService(t *testing.T) (*auth.Service, *outbox, dbURLs) {
	t.Helper()
	urls := migratedDB(t)
	pool, err := store.Open(context.Background(), urls.Auth)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	box := &outbox{}
	svc, err := auth.NewService(store.NewAuthStore(pool), password.New(fastHash), box,
		auth.DefaultSettings("http://localhost:8080"), slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	return svc, box, urls
}

func wantKind(t *testing.T, err error, kind auth.Kind, msg string) {
	t.Helper()
	var authErr *auth.Error
	if !errors.As(err, &authErr) || authErr.Kind != kind || (msg != "" && authErr.Message != msg) {
		t.Fatalf("err = %v, want kind %d %q", err, kind, msg)
	}
}

func TestAuthLifecycle(t *testing.T) {
	svc, box, _ := newAuthService(t)
	ctx := context.Background()
	client := auth.Client{UserAgent: "test"}

	// Register → signed in, verification mailed.
	reg := auth.RegisterInput{Email: " Ada@Example.com ", Password: "Lovelace1", ConfirmPassword: "Lovelace1", FullName: "Ada"}
	session, err := svc.Register(ctx, reg, client)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	userID, err := svc.Authenticate(ctx, session.Token)
	if err != nil || userID != session.UserID {
		t.Fatalf("authenticate after register: %v", err)
	}
	me, err := svc.CurrentUser(ctx, userID)
	if err != nil || me.Email != "Ada@Example.com" || me.FullName != "Ada" || me.Role != "student" || me.EmailVerified {
		t.Fatalf("me = %+v, %v", me, err)
	}

	// Same address, different case → conflict.
	_, err = svc.Register(ctx, auth.RegisterInput{Email: "ada@example.com", Password: "Lovelace1", ConfirmPassword: "Lovelace1", FullName: "X"}, client)
	wantKind(t, err, auth.Conflict, "User already registered")

	// Verify the email; the link works once.
	token := box.lastToken(t, "Confirm your CoachIn email")
	if err := svc.VerifyEmail(ctx, token); err != nil {
		t.Fatalf("verify: %v", err)
	}
	wantKind(t, svc.VerifyEmail(ctx, token), auth.Invalid, "This link is invalid or has expired")
	if me, _ := svc.CurrentUser(ctx, userID); !me.EmailVerified {
		t.Fatal("email not marked verified")
	}

	// Wrong password; logout; login again.
	_, err = svc.Login(ctx, "ada@example.com", "wrong-Pass1", client)
	wantKind(t, err, auth.Unauthorized, "Invalid login credentials")
	_, err = svc.Login(ctx, "nobody@example.com", "Lovelace1", client)
	wantKind(t, err, auth.Unauthorized, "Invalid login credentials")
	if err := svc.Logout(ctx, session.Token); err != nil {
		t.Fatal(err)
	}
	_, err = svc.Authenticate(ctx, session.Token)
	wantKind(t, err, auth.Unauthorized, "")
	session, err = svc.Login(ctx, "ADA@example.com", "Lovelace1", client)
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	// Forgot → reset: old sessions end, the new password works.
	if err := svc.ForgotPassword(ctx, "ada@example.com"); err != nil {
		t.Fatal(err)
	}
	if err := svc.ForgotPassword(ctx, "ghost@example.com"); err != nil {
		t.Fatalf("unknown address must look like success: %v", err)
	}
	reset := box.lastToken(t, "Reset your CoachIn password")
	wantKind(t, svc.ResetPassword(ctx, reset, "short", "short"), auth.Invalid, "Password must be at least 8 characters")
	if err := svc.ResetPassword(ctx, reset, "Babbage22", "Babbage22"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	_, err = svc.Authenticate(ctx, session.Token)
	wantKind(t, err, auth.Unauthorized, "")
	wantKind(t, svc.ResetPassword(ctx, reset, "Babbage33", "Babbage33"), auth.Invalid, "")

	// Change password keeps the current session, ends the others.
	current, err := svc.Login(ctx, "ada@example.com", "Babbage22", client)
	if err != nil {
		t.Fatal(err)
	}
	other, _ := svc.Login(ctx, "ada@example.com", "Babbage22", client)
	wantKind(t, svc.ChangePassword(ctx, userID, current.Token, "nope", "Engine333", "Engine333"), auth.Invalid, "Current password is incorrect")
	if err := svc.ChangePassword(ctx, userID, current.Token, "Babbage22", "Engine333", "Engine333"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(ctx, current.Token); err != nil {
		t.Fatalf("current session ended: %v", err)
	}
	_, err = svc.Authenticate(ctx, other.Token)
	wantKind(t, err, auth.Unauthorized, "")
}

func TestLegacyBcryptAccountIsUpgradedOnLogin(t *testing.T) {
	svc, _, urls := newAuthService(t)
	ctx := context.Background()

	legacy, err := bcrypt.GenerateFromPassword([]byte("Supabase1"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	const id = "11111111-2222-3333-4444-555555555555"
	if _, err := owner.Exec(ctx, "INSERT INTO users (id, email, password_hash) VALUES ($1, 'old@example.com', $2)", id, string(legacy)); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, "INSERT INTO profiles (id, email) VALUES ($1, 'old@example.com')", id); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.Login(ctx, "old@example.com", "Supabase1", auth.Client{}); err != nil {
		t.Fatalf("legacy login: %v", err)
	}
	var stored string
	if err := owner.QueryRow(ctx, "SELECT password_hash FROM users WHERE id = $1", id).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(stored, "$argon2id$") {
		t.Fatalf("hash not upgraded: %q", stored)
	}
	if _, err := svc.Login(ctx, "old@example.com", "Supabase1", auth.Client{}); err != nil {
		t.Fatalf("login after upgrade: %v", err)
	}
}

func TestRegistrationValidation(t *testing.T) {
	svc, _, _ := newAuthService(t)
	ctx := context.Background()
	cases := map[string]auth.RegisterInput{
		"All fields are required": {Email: "a@b.co", Password: "Abcdefg1", ConfirmPassword: "Abcdefg1"},
		"Invalid email format":    {Email: "a@b", Password: "Abcdefg1", ConfirmPassword: "Abcdefg1", FullName: "A"},
		"Passwords do not match":  {Email: "a@b.co", Password: "Abcdefg1", ConfirmPassword: "Abcdefg2", FullName: "A"},
		"Password must contain at least one uppercase letter, one lowercase letter, and one number": {
			Email: "a@b.co", Password: "abcdefgh", ConfirmPassword: "abcdefgh", FullName: "A"},
	}
	for want, in := range cases {
		_, err := svc.Register(ctx, in, auth.Client{})
		wantKind(t, err, auth.Invalid, want)
	}
}
