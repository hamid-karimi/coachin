package auth

import (
	"regexp"
	"strings"
)

// The rules and messages below are the legacy app's, unchanged.

var (
	emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	hasUpper     = regexp.MustCompile(`[A-Z]`)
	hasLower     = regexp.MustCompile(`[a-z]`)
	hasDigit     = regexp.MustCompile(`[0-9]`)
)

// MinPasswordLength is the shortest accepted password.
const MinPasswordLength = 8

// RegisterInput is the sign-up form.
type RegisterInput struct {
	Email           string
	Password        string
	ConfirmPassword string
	FullName        string
}

func validateRegistration(in RegisterInput) error {
	if in.Email == "" || in.Password == "" || in.ConfirmPassword == "" || strings.TrimSpace(in.FullName) == "" {
		return invalid("All fields are required")
	}
	if !emailPattern.MatchString(in.Email) {
		return invalid("Invalid email format")
	}
	return validateNewPassword(in.Password, in.ConfirmPassword)
}

func validateNewPassword(password, confirm string) error {
	if len(password) < MinPasswordLength {
		return invalid("Password must be at least 8 characters")
	}
	if password != confirm {
		return invalid("Passwords do not match")
	}
	if !hasUpper.MatchString(password) || !hasLower.MatchString(password) || !hasDigit.MatchString(password) {
		return invalid("Password must contain at least one uppercase letter, one lowercase letter, and one number")
	}
	return nil
}

func validateLogin(email, password string) error {
	if email == "" || password == "" {
		return invalid("Email and password are required")
	}
	if !emailPattern.MatchString(email) {
		return invalid("Invalid email format")
	}
	return nil
}

// normalizeEmail trims the address; case-insensitive matching is the
// database's job (citext).
func normalizeEmail(email string) string { return strings.TrimSpace(email) }
