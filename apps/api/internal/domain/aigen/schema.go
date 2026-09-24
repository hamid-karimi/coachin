// Package aigen holds the pure side of AI generation: response schemas, the
// schema hint embedded in Claude prompts, JSON extraction from model text,
// and the training-plan prompts and output validation — ported verbatim from
// legacy/lib/ai (golden vectors in testdata/golden/ai.json).
package aigen

import (
	"bytes"
	"encoding/json"
)

// Type is a schema type as Gemini names it.
type Type string

// Schema types.
const (
	Object  Type = "OBJECT"
	Array   Type = "ARRAY"
	String  Type = "STRING"
	Number  Type = "NUMBER"
	Integer Type = "INTEGER"
	Boolean Type = "BOOLEAN"
)

// Schema is a response schema in Gemini's shape. Property order is kept: it
// is part of the prompt text Claude sees.
type Schema struct {
	Type        Type
	Description string
	Enum        []string
	Properties  []Property
	Items       *Schema
	Required    []string
	Nullable    bool
}

// Property is one named object field.
type Property struct {
	Name   string
	Schema Schema
}

var hintTypes = map[Type]string{
	Object: "object", Array: "array", String: "string", Number: "number", Integer: "integer", Boolean: "boolean",
}

// Hint is the JSON-Schema-like description of s embedded in Claude prompts
// (legacy geminiSchemaToHint, serialized like JSON.stringify).
func Hint(s Schema) string {
	var b bytes.Buffer
	writeHint(&b, s)
	return b.String()
}

func writeHint(b *bytes.Buffer, s Schema) {
	b.WriteByte('{')
	first := true
	field := func(name string) {
		if !first {
			b.WriteByte(',')
		}
		first = false
		writeJSON(b, name)
		b.WriteByte(':')
	}
	if s.Type != "" {
		t, ok := hintTypes[s.Type]
		if !ok {
			t = "string"
		}
		field("type")
		if s.Nullable {
			writeJSON(b, []string{t, "null"})
		} else {
			writeJSON(b, t)
		}
	}
	if s.Description != "" {
		field("description")
		writeJSON(b, s.Description)
	}
	if s.Enum != nil {
		field("enum")
		writeJSON(b, s.Enum)
	}
	if s.Properties != nil {
		field("properties")
		b.WriteByte('{')
		for i, p := range s.Properties {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSON(b, p.Name)
			b.WriteByte(':')
			writeHint(b, p.Schema)
		}
		b.WriteByte('}')
	}
	if s.Items != nil {
		field("items")
		writeHint(b, *s.Items)
	}
	if len(s.Required) > 0 {
		field("required")
		writeJSON(b, s.Required)
	}
	b.WriteByte('}')
}

// writeJSON encodes like JSON.stringify: no HTML escaping.
func writeJSON(b *bytes.Buffer, v any) {
	enc := json.NewEncoder(b)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)       // strings and string slices always encode
	b.Truncate(b.Len() - 1) // Encode appends a newline
}
