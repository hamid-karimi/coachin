// Package objectstore talks to any S3-compatible server (Garage locally and on
// the VPS; a managed bucket later is a config change).
package objectstore

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/hamid-karimi/coachin/apps/api/internal/config"
)

// Store is a single private bucket.
type Store struct {
	client *s3.Client
	bucket string
}

// New builds a client for cfg. It does not dial; call Ping to verify access.
func New(cfg config.S3) *Store {
	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(cfg.Endpoint),
		Region:       cfg.Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		// Garage (and most self-hosted servers) address buckets by path, not
		// by subdomain.
		UsePathStyle: true,
	})
	return &Store{client: client, bucket: cfg.Bucket}
}

// Ping confirms the bucket exists and the credentials can reach it.
func (s *Store) Ping(ctx context.Context) error {
	if _, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(s.bucket)}); err != nil {
		return fmt.Errorf("bucket %q unreachable: %w", s.bucket, err)
	}
	return nil
}
