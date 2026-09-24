package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
)

// fakeAuth accepts one account and one live session token.
type fakeAuth struct {
	user      uuid.UUID
	liveToken string
	loggedOut string
}

func (f *fakeAuth) Authenticate(_ context.Context, token string) (uuid.UUID, error) {
	if token == f.liveToken {
		return f.user, nil
	}
	return uuid.Nil, auth.ErrNoSession
}

func (f *fakeAuth) Register(context.Context, auth.RegisterInput, auth.Client) (auth.Session, error) {
	return auth.Session{}, &auth.Error{Kind: auth.Conflict, Message: "User already registered"}
}

func (f *fakeAuth) Login(_ context.Context, email, password string, _ auth.Client) (auth.Session, error) {
	if email == "ada@example.com" && password == "Lovelace1" {
		return auth.Session{Token: f.liveToken, UserID: f.user, ExpiresAt: time.Now().Add(time.Hour)}, nil
	}
	return auth.Session{}, auth.ErrInvalidCredentials
}

func (f *fakeAuth) Logout(_ context.Context, token string) error { f.loggedOut = token; return nil }
func (f *fakeAuth) VerifyEmail(context.Context, string) error    { return auth.ErrBadToken }
func (f *fakeAuth) ForgotPassword(context.Context, string) error { return nil }
func (f *fakeAuth) ResetPassword(context.Context, string, string, string) error {
	return nil
}
func (f *fakeAuth) ChangePassword(context.Context, uuid.UUID, string, string, string, string) error {
	return nil
}
func (f *fakeAuth) CurrentUser(_ context.Context, id uuid.UUID) (auth.Me, error) {
	return auth.Me{ID: id, Email: "ada@example.com", FullName: "Ada", Role: "student"}, nil
}

func newAuthServer(t *testing.T, secure bool) (http.Handler, *fakeAuth) {
	t.Helper()
	fake := &fakeAuth{user: uuid.New(), liveToken: "live-token"}
	handler, _ := New(Deps{Auth: fake, Cookies: CookieSettings{Secure: secure}, CommunityEnabled: true})
	return handler, fake
}

func send(t *testing.T, h http.Handler, method, path, body string, header map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestLoginSetsSessionCookie(t *testing.T) {
	for _, secure := range []bool{false, true} {
		h, _ := newAuthServer(t, secure)
		rec := send(t, h, http.MethodPost, BasePath+"/auth/login", `{"email":"ada@example.com","password":"Lovelace1"}`, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("secure=%v: status %d %s", secure, rec.Code, rec.Body)
		}
		cookie := rec.Result().Cookies()[0]
		wantName := map[bool]string{false: "coachin_session", true: "__Host-coachin_session"}[secure]
		if cookie.Name != wantName || cookie.Value != "live-token" || !cookie.HttpOnly ||
			cookie.SameSite != http.SameSiteLaxMode || cookie.Secure != secure || cookie.Path != "/" {
			t.Errorf("secure=%v: cookie = %+v", secure, cookie)
		}
	}
}

func TestLoginErrorsKeepLegacyMessages(t *testing.T) {
	h, _ := newAuthServer(t, false)
	rec := send(t, h, http.MethodPost, BasePath+"/auth/login", `{"email":"ada@example.com","password":"nope"}`, nil)
	var problem struct{ Detail string }
	_ = json.Unmarshal(rec.Body.Bytes(), &problem)
	if rec.Code != http.StatusUnauthorized || problem.Detail != "Invalid login credentials" {
		t.Fatalf("got %d %q", rec.Code, problem.Detail)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/auth/register", `{"email":"a@b.co","password":"x","confirmPassword":"x","fullName":"A"}`, nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("register conflict: %d", rec.Code)
	}
}

func TestMeNeedsASession(t *testing.T) {
	h, fake := newAuthServer(t, false)
	if rec := send(t, h, http.MethodGet, BasePath+"/me", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no cookie: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/me", "", map[string]string{"Cookie": "coachin_session=stale"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("stale cookie: %d", rec.Code)
	}
	rec := send(t, h, http.MethodGet, BasePath+"/me", "", map[string]string{"Cookie": "coachin_session=live-token"})
	var me MeBody
	_ = json.Unmarshal(rec.Body.Bytes(), &me)
	if rec.Code != http.StatusOK || me.ID != fake.user || me.Role != "student" || !me.Features.Community {
		t.Fatalf("got %d %+v", rec.Code, me)
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	h, fake := newAuthServer(t, false)
	rec := send(t, h, http.MethodPost, BasePath+"/auth/logout", "", map[string]string{"Cookie": "coachin_session=live-token"})
	if rec.Code != http.StatusNoContent || fake.loggedOut != "live-token" {
		t.Fatalf("got %d, logged out %q", rec.Code, fake.loggedOut)
	}
	if c := rec.Result().Cookies()[0]; c.MaxAge >= 0 || c.Value != "" {
		t.Errorf("cookie not cleared: %+v", c)
	}
}

func TestCrossSitePostIsRejected(t *testing.T) {
	h, _ := newAuthServer(t, false)
	rec := send(t, h, http.MethodPost, BasePath+"/auth/login", `{"email":"ada@example.com","password":"Lovelace1"}`,
		map[string]string{"Sec-Fetch-Site": "cross-site"})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("cross-site POST: %d", rec.Code)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/auth/login", `{"email":"ada@example.com","password":"Lovelace1"}`,
		map[string]string{"Sec-Fetch-Site": "same-origin"})
	if rec.Code != http.StatusOK {
		t.Fatalf("same-origin POST: %d", rec.Code)
	}
}

func TestAuthEndpointsAreRateLimited(t *testing.T) {
	h, _ := newAuthServer(t, false)
	var last int
	for range 11 {
		last = send(t, h, http.MethodPost, BasePath+"/auth/password/forgot", `{"email":"a@b.co"}`, nil).Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("11th request: %d, want 429", last)
	}
}

func TestClientIPComesFromTheLastForwardedHop(t *testing.T) {
	var seen string
	h := proxiedClientIP(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { seen = r.RemoteAddr }))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.9") // spoofed first hop, Caddy's last
	h.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "203.0.113.9:0" {
		t.Fatalf("RemoteAddr = %q", seen)
	}
}
