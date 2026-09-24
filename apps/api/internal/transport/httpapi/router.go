// Package httpapi is the API's HTTP transport: routing, middleware, and the
// huma operations that define the OpenAPI contract. Handlers stay thin — they
// translate HTTP to use-case calls and back.
package httpapi

import (
	"log/slog"
	"net/http"

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
	Logger *slog.Logger
	Checks ReadinessChecks
}

// New builds the HTTP handler and the huma API that describes it.
func New(deps Deps) (http.Handler, huma.API) {
	logger := deps.Logger
	if logger == nil {
		logger = slog.New(slog.DiscardHandler)
	}

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(requestLogger(logger))
	router.Use(middleware.Recoverer)

	var api huma.API
	router.Route(BasePath, func(r chi.Router) {
		api = humachi.New(r, apiConfig())
	})

	registerHealth(api, deps.Checks)

	return router, api
}

func apiConfig() huma.Config {
	cfg := huma.DefaultConfig("CoachIn API", "0.1.0")
	cfg.Servers = []*huma.Server{{URL: BasePath}}
	// No `$schema` fields or Link headers in responses: the contract lives in
	// openapi.json and the generated TypeScript client, not in payloads.
	cfg.CreateHooks = nil
	return cfg
}
