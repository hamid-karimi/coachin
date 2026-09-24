// Package apperr is the user-facing error every use case returns for an
// expected failure (bad input, missing row). The transport maps Kind to an
// HTTP status and shows Message as-is; any other error is a 500.
package apperr

// Kind classifies an expected failure.
type Kind int

const (
	// Invalid is input the user can fix.
	Invalid Kind = iota + 1
	// NotFound is a row that does not exist or is not the caller's.
	NotFound
	// Forbidden is an action the caller may not take.
	Forbidden
	// Conflict is a clash with existing state.
	Conflict
)

// Error is an expected failure with a message safe to show the user.
type Error struct {
	Kind    Kind
	Message string
}

func (e *Error) Error() string { return e.Message }

// New returns an *Error.
func New(kind Kind, message string) error {
	return &Error{Kind: kind, Message: message}
}
