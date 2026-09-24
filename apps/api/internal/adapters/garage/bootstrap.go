// Package garage bootstraps a single-node Garage server through its admin API
// (v2): assign the storage layout, create the app's bucket, import the app's
// access key, and grant it read/write. Every step is idempotent, so the
// one-shot `storage-init` container can run on every `docker compose up`.
package garage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/config"
)

// Bootstrapper drives the admin API.
type Bootstrapper struct {
	cfg    config.Garage
	http   *http.Client
	logger *slog.Logger
	// Wait between readiness polls; tests shorten it.
	pollInterval time.Duration
}

// NewBootstrapper returns a bootstrapper for cfg.
func NewBootstrapper(cfg config.Garage, logger *slog.Logger) *Bootstrapper {
	return &Bootstrapper{
		cfg:          cfg,
		http:         &http.Client{Timeout: 10 * time.Second},
		logger:       logger,
		pollInterval: time.Second,
	}
}

var errNotFound = errors.New("not found")

// Run brings the node to the desired state.
func (b *Bootstrapper) Run(ctx context.Context) error {
	nodeID, err := b.waitForNode(ctx)
	if err != nil {
		return err
	}
	if err := b.ensureLayout(ctx, nodeID); err != nil {
		return err
	}
	bucketID, err := b.ensureBucket(ctx)
	if err != nil {
		return err
	}
	if err := b.ensureKey(ctx); err != nil {
		return err
	}
	return b.allowKey(ctx, bucketID)
}

type clusterStatus struct {
	Nodes []struct {
		ID   string `json:"id"`
		IsUp bool   `json:"isUp"`
	} `json:"nodes"`
}

// waitForNode polls until the admin API answers with a live node.
func (b *Bootstrapper) waitForNode(ctx context.Context) (string, error) {
	for {
		var status clusterStatus
		err := b.call(ctx, http.MethodGet, "/v2/GetClusterStatus", nil, &status)
		if err == nil && len(status.Nodes) > 0 && status.Nodes[0].IsUp {
			return status.Nodes[0].ID, nil
		}
		b.logger.Info("waiting for garage", "error", err)
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("garage not ready: %w", ctx.Err())
		case <-time.After(b.pollInterval):
		}
	}
}

type clusterLayout struct {
	Version int `json:"version"`
	Roles   []struct {
		ID string `json:"id"`
	} `json:"roles"`
}

func (b *Bootstrapper) ensureLayout(ctx context.Context, nodeID string) error {
	var layout clusterLayout
	if err := b.call(ctx, http.MethodGet, "/v2/GetClusterLayout", nil, &layout); err != nil {
		return err
	}
	if len(layout.Roles) > 0 {
		return nil
	}

	b.logger.Info("assigning garage layout", "node", nodeID, "capacity_bytes", b.cfg.CapacityBytes)
	update := map[string]any{
		"roles": []map[string]any{{
			"id":       nodeID,
			"zone":     "local",
			"capacity": b.cfg.CapacityBytes,
			"tags":     []string{},
		}},
	}
	if err := b.call(ctx, http.MethodPost, "/v2/UpdateClusterLayout", update, nil); err != nil {
		return err
	}
	return b.call(ctx, http.MethodPost, "/v2/ApplyClusterLayout", map[string]int{"version": layout.Version + 1}, nil)
}

type bucketInfo struct {
	ID string `json:"id"`
}

func (b *Bootstrapper) ensureBucket(ctx context.Context) (string, error) {
	var info bucketInfo
	path := "/v2/GetBucketInfo?globalAlias=" + url.QueryEscape(b.cfg.S3.Bucket)
	err := b.call(ctx, http.MethodGet, path, nil, &info)
	if err == nil {
		return info.ID, nil
	}
	if !errors.Is(err, errNotFound) {
		return "", err
	}

	b.logger.Info("creating bucket", "bucket", b.cfg.S3.Bucket)
	err = b.call(ctx, http.MethodPost, "/v2/CreateBucket", map[string]string{"globalAlias": b.cfg.S3.Bucket}, &info)
	return info.ID, err
}

func (b *Bootstrapper) ensureKey(ctx context.Context) error {
	path := "/v2/GetKeyInfo?id=" + url.QueryEscape(b.cfg.S3.AccessKeyID)
	err := b.call(ctx, http.MethodGet, path, nil, nil)
	if err == nil || !errors.Is(err, errNotFound) {
		return err
	}

	b.logger.Info("importing access key", "access_key_id", b.cfg.S3.AccessKeyID)
	return b.call(ctx, http.MethodPost, "/v2/ImportKey", map[string]string{
		"accessKeyId":     b.cfg.S3.AccessKeyID,
		"secretAccessKey": b.cfg.S3.SecretAccessKey,
		"name":            "coachin-api",
	}, nil)
}

func (b *Bootstrapper) allowKey(ctx context.Context, bucketID string) error {
	return b.call(ctx, http.MethodPost, "/v2/AllowBucketKey", map[string]any{
		"bucketId":    bucketID,
		"accessKeyId": b.cfg.S3.AccessKeyID,
		"permissions": map[string]bool{"read": true, "write": true, "owner": false},
	}, nil)
}

// call sends one admin request; a 404 maps to errNotFound.
func (b *Bootstrapper) call(ctx context.Context, method, path string, in, out any) error {
	var body io.Reader
	if in != nil {
		payload, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, b.cfg.AdminURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+b.cfg.AdminToken)
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := b.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return errNotFound
	}
	if resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("garage %s %s: %d %s", method, path, resp.StatusCode, bytes.TrimSpace(msg))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
