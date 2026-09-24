// Package config reads the API's settings from environment variables.
//
// Each command loads only what it needs and fails fast, naming every missing
// variable at once, so a misconfigured container stops at boot instead of on
// the first request.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
)

// Getenv matches os.Getenv; injected so tests don't touch the process env.
type Getenv func(string) string

// S3 is the object-storage connection used by the API.
type S3 struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
}

// SMTP is the outgoing mail server.
type SMTP struct {
	Host     string
	Port     int
	Username string
	Password string
	// TLS is "none" (Mailpit), "starttls", or "tls" (implicit TLS).
	TLS  string
	From string
}

// Server is everything `api serve` needs.
type Server struct {
	HTTPAddr    string
	LogLevel    slog.Level
	DatabaseURL string
	// AuthDatabaseURL connects as coachin_auth (login, registration, sessions).
	AuthDatabaseURL string
	// BaseURL is the public origin, used in emailed links.
	BaseURL string
	// CookieSecure sets Secure + the __Host- prefix on the session cookie
	// (required behind HTTPS; off for plain-http localhost).
	CookieSecure     bool
	CommunityEnabled bool
	SMTP             SMTP
	S3               S3
	AI               AI
	// USDAAPIKey enables USDA FoodData Central search; empty disables it.
	USDAAPIKey string
}

// AI selects the generation providers. An empty key disables a provider;
// with neither, AI features answer "temporarily unavailable".
type AI struct {
	ClaudeAPIKey string
	ClaudeModel  string // "" = the adapter's default
	GeminiAPIKey string
	GeminiModel  string
}

// Garage is everything `api storage-init` needs to bootstrap a Garage node.
type Garage struct {
	AdminURL      string
	AdminToken    string
	CapacityBytes int64
	S3            S3
}

const defaultHTTPAddr = ":8080"

// LoadServer reads the `serve` configuration.
func LoadServer(getenv Getenv) (Server, error) {
	r := reader{getenv: getenv}
	cfg := Server{
		HTTPAddr:         r.optional("HTTP_ADDR", defaultHTTPAddr),
		LogLevel:         r.logLevel("LOG_LEVEL"),
		DatabaseURL:      r.required("DATABASE_URL"),
		AuthDatabaseURL:  r.required("AUTH_DATABASE_URL"),
		BaseURL:          strings.TrimRight(r.required("APP_BASE_URL"), "/"),
		CookieSecure:     r.bool("COOKIE_SECURE", false),
		CommunityEnabled: r.bool("FEATURE_COMMUNITY", false),
		SMTP: SMTP{
			Host:     r.required("SMTP_HOST"),
			Port:     int(r.int64("SMTP_PORT", 587)),
			Username: r.optional("SMTP_USERNAME", ""),
			Password: r.optional("SMTP_PASSWORD", ""),
			TLS:      r.oneOf("SMTP_TLS", "starttls", "none", "starttls", "tls"),
			From:     r.required("MAIL_FROM"),
		},
		S3: r.s3(),
		AI: AI{
			ClaudeAPIKey: r.optional("CLAUDE_API_KEY", ""),
			ClaudeModel:  r.optional("CLAUDE_MODEL", ""),
			GeminiAPIKey: r.optional("GEMINI_API_KEY", ""),
			GeminiModel:  r.optional("GEMINI_MODEL", ""),
		},
		USDAAPIKey: r.optional("USDA_API_KEY", ""),
	}
	return cfg, r.err()
}

// LoadMigrate reads the owner-role connection string used for migrations.
func LoadMigrate(getenv Getenv) (string, error) {
	r := reader{getenv: getenv}
	url := r.required("MIGRATE_DATABASE_URL")
	return url, r.err()
}

// LoadGarage reads the `storage-init` configuration.
func LoadGarage(getenv Getenv) (Garage, error) {
	r := reader{getenv: getenv}
	cfg := Garage{
		AdminURL:      r.required("GARAGE_ADMIN_URL"),
		AdminToken:    r.required("GARAGE_ADMIN_TOKEN"),
		CapacityBytes: r.int64("GARAGE_CAPACITY_BYTES", 10<<30),
		S3:            r.s3(),
	}
	return cfg, r.err()
}

// HTTPAddr is the listen address, shared by `serve` and `healthcheck`.
func HTTPAddr(getenv Getenv) string {
	r := reader{getenv: getenv}
	return r.optional("HTTP_ADDR", defaultHTTPAddr)
}

// reader collects every problem instead of stopping at the first one.
type reader struct {
	getenv   Getenv
	problems []string
}

func (r *reader) required(key string) string {
	v := strings.TrimSpace(r.getenv(key))
	if v == "" {
		r.problems = append(r.problems, key+" is required")
	}
	return v
}

func (r *reader) optional(key, fallback string) string {
	if v := strings.TrimSpace(r.getenv(key)); v != "" {
		return v
	}
	return fallback
}

func (r *reader) int64(key string, fallback int64) int64 {
	raw := strings.TrimSpace(r.getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || n <= 0 {
		r.problems = append(r.problems, key+" must be a positive integer")
		return fallback
	}
	return n
}

func (r *reader) bool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(r.getenv(key)))
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		if raw == "on" || raw == "off" {
			return raw == "on"
		}
		r.problems = append(r.problems, key+" must be true/false (or on/off)")
		return fallback
	}
	return value
}

func (r *reader) oneOf(key, fallback string, allowed ...string) string {
	value := strings.ToLower(r.optional(key, fallback))
	for _, a := range allowed {
		if value == a {
			return value
		}
	}
	r.problems = append(r.problems, fmt.Sprintf("%s must be one of %s (got %q)", key, strings.Join(allowed, ", "), value))
	return fallback
}

var logLevels = map[string]slog.Level{
	"debug": slog.LevelDebug,
	"info":  slog.LevelInfo,
	"warn":  slog.LevelWarn,
	"error": slog.LevelError,
}

func (r *reader) logLevel(key string) slog.Level {
	raw := strings.ToLower(r.optional(key, "info"))
	level, ok := logLevels[raw]
	if !ok {
		r.problems = append(r.problems, fmt.Sprintf("%s must be one of debug, info, warn, error (got %q)", key, raw))
		return slog.LevelInfo
	}
	return level
}

func (r *reader) s3() S3 {
	return S3{
		Endpoint:        r.required("S3_ENDPOINT"),
		Region:          r.optional("S3_REGION", "garage"),
		Bucket:          r.required("S3_BUCKET"),
		AccessKeyID:     r.required("S3_ACCESS_KEY_ID"),
		SecretAccessKey: r.required("S3_SECRET_ACCESS_KEY"),
	}
}

func (r *reader) err() error {
	if len(r.problems) == 0 {
		return nil
	}
	return errors.New("invalid configuration: " + strings.Join(r.problems, "; "))
}
