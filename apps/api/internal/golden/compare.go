package golden

import (
	"encoding/json"
	"testing"
)

// OrNull encodes a (value, ok) result the way the legacy code returned it:
// the value, or null when ok is false.
func OrNull[T any](v T, ok bool) any {
	if !ok {
		return nil
	}
	return v
}

// Equal reports whether got, once JSON-encoded, equals the vector's want.
// Comparing decoded values makes 245 and 245.0 equal.
func Equal(t testing.TB, got any, want json.RawMessage) (bool, string) {
	t.Helper()
	gotJSON, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	return canonical(t, gotJSON) == canonical(t, want), string(gotJSON)
}

func canonical(t testing.TB, raw []byte) string {
	t.Helper()
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	out, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(out)
}

// Decode unmarshals one raw vector field, failing the test on error.
func Decode[T any](t testing.TB, raw json.RawMessage) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	return v
}
