package httpapi

import (
	"context"
	"net/http"
	"reflect"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

// ReadinessChecks maps a dependency name ("database", "storage") to a probe.
type ReadinessChecks map[string]func(context.Context) error

const checkTimeout = 2 * time.Second

// HealthBody is the liveness response.
type HealthBody struct {
	Status string `json:"status" enum:"ok" doc:"Always ok while the process is serving."`
}

// ReadyBody is the readiness response: one entry per dependency.
type ReadyBody struct {
	Status string            `json:"status" enum:"ok,unavailable"`
	Checks map[string]string `json:"checks" doc:"Dependency name to \"ok\" or the failure message."`
}

type healthOutput struct {
	Body HealthBody
}

type readyOutput struct {
	Status int
	Body   ReadyBody
}

func registerHealth(api huma.API, checks ReadinessChecks) {
	huma.Register(api, huma.Operation{
		OperationID: "healthz",
		Method:      http.MethodGet,
		Path:        "/healthz",
		Summary:     "Liveness probe",
		Tags:        []string{"health"},
	}, func(context.Context, *struct{}) (*healthOutput, error) {
		return &healthOutput{Body: HealthBody{Status: "ok"}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "readyz",
		Method:      http.MethodGet,
		Path:        "/readyz",
		Summary:     "Readiness probe (database and object storage)",
		Tags:        []string{"health"},
		Responses: map[string]*huma.Response{
			"503": {
				Description: "A dependency is unavailable",
				Content: map[string]*huma.MediaType{
					"application/json": {Schema: api.OpenAPI().Components.Schemas.Schema(reflect.TypeFor[ReadyBody](), true, "")},
				},
			},
		},
	}, func(ctx context.Context, _ *struct{}) (*readyOutput, error) {
		body := runChecks(ctx, checks)
		status := http.StatusOK
		if body.Status != "ok" {
			status = http.StatusServiceUnavailable
		}
		return &readyOutput{Status: status, Body: body}, nil
	})
}

// runChecks probes every dependency (in name order, each time-boxed) and
// reports all results rather than stopping at the first failure.
func runChecks(ctx context.Context, checks ReadinessChecks) ReadyBody {
	body := ReadyBody{Status: "ok", Checks: make(map[string]string, len(checks))}
	names := make([]string, 0, len(checks))
	for name := range checks {
		names = append(names, name)
	}
	slices.Sort(names)

	for _, name := range names {
		checkCtx, cancel := context.WithTimeout(ctx, checkTimeout)
		err := checks[name](checkCtx)
		cancel()
		if err != nil {
			body.Status = "unavailable"
			body.Checks[name] = err.Error()
			continue
		}
		body.Checks[name] = "ok"
	}
	return body
}
