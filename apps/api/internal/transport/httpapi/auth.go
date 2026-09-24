package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/auth"
)

// Authenticator resolves session tokens.
type Authenticator interface {
	Authenticate(ctx context.Context, token string) (uuid.UUID, error)
}

// AuthService is the account use cases the transport calls.
type AuthService interface {
	Authenticator
	Register(ctx context.Context, in auth.RegisterInput, client auth.Client) (auth.Session, error)
	Login(ctx context.Context, email, password string, client auth.Client) (auth.Session, error)
	Logout(ctx context.Context, token string) error
	VerifyEmail(ctx context.Context, token string) error
	ForgotPassword(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, token, password, confirm string) error
	ChangePassword(ctx context.Context, userID uuid.UUID, sessionToken, current, password, confirm string) error
	CurrentUser(ctx context.Context, userID uuid.UUID) (auth.Me, error)
}

// ResultBody is the toast-ready outcome of a mutation (same shape as the
// legacy server actions' state).
type ResultBody struct {
	Status  string `json:"status" enum:"success,info"`
	Message string `json:"message"`
}

type resultOutput struct {
	Body ResultBody
}

type sessionOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
	Body      ResultBody
}

type logoutOutput struct {
	SetCookie http.Cookie `header:"Set-Cookie"`
}

// Request bodies. Lengths are generous caps; the use cases own the rules.
type registerInput struct {
	Body struct {
		Email           string `json:"email" maxLength:"254"`
		Password        string `json:"password" maxLength:"256"`
		ConfirmPassword string `json:"confirmPassword" maxLength:"256"`
		FullName        string `json:"fullName" maxLength:"120"`
	}
}

type loginInput struct {
	Body struct {
		Email    string `json:"email" maxLength:"254"`
		Password string `json:"password" maxLength:"256"`
	}
}

type tokenInput struct {
	Body struct {
		Token string `json:"token" maxLength:"128"`
	}
}

type forgotInput struct {
	Body struct {
		Email string `json:"email" maxLength:"254"`
	}
}

type resetInput struct {
	Body struct {
		Token           string `json:"token" maxLength:"128"`
		Password        string `json:"password" maxLength:"256"`
		ConfirmPassword string `json:"confirmPassword" maxLength:"256"`
	}
}

type changeInput struct {
	Body struct {
		CurrentPassword string `json:"currentPassword" maxLength:"256"`
		Password        string `json:"password" maxLength:"256"`
		ConfirmPassword string `json:"confirmPassword" maxLength:"256"`
	}
}

// Features are the runtime feature flags the web app needs.
type Features struct {
	Community bool `json:"community"`
}

// MeBody is the signed-in user.
type MeBody struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	EmailVerified bool      `json:"emailVerified"`
	FullName      string    `json:"fullName"`
	Role          string    `json:"role" enum:"student,coach,both,admin"`
	Features      Features  `json:"features"`
}

type meOutput struct {
	Body MeBody
}

var authStatus = map[auth.Kind]int{
	auth.Invalid:      http.StatusBadRequest,
	auth.Unauthorized: http.StatusUnauthorized,
	auth.Conflict:     http.StatusConflict,
}

// toProblem turns a use-case error into an HTTP problem: user-facing auth
// errors keep their message; anything else is logged and hidden.
func toProblem(ctx context.Context, logger *slog.Logger, err error) error {
	var authErr *auth.Error
	if errors.As(err, &authErr) {
		return huma.NewError(authStatus[authErr.Kind], authErr.Message)
	}
	logger.ErrorContext(ctx, "request failed", "error", err)
	return huma.Error500InternalServerError("Something went wrong. Please try again.")
}

func registerAuth(api huma.API, deps Deps) {
	svc, cookies, logger := deps.Auth, deps.Cookies, deps.logger()
	limited := huma.Middlewares{rateLimited(api, newLimiter(6*time.Second, 10))}
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"auth"}

	huma.Register(api, huma.Operation{
		OperationID: "register", Method: http.MethodPost, Path: "/auth/register",
		Summary: "Create an account and sign in", Tags: tags, DefaultStatus: http.StatusCreated,
		Middlewares: limited, Errors: []int{400, 409, 429},
	}, func(ctx context.Context, in *registerInput) (*sessionOutput, error) {
		b := in.Body
		session, err := svc.Register(ctx, auth.RegisterInput{
			Email: b.Email, Password: b.Password, ConfirmPassword: b.ConfirmPassword, FullName: b.FullName,
		}, clientFromContext(ctx))
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &sessionOutput{
			SetCookie: cookies.issue(session.Token, session.ExpiresAt),
			Body:      ResultBody{Status: "success", Message: "Account created successfully."},
		}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "login", Method: http.MethodPost, Path: "/auth/login",
		Summary: "Sign in", Tags: tags, Middlewares: limited, Errors: []int{400, 401, 429},
	}, func(ctx context.Context, in *loginInput) (*sessionOutput, error) {
		session, err := svc.Login(ctx, in.Body.Email, in.Body.Password, clientFromContext(ctx))
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &sessionOutput{
			SetCookie: cookies.issue(session.Token, session.ExpiresAt),
			Body:      ResultBody{Status: "success", Message: "Welcome back!"},
		}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "logout", Method: http.MethodPost, Path: "/auth/logout",
		Summary: "Sign out this browser", Tags: tags, DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*logoutOutput, error) {
		if err := svc.Logout(ctx, tokenFrom(ctx)); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &logoutOutput{SetCookie: cookies.clear()}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "verifyEmail", Method: http.MethodPost, Path: "/auth/verify-email",
		Summary: "Confirm an email address from the emailed link", Tags: tags,
		Middlewares: limited, Errors: []int{400, 429},
	}, func(ctx context.Context, in *tokenInput) (*resultOutput, error) {
		if err := svc.VerifyEmail(ctx, in.Body.Token); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Email confirmed. Thanks!"}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "forgotPassword", Method: http.MethodPost, Path: "/auth/password/forgot",
		Summary: "Email a password-reset link", Tags: tags, DefaultStatus: http.StatusAccepted,
		Middlewares: limited, Errors: []int{400, 429},
	}, func(ctx context.Context, in *forgotInput) (*resultOutput, error) {
		if err := svc.ForgotPassword(ctx, in.Body.Email); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{
			Status: "info", Message: "If an account exists for that address, we've emailed a reset link.",
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "resetPassword", Method: http.MethodPost, Path: "/auth/password/reset",
		Summary: "Set a new password from the emailed link", Tags: tags,
		Middlewares: limited, Errors: []int{400, 429},
	}, func(ctx context.Context, in *resetInput) (*resultOutput, error) {
		b := in.Body
		if err := svc.ResetPassword(ctx, b.Token, b.Password, b.ConfirmPassword); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Password updated. Please sign in."}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "changePassword", Method: http.MethodPost, Path: "/auth/password/change",
		Summary: "Change the signed-in user's password", Tags: tags,
		Middlewares: append(signedIn, limited...), Errors: []int{400, 401, 429},
	}, func(ctx context.Context, in *changeInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		if err := svc.ChangePassword(ctx, userID, tokenFrom(ctx), b.CurrentPassword, b.Password, b.ConfirmPassword); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Password changed. Other devices were signed out."}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "me", Method: http.MethodGet, Path: "/me",
		Summary: "The signed-in user", Tags: []string{"account"},
		Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*meOutput, error) {
		userID, _ := userFrom(ctx)
		me, err := svc.CurrentUser(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &meOutput{Body: MeBody{
			ID: me.ID, Email: me.Email, EmailVerified: me.EmailVerified, FullName: me.FullName,
			Role: me.Role, Features: Features{Community: deps.CommunityEnabled},
		}}, nil
	})
}

type clientKey struct{}

// clientFromContext reads the caller details stored by clientMiddleware.
func clientFromContext(ctx context.Context) auth.Client {
	client, _ := ctx.Value(clientKey{}).(auth.Client)
	return client
}

// clientMiddleware records user agent and IP for session records.
func clientMiddleware(ctx huma.Context, next func(huma.Context)) {
	next(huma.WithValue(ctx, clientKey{}, clientOf(ctx)))
}
