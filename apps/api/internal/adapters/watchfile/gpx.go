package watchfile

import (
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"math"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// ParseGPX sums the haversine distance over the first track's points; the
// duration runs from the first to the last timestamp, and the heart rate
// averages every point's extension HR. The document is first read the way
// the legacy parser (fast-xml-parser) saw it, so the quirks carry over: only
// the first <trk> counts, and an HR is found only one level below
// <extensions> (Garmin's gpxtpx:hr / ns3:hr).
func ParseGPX(data []byte, now time.Time) (activity.Summary, bool) {
	doc, err := decodeXML(data)
	if err != nil {
		return activity.Summary{}, false
	}
	track := first(field(field(doc, "gpx"), "trk"))
	if !truthy(track) {
		return activity.Summary{}, false
	}

	var (
		distance, hrSum     float64
		hrCount             int
		firstTime, lastTime *time.Time
		prevLat, prevLon    float64
		hasPrev             bool
	)
	for _, segment := range asList(field(track, "trkseg")) {
		for _, point := range points(segment) {
			lat, lon := jsnum.ToNumber(field(point, "@_lat")), jsnum.ToNumber(field(point, "@_lon"))
			if !jsnum.IsFinite(lat) || !jsnum.IsFinite(lon) {
				continue
			}
			if hasPrev {
				distance += haversineMeters(prevLat, prevLon, lat, lon)
			}
			prevLat, prevLon, hasPrev = lat, lon, true
			if at, ok := jsDate(field(point, "time")); ok {
				if firstTime == nil {
					firstTime = &at
				}
				lastTime = &at
			}
			if hr, ok := pointHR(point); ok {
				hrSum += hr
				hrCount++
			}
		}
	}

	var duration float64
	if firstTime != nil && lastTime != nil {
		duration = float64(lastTime.Sub(*firstTime).Milliseconds()) / 1000
	}
	var hr *float64
	if hrCount > 0 {
		avg := hrSum / float64(hrCount)
		hr = &avg
	}
	return activity.FromTotals(firstTime, distance, duration, hr, "gpx", now)
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6371000
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Pow(math.Sin(dLat/2), 2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Pow(math.Sin(dLon/2), 2)
	return 2 * r * math.Asin(math.Sqrt(a))
}

// points is a segment's trkpt list: an array, one point, or none.
func points(segment any) []any {
	pts := field(segment, "trkpt")
	if list, ok := pts.([]any); ok {
		return list
	}
	if truthy(pts) {
		return []any{pts}
	}
	return nil
}

// pointHR is the first "…hr" value (case-insensitive) that is a finite number,
// looking one level inside each child of <extensions>.
func pointHR(point any) (float64, bool) {
	ext := field(point, "extensions")
	if !truthy(ext) {
		return 0, false
	}
	for _, wrapper := range values(ext) {
		inner, ok := wrapper.(*object)
		if !ok {
			continue // arrays hold only index keys, never "…hr"
		}
		for _, key := range inner.keys {
			if n := jsnum.ToNumber(inner.values[key]); strings.HasSuffix(strings.ToLower(key), "hr") && jsnum.IsFinite(n) {
				return n, true
			}
		}
	}
	return 0, false
}

// jsDate is JavaScript's new Date(v) for a parsed tag value.
func jsDate(v any) (time.Time, bool) {
	switch x := v.(type) {
	case string:
		for _, layout := range dateLayouts {
			if t, err := time.ParseInLocation(layout, strings.TrimSpace(x), time.UTC); err == nil {
				return t.Truncate(time.Millisecond), true // Date keeps milliseconds
			}
		}
	case float64:
		if jsnum.IsFinite(x) && x != 0 { // 0 is falsy: legacy skipped it
			return time.UnixMilli(int64(x)).UTC(), true
		}
	}
	return time.Time{}, false
}

// dateLayouts are the ISO forms Date parses; without a zone they are local
// time, which is UTC in the API container.
var dateLayouts = []string{
	time.RFC3339Nano,
	"2006-01-02T15:04:05.999999999",
	"2006-01-02T15:04",
	"2006-01-02",
}

// ---- the document as fast-xml-parser shaped it ------------------------------

// object is a parsed element with attributes ("@_name") and/or child elements
// (repeated children become arrays), keys in document order.
type object struct {
	keys   []string
	values map[string]any
}

func (o *object) set(key string, v any) {
	existing, found := o.values[key]
	switch {
	case !found:
		o.keys = append(o.keys, key)
		o.values[key] = v
	case isList(existing):
		o.values[key] = append(existing.([]any), v)
	default:
		o.values[key] = []any{existing, v}
	}
}

func isList(v any) bool {
	_, ok := v.([]any)
	return ok
}

// field is v[key] for a parsed object; anything else has no fields.
func field(v any, key string) any {
	if o, ok := v.(*object); ok {
		if value, found := o.values[key]; found {
			return value
		}
	}
	return jsnum.Missing{}
}

// first is the first entry of a list, or v itself.
func first(v any) any {
	if list, ok := v.([]any); ok {
		if len(list) == 0 {
			return jsnum.Missing{}
		}
		return list[0]
	}
	return v
}

// asList is v when it is a list, else [v].
func asList(v any) []any {
	if list, ok := v.([]any); ok {
		return list
	}
	return []any{v}
}

// values is Object.values for objects and arrays (strings never hold objects).
func values(v any) []any {
	switch x := v.(type) {
	case *object:
		out := make([]any, len(x.keys))
		for i, key := range x.keys {
			out[i] = x.values[key]
		}
		return out
	case []any:
		return x
	}
	return nil
}

// truthy is JavaScript truthiness for parsed values.
func truthy(v any) bool {
	switch x := v.(type) {
	case nil, jsnum.Missing:
		return false
	case string:
		return x != ""
	case float64:
		return x == x && x != 0 // NaN is falsy
	case bool:
		return x
	}
	return true
}

type element struct {
	name  string
	attrs []xml.Attr
	kids  []*element
	text  strings.Builder
}

// decodeXML reads the document into the parsed-value shape. Prefixes stay in
// names ("gpxtpx:hr"), as the legacy parser kept them.
func decodeXML(data []byte) (*object, error) {
	dec := xml.NewDecoder(bytes.NewReader(data))
	dec.Strict = false
	root := &element{}
	stack := []*element{root}
	for {
		tok, err := dec.RawToken()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		top := stack[len(stack)-1]
		switch t := tok.(type) {
		case xml.StartElement:
			el := &element{name: qualified(t.Name), attrs: t.Attr}
			top.kids = append(top.kids, el)
			stack = append(stack, el)
		case xml.EndElement:
			if len(stack) > 1 {
				stack = stack[:len(stack)-1]
			}
		case xml.CharData:
			top.text.Write(t)
		}
	}
	doc := &object{values: map[string]any{}}
	for _, el := range root.kids {
		doc.set(el.name, el.value())
	}
	return doc, nil
}

func qualified(name xml.Name) string {
	if name.Space == "" {
		return name.Local
	}
	return name.Space + ":" + name.Local
}

// value is the element as fast-xml-parser returns it: a leaf is its trimmed
// text (numbers and booleans parsed), anything else an object.
func (e *element) value() any {
	text := strings.TrimSpace(e.text.String())
	if len(e.kids) == 0 && len(e.attrs) == 0 {
		return tagValue(text)
	}
	o := &object{values: map[string]any{}}
	for _, attr := range e.attrs {
		o.set("@_"+qualified(attr.Name), attr.Value)
	}
	for _, kid := range e.kids {
		o.set(kid.name, kid.value())
	}
	if text != "" {
		o.set("#text", tagValue(text))
	}
	return o
}

// tagValue parses a leaf's text: booleans and plain decimal/hex numbers become
// values, everything else (dates included) stays a string.
func tagValue(text string) any {
	switch text {
	case "":
		return ""
	case "true":
		return true
	case "false":
		return false
	}
	if numberLike(text) {
		if n, ok := jsnum.Number(text); ok {
			return n
		}
	}
	return text
}

func numberLike(s string) bool {
	s = strings.TrimLeft(s, "+-")
	if strings.HasPrefix(strings.ToLower(s), "0x") {
		return len(s) > 2
	}
	digits := 0
	for i, r := range s {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case r == '.' || ((r == 'e' || r == 'E') && i > 0):
		default:
			return false
		}
	}
	return digits > 0
}
