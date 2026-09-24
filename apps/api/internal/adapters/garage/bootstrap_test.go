package garage

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/config"
)

// fakeGarage is an in-memory admin API that records mutating calls.
type fakeGarage struct {
	mu            sync.Mutex
	readyAfter    int // GetClusterStatus calls answered "down" first
	statusCalls   int
	layoutVersion int
	hasRole       bool
	bucketID      string
	keyImported   bool
	mutations     []string
}

func (f *fakeGarage) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if r.Header.Get("Authorization") != "Bearer token" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if r.Method == http.MethodPost {
		f.mutations = append(f.mutations, r.URL.Path)
	}

	write := func(v any) { _ = json.NewEncoder(w).Encode(v) }
	notFound := func() { w.WriteHeader(http.StatusNotFound) }

	switch r.URL.Path {
	case "/v2/GetClusterStatus":
		f.statusCalls++
		write(map[string]any{"nodes": []map[string]any{{"id": "node-1", "isUp": f.statusCalls > f.readyAfter}}})
	case "/v2/GetClusterLayout":
		roles := []map[string]string{}
		if f.hasRole {
			roles = append(roles, map[string]string{"id": "node-1"})
		}
		write(map[string]any{"version": f.layoutVersion, "roles": roles})
	case "/v2/UpdateClusterLayout":
		write(map[string]any{})
	case "/v2/ApplyClusterLayout":
		var body struct{ Version int }
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.layoutVersion, f.hasRole = body.Version, true
		write(map[string]any{})
	case "/v2/GetBucketInfo":
		if f.bucketID == "" {
			notFound()
			return
		}
		write(map[string]string{"id": f.bucketID})
	case "/v2/CreateBucket":
		f.bucketID = "bucket-1"
		write(map[string]string{"id": f.bucketID})
	case "/v2/GetKeyInfo":
		if !f.keyImported {
			notFound()
			return
		}
		write(map[string]any{})
	case "/v2/ImportKey":
		f.keyImported = true
		write(map[string]any{})
	case "/v2/AllowBucketKey":
		write(map[string]any{})
	default:
		notFound()
	}
}

func newTestBootstrapper(url string) *Bootstrapper {
	b := NewBootstrapper(config.Garage{
		AdminURL:      url,
		AdminToken:    "token",
		CapacityBytes: 1 << 30,
		S3:            config.S3{Bucket: "coachin-photos", AccessKeyID: "GK1", SecretAccessKey: "s"},
	}, slog.New(slog.DiscardHandler))
	b.pollInterval = time.Millisecond
	return b
}

func TestBootstrapIsIdempotent(t *testing.T) {
	fake := &fakeGarage{readyAfter: 2}
	srv := httptest.NewServer(fake)
	defer srv.Close()
	b := newTestBootstrapper(srv.URL)

	if err := b.Run(context.Background()); err != nil {
		t.Fatalf("first run: %v", err)
	}
	first := []string{"/v2/UpdateClusterLayout", "/v2/ApplyClusterLayout", "/v2/CreateBucket", "/v2/ImportKey", "/v2/AllowBucketKey"}
	if !slices.Equal(fake.mutations, first) {
		t.Fatalf("first run mutations = %v, want %v", fake.mutations, first)
	}
	if fake.layoutVersion != 1 {
		t.Errorf("layout version = %d, want 1", fake.layoutVersion)
	}

	fake.mutations = nil
	if err := b.Run(context.Background()); err != nil {
		t.Fatalf("second run: %v", err)
	}
	// Only the (idempotent) grant is re-sent; nothing is re-created.
	if !slices.Equal(fake.mutations, []string{"/v2/AllowBucketKey"}) {
		t.Fatalf("second run mutations = %v", fake.mutations)
	}
}

func TestBootstrapGivesUpWhenContextEnds(t *testing.T) {
	fake := &fakeGarage{readyAfter: 1 << 30}
	srv := httptest.NewServer(fake)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if err := newTestBootstrapper(srv.URL).Run(ctx); err == nil {
		t.Fatal("expected a timeout error")
	}
}
