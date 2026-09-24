// Package watchfile reads run summaries from watch exports: FIT (Garmin's
// binary format, via muktihari/fit) and GPX (XML track points). Ports of the
// legacy lib/activity-parse.ts, replayed against its outputs in
// testdata/golden/activity-files.json.
package watchfile

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
)

// Parser reads watch files; now dates a FIT file without a start time.
type Parser struct {
	now func() time.Time
}

// New builds a parser; now defaults to time.Now.
func New(now func() time.Time) *Parser {
	if now == nil {
		now = time.Now
	}
	return &Parser{now: now}
}

var parsers = map[string]func(data []byte, now time.Time) (activity.Summary, bool){
	".fit": ParseFIT,
	".gpx": ParseGPX,
}

// Parse picks the format by file extension; ok is false for other files and
// for files that don't hold a run of at least 200 m and 60 s.
func (p *Parser) Parse(name string, data []byte) (activity.Summary, bool) {
	parse, known := parsers[strings.ToLower(filepath.Ext(name))]
	if !known {
		return activity.Summary{}, false
	}
	return parse(data, p.now())
}
