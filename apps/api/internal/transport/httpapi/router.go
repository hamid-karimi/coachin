// Package httpapi is the API's HTTP transport: routing, middleware, and the
// huma operations that define the OpenAPI contract. Handlers stay thin — they
// translate HTTP to use-case calls and back.
package httpapi

import (
	"log/slog"
	"net/http"
	"net/netip"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// BasePath is where every operation is mounted; Caddy forwards /api/* here.
const BasePath = "/api/v1"

// Deps are the collaborators the handlers need. The zero value is enough to
// build the router for OpenAPI export — no operation runs during registration.
type Deps struct {
	Logger           *slog.Logger
	Checks           ReadinessChecks
	Auth             AuthService
	Routine          RoutineService
	Cookies          CookieSettings
	CommunityEnabled bool
}

func (d Deps) logger() *slog.Logger {
	if d.Logger == nil {
		return slog.New(slog.DiscardHandler)
	}
	return d.Logger
}

// New builds the HTTP handler and the huma API that describes it.
func New(deps Deps) (http.Handler, huma.API) {
	logger := deps.logger()

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(proxiedClientIP)
	router.Use(requestLogger(logger))
	router.Use(middleware.Recoverer)

	var api huma.API
	router.Route(BasePath, func(r chi.Router) {
		api = humachi.New(r, apiConfig())
	})
	api.UseMiddleware(clientMiddleware)
	if deps.Auth != nil {
		api.UseMiddleware(sessionMiddleware(deps.Auth, deps.Cookies, logger))
	}

	registerHealth(api, deps.Checks)
	registerAuth(api, deps)
	registerRoutine(api, deps)

	// Rejects cross-site state-changing requests (Sec-Fetch-Site / Origin),
	// the CSRF guard for cookie sessions.
	return http.NewCrossOriginProtection().Handler(router), api
}

// proxiedClientIP sets RemoteAddr to the client address Caddy saw: the LAST
// X-Forwarded-For entry, which Caddy appends itself. Earlier entries are
// client-supplied and never trusted (unlike chi's deprecated RealIP). Only
// Caddy can reach the API, so a request without the header is internal.
func proxiedClientIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if forwarded := r.Header.Values("X-Forwarded-For"); len(forwarded) > 0 {
			hops := strings.Split(forwarded[len(forwarded)-1], ",")
			if ip, err := netip.ParseAddr(strings.TrimSpace(hops[len(hops)-1])); err == nil {
				r.RemoteAddr = netip.AddrPortFrom(ip, 0).String()
			}
		}
		next.ServeHTTP(w, r)
	})
}

func apiConfig() huma.Config {
	// Responses always carry arrays (possibly empty), never null, so the
	// generated client needs no null checks. Handlers must return non-nil slices.
	huma.DefaultArrayNullable = false
	cfg := huma.DefaultConfig("CoachIn API", "0.1.0")
	cfg.Servers = []*huma.Server{{URL: BasePath}}
	// No `$schema` fields or Link headers in responses: the contract lives in
	// openapi.json and the generated TypeScript client, not in payloads.
	cfg.CreateHooks = nil
	return cfg
}
