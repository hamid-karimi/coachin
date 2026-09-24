package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
)

// CookieSettings choose the session cookie's name and security.
type CookieSettings struct {
	// Secure: behind HTTPS (VPS). Adds the Secure flag and the __Host- prefix,
	// which browsers only accept over HTTPS.
	Secure bool
}

// SessionCookieName is the cookie the web app checks for (both variants).
func (c CookieSettings) SessionCookieName() string {
	if c.Secure {
		return "__Host-coachin_session"
	}
	return "coachin_session"
}

func (c CookieSettings) issue(token string, expires time.Time) http.Cookie {
	return http.Cookie{
		Name: c.SessionCookieName(), Value: token, Path: "/",
		Expires: expires, MaxAge: int(time.Until(expires).Seconds()),
		HttpOnly: true, Secure: c.Secure, SameSite: http.SameSiteLaxMode,
	}
}

func (c CookieSettings) clear() http.Cookie {
	return http.Cookie{
		Name: c.SessionCookieName(), Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: c.Secure, SameSite: http.SameSiteLaxMode,
	}
}

type ctxKey int

const (
	userKey ctxKey = iota
	tokenKey
)

// userFrom returns the signed-in user resolved by the session middleware.
func userFrom(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userKey).(uuid.UUID)
	return id, ok
}

func tokenFrom(ctx context.Context) string {
	token, _ := ctx.Value(tokenKey).(string)
	return token
}

// sessionMiddleware resolves the session cookie, when present, to a user.
// A missing or stale cookie is not an error here; requireUser decides.
func sessionMiddleware(authn Authenticator, cookies CookieSettings, logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		cookie, err := huma.ReadCookie(ctx, cookies.SessionCookieName())
		if err != nil || cookie.Value == "" {
			next(ctx)
			return
		}
		userID, err := authn.Authenticate(ctx.Context(), cookie.Value)
		if err != nil {
			var authErr *auth.Error
			if !errors.As(err, &authErr) {
				logger.ErrorContext(ctx.Context(), "session lookup failed", "error", err)
			}
			next(ctx)
			return
		}
		ctx = huma.WithValue(ctx, userKey, userID)
		next(huma.WithValue(ctx, tokenKey, cookie.Value))
	}
}

// requireUser rejects requests without a valid session.
func requireUser(api huma.API) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		if _, ok := userFrom(ctx.Context()); !ok {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "Please sign in")
			return
		}
		next(ctx)
	}
}

// clientOf describes the caller for the session record.
func clientOf(ctx huma.Context) auth.Client {
	client := auth.Client{UserAgent: ctx.Header("User-Agent")}
	host, _, err := net.SplitHostPort(ctx.RemoteAddr())
	if err != nil {
		host = ctx.RemoteAddr()
	}
	if ip, err := netip.ParseAddr(host); err == nil {
		client.IP = &ip
	}
	return client
}
