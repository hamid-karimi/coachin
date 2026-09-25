// Package golden loads the parity vectors in testdata/golden. They were first
// generated from the legacy TypeScript formulas and are owned by the Go code now:
// a formula change edits the code, its vectors, and FORMULAS.md together.
package golden

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type file[T any] struct {
	Topic string `json:"topic"`
	Cases []T    `json:"cases"`
}

// Load decodes every case of testdata/golden/<topic>.json into T.
func Load[T any](t testing.TB, topic string) []T {
	t.Helper()
	path := filepath.Join(root(t), "testdata", "golden", topic+".json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden vectors: %v", err)
	}
	var f file[T]
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
	if len(f.Cases) == 0 {
		t.Fatalf("%s has no cases", path)
	}
	return f.Cases
}

// root walks up from the test's working directory to the repository root.
func root(t testing.TB) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "testdata", "golden")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("testdata/golden not found above the working directory")
		}
		dir = parent
	}
}

// ReadFile reads a fixture by its path from the repository root
// (e.g. "testdata/activity/run-5k.fit").
func ReadFile(t testing.TB, rel string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(root(t), filepath.FromSlash(rel)))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	return data
}
