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
