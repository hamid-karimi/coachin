package config

import (
	"log/slog"
	"strings"
	"testing"
)

func envOf(vars map[string]string) Getenv {
	return func(key string) string { return vars[key] }
}

var validServerEnv = map[string]string{
	"DATABASE_URL":         "postgres://app@db/coachin",
	"AUTH_DATABASE_URL":    "postgres://auth@db/coachin",
	"APP_BASE_URL":         "http://localhost:8080/",
	"SMTP_HOST":            "mailpit",
	"MAIL_FROM":            "CoachIn <no-reply@coachin.local>",
	"S3_ENDPOINT":          "http://garage:3900",
	"S3_BUCKET":            "coachin-photos",
	"S3_ACCESS_KEY_ID":     "GK0123",
	"S3_SECRET_ACCESS_KEY": "secret",
}

func TestLoadServerDefaults(t *testing.T) {
	cfg, err := LoadServer(envOf(validServerEnv))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("HTTPAddr = %q, want :8080", cfg.HTTPAddr)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Errorf("LogLevel = %v, want info", cfg.LogLevel)
	}
	if cfg.S3.Region != "garage" {
		t.Errorf("S3.Region = %q, want garage", cfg.S3.Region)
	}
	if cfg.BaseURL != "http://localhost:8080" {
		t.Errorf("BaseURL = %q, want no trailing slash", cfg.BaseURL)
	}
	if cfg.CookieSecure || cfg.CommunityEnabled {
		t.Error("cookie security and community default to off")
	}
	if cfg.SMTP.Port != 587 || cfg.SMTP.TLS != "starttls" {
		t.Errorf("SMTP defaults = %d/%s, want 587/starttls", cfg.SMTP.Port, cfg.SMTP.TLS)
	}
}

func TestLoadServerRejectsBadEnums(t *testing.T) {
	env := map[string]string{"SMTP_TLS": "maybe", "COOKIE_SECURE": "sometimes", "FEATURE_COMMUNITY": "on"}
	for k, v := range validServerEnv {
		env[k] = v
	}
	_, err := LoadServer(envOf(env))
	if err == nil || !strings.Contains(err.Error(), "SMTP_TLS") || !strings.Contains(err.Error(), "COOKIE_SECURE") {
		t.Fatalf("err = %v", err)
	}
	delete(env, "SMTP_TLS")
	delete(env, "COOKIE_SECURE")
	cfg, err := LoadServer(envOf(env))
	if err != nil || !cfg.CommunityEnabled {
		t.Fatalf("FEATURE_COMMUNITY=on: %v %v", cfg.CommunityEnabled, err)
	}
}

func TestLoadServerReportsEveryMissingVariable(t *testing.T) {
	_, err := LoadServer(envOf(map[string]string{"LOG_LEVEL": "loud"}))
	if err == nil {
		t.Fatal("expected an error")
	}
	for _, want := range []string{"DATABASE_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "LOG_LEVEL"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %s", err, want)
		}
	}
}

func TestLoadGarageCapacity(t *testing.T) {
	env := map[string]string{
		"GARAGE_ADMIN_URL":   "http://garage:3903",
		"GARAGE_ADMIN_TOKEN": "token",
	}
	for k, v := range validServerEnv {
		env[k] = v
	}

	cfg, err := LoadGarage(envOf(env))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.CapacityBytes != 10<<30 {
		t.Errorf("CapacityBytes = %d, want 10 GiB", cfg.CapacityBytes)
	}

	env["GARAGE_CAPACITY_BYTES"] = "-1"
	if _, err := LoadGarage(envOf(env)); err == nil {
		t.Error("expected an error for a negative capacity")
	}
}

func TestLoadMigrateRequiresURL(t *testing.T) {
	if _, err := LoadMigrate(envOf(nil)); err == nil {
		t.Fatal("expected an error")
	}
	url, err := LoadMigrate(envOf(map[string]string{"MIGRATE_DATABASE_URL": "postgres://owner@db/coachin"}))
	if err != nil || url != "postgres://owner@db/coachin" {
		t.Fatalf("got %q, %v", url, err)
	}
}
