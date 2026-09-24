package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
)

var authStatus = map[auth.Kind]int{
	auth.Invalid:      http.StatusBadRequest,
	auth.Unauthorized: http.StatusUnauthorized,
	auth.Conflict:     http.StatusConflict,
}

var appStatus = map[apperr.Kind]int{
	apperr.Invalid:   http.StatusBadRequest,
	apperr.NotFound:  http.StatusNotFound,
	apperr.Forbidden: http.StatusForbidden,
	apperr.Conflict:  http.StatusConflict,
}

// toProblem turns a use-case error into an HTTP problem: expected failures
// keep their user-facing message; anything else is logged and hidden.
func toProblem(ctx context.Context, logger *slog.Logger, err error) error {
	var authErr *auth.Error
	if errors.As(err, &authErr) {
		return huma.NewError(authStatus[authErr.Kind], authErr.Message)
	}
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return huma.NewError(appStatus[appErr.Kind], appErr.Message)
	}
	logger.ErrorContext(ctx, "request failed", "error", err)
	return huma.Error500InternalServerError("Something went wrong. Please try again.")
}
