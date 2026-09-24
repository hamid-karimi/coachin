// Package activities reads run summaries from uploaded watch files (nothing
// is stored): the running wizard's "watch data" step and, later, the profile
// import.
package activities

import (
	"fmt"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
)

// Upload limits (as the legacy app).
const (
	MaxFiles     = 3
	MaxFileBytes = 4 << 20
)

// Upload is one submitted file; Data is nil when it is over MaxFileBytes.
type Upload struct {
	Name string
	Size int64
	Data []byte
}

// Parser reads a watch file by name and content.
type Parser interface {
	Parse(name string, data []byte) (activity.Summary, bool)
}

// Service parses uploads.
type Service struct {
	parser Parser
}

// NewService builds the service.
func NewService(parser Parser) *Service {
	return &Service{parser: parser}
}

// Parsed is the parse outcome: "success", or "info" when some files were skipped.
type Parsed struct {
	Status     string
	Message    string
	Activities []activity.Summary
}

// Parse reads each file; unreadable ones are reported, not fatal, unless none parse.
func (s *Service) Parse(uploads []Upload) (Parsed, error) {
	if len(uploads) == 0 {
		return Parsed{}, apperr.New(apperr.Invalid, "Choose at least one .fit or .gpx file")
	}
	if len(uploads) > MaxFiles {
		return Parsed{}, apperr.New(apperr.Invalid, fmt.Sprintf("Upload at most %d files at a time", MaxFiles))
	}
	summaries := []activity.Summary{}
	var failed []string
	for _, u := range uploads {
		if u.Size > MaxFileBytes || u.Data == nil {
			failed = append(failed, u.Name+": larger than 4MB")
			continue
		}
		summary, ok := s.parser.Parse(u.Name, u.Data)
		if !ok {
			failed = append(failed, u.Name+": could not parse (use .fit or .gpx exports)")
			continue
		}
		summaries = append(summaries, summary)
	}
	if len(summaries) == 0 {
		return Parsed{}, apperr.New(apperr.Invalid, strings.Join(failed, " · "))
	}

	noun := "runs"
	if len(summaries) == 1 {
		noun = "run"
	}
	parsed := Parsed{Status: "success", Message: fmt.Sprintf("%d %s parsed", len(summaries), noun), Activities: summaries}
	if len(failed) > 0 {
		parsed.Status = "info"
		parsed.Message += "; skipped — " + strings.Join(failed, " · ")
	}
	parsed.Message += "."
	return parsed, nil
}
