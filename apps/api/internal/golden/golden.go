// Package golden loads the parity vectors in testdata/golden, generated from
// the legacy TypeScript formulas by scripts/golden/generate.ts (`make golden`).
// Domain tests replay them to prove the Go port computes the same results.
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
