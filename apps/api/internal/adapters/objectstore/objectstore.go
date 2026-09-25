// Package objectstore talks to any S3-compatible server (Garage locally and on
// the VPS; a managed bucket later is a config change).
package objectstore

import (
	"bytes"
	"context"
	"fmt"
	"io"

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

// Put stores an object (overwriting any at key).
func (s *Store) Put(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket), Key: aws.String(key), Body: bytes.NewReader(data),
		ContentType: aws.String(contentType), ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return fmt.Errorf("put %q: %w", key, err)
	}
	return nil
}

// Get opens an object for reading; the caller closes it.
func (s *Store) Get(ctx context.Context, key string) (io.ReadCloser, int64, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, 0, fmt.Errorf("get %q: %w", key, err)
	}
	return out.Body, aws.ToInt64(out.ContentLength), nil
}

// Delete removes an object; a missing one is not an error.
func (s *Store) Delete(ctx context.Context, key string) error {
	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)}); err != nil {
		return fmt.Errorf("delete %q: %w", key, err)
	}
	return nil
}
