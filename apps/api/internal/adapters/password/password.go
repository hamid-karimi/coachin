// Package password hashes and verifies account passwords.
//
// New hashes are argon2id in the standard PHC string format. Accounts imported
// from Supabase carry bcrypt hashes ("$2a$…"); they still verify, and
// NeedsRehash tells the caller to upgrade them to argon2id after a login.
package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Params are argon2id costs. Defaults follow the OWASP recommendation
// (19 MiB memory, 2 iterations, 1 lane).
type Params struct {
	MemoryKiB  uint32
	Iterations uint32
	Threads    uint8
	SaltLen    uint32
	KeyLen     uint32
}

// DefaultParams are the production costs.
var DefaultParams = Params{MemoryKiB: 19 * 1024, Iterations: 2, Threads: 1, SaltLen: 16, KeyLen: 32}

// Hasher hashes with fixed params.
type Hasher struct{ params Params }

// New returns a hasher using params.
func New(params Params) *Hasher { return &Hasher{params: params} }

var b64 = base64.RawStdEncoding

// Hash returns an argon2id PHC string for plain.
func (h *Hasher) Hash(plain string) (string, error) {
	salt := make([]byte, h.params.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	p := h.params
	key := argon2.IDKey([]byte(plain), salt, p.Iterations, p.MemoryKiB, p.Threads, p.KeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, p.MemoryKiB, p.Iterations, p.Threads, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// ErrUnknownFormat means the stored hash is neither argon2id nor bcrypt.
var ErrUnknownFormat = errors.New("unknown password hash format")

// Verify reports whether plain matches encoded, and whether the hash should
// be replaced (legacy bcrypt, or argon2id with weaker params than current).
func (h *Hasher) Verify(plain, encoded string) (match, needsRehash bool, err error) {
	switch {
	case strings.HasPrefix(encoded, "$argon2id$"):
		return h.verifyArgon2(plain, encoded)
	case strings.HasPrefix(encoded, "$2a$"), strings.HasPrefix(encoded, "$2b$"), strings.HasPrefix(encoded, "$2y$"):
		err := bcrypt.CompareHashAndPassword([]byte(encoded), []byte(plain))
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, false, nil
		}
		return err == nil, true, err
	}
	return false, false, ErrUnknownFormat
}

func (h *Hasher) verifyArgon2(plain, encoded string) (match, needsRehash bool, err error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 {
		return false, false, ErrUnknownFormat
	}
	var version int
	var p Params
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, false, ErrUnknownFormat
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.MemoryKiB, &p.Iterations, &p.Threads); err != nil {
		return false, false, ErrUnknownFormat
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false, false, ErrUnknownFormat
	}
	want, err := b64.DecodeString(parts[5])
	if err != nil {
		return false, false, ErrUnknownFormat
	}
	got := argon2.IDKey([]byte(plain), salt, p.Iterations, p.MemoryKiB, p.Threads, uint32(len(want)))
	if subtle.ConstantTimeCompare(got, want) != 1 {
		return false, false, nil
	}
	weaker := p.MemoryKiB < h.params.MemoryKiB || p.Iterations < h.params.Iterations || p.Threads < h.params.Threads
	return true, weaker, nil
}
