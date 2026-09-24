package password

import (
	"errors"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

// fast keeps tests quick; production uses DefaultParams.
var fast = Params{MemoryKiB: 1024, Iterations: 1, Threads: 1, SaltLen: 16, KeyLen: 32}

func TestArgon2RoundTrip(t *testing.T) {
	h := New(fast)
	encoded, err := h.Hash("Correct-horse-9")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(encoded, "$argon2id$v=19$m=1024,t=1,p=1$") {
		t.Fatalf("unexpected encoding %q", encoded)
	}
	if other, _ := h.Hash("Correct-horse-9"); other == encoded {
		t.Error("two hashes of the same password must differ (random salt)")
	}
	match, rehash, err := h.Verify("Correct-horse-9", encoded)
	if err != nil || !match || rehash {
		t.Fatalf("Verify = %v, %v, %v", match, rehash, err)
	}
	if match, _, _ := h.Verify("wrong", encoded); match {
		t.Error("wrong password matched")
	}
}

func TestWeakerParamsNeedRehash(t *testing.T) {
	encoded, _ := New(fast).Hash("pw")
	match, rehash, err := New(DefaultParams).Verify("pw", encoded)
	if err != nil || !match || !rehash {
		t.Fatalf("Verify = %v, %v, %v; want match needing rehash", match, rehash, err)
	}
}

func TestLegacyBcryptVerifiesAndNeedsRehash(t *testing.T) {
	legacy, err := bcrypt.GenerateFromPassword([]byte("Supabase-pw1"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	h := New(fast)
	match, rehash, err := h.Verify("Supabase-pw1", string(legacy))
	if err != nil || !match || !rehash {
		t.Fatalf("Verify = %v, %v, %v; want match needing rehash", match, rehash, err)
	}
	match, _, err = h.Verify("nope", string(legacy))
	if err != nil || match {
		t.Fatalf("wrong password: match=%v err=%v", match, err)
	}
}

func TestUnknownFormat(t *testing.T) {
	if _, _, err := New(fast).Verify("pw", "plaintext"); !errors.Is(err, ErrUnknownFormat) {
		t.Fatalf("err = %v", err)
	}
}
