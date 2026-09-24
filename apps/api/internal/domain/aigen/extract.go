package aigen

import (
	"regexp"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

var fenced = regexp.MustCompile("(?is)```(?:json)?\\s*(.*?)\\s*```")

// ExtractJSON pulls a JSON object or array out of model text: bare JSON,
// a ```json fenced block, or JSON inside prose (first opening brace or
// bracket to its last matching closer). ok is false when none is found.
func ExtractJSON(text string) (string, bool) {
	trimmed := jsnum.Trim(text)
	if trimmed == "" {
		return "", false
	}
	body := trimmed
	if m := fenced.FindStringSubmatch(trimmed); m != nil {
		body = jsnum.Trim(m[1])
	}
	if (strings.HasPrefix(body, "{") && strings.HasSuffix(body, "}")) ||
		(strings.HasPrefix(body, "[") && strings.HasSuffix(body, "]")) {
		return body, true
	}
	firstObj, firstArr := strings.IndexByte(body, '{'), strings.IndexByte(body, '[')
	start := firstObj
	if start == -1 || (firstArr != -1 && firstArr < start) {
		start = firstArr
	}
	if start == -1 {
		return "", false
	}
	closer := byte('}')
	if body[start] == '[' {
		closer = ']'
	}
	end := strings.LastIndexByte(body, closer)
	if end <= start {
		return "", false
	}
	return body[start : end+1], true
}
