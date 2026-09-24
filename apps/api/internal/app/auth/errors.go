package auth

import "errors"

// Kind classifies a user-facing auth error so transports can map it.
type Kind int

// Error kinds.
const (
	Invalid      Kind = iota // bad input → 400
	Unauthorized             // bad credentials or session → 401
	Conflict                 // e.g. email already registered → 409
)

// Error is a failure whose Message is safe to show the user.
type Error struct {
	Kind    Kind
	Message string
}

func (e *Error) Error() string { return e.Message }

func invalid(msg string) error { return &Error{Kind: Invalid, Message: msg} }

// Errors stores return; the service turns them into user-facing Errors.
var (
	ErrNotFound   = errors.New("not found")
	ErrEmailTaken = errors.New("email already registered")
)

// Shared user-facing errors. Wording matches the legacy app.
var (
	ErrInvalidCredentials = &Error{Kind: Unauthorized, Message: "Invalid login credentials"}
	ErrNoSession          = &Error{Kind: Unauthorized, Message: "Please sign in again"}
	ErrBadToken           = &Error{Kind: Invalid, Message: "This link is invalid or has expired"}
)
