package auth

import (
	"bytes"
	"html/template"
	"io"
	"net/url"
	texttemplate "text/template"
)

// emailContent is what a template needs.
type emailContent struct {
	Name string
	Link string
}

var (
	verifyText = texttemplate.Must(texttemplate.New("verify").Parse(`Hi {{.Name}},

Welcome to CoachIn! Confirm your email address:

{{.Link}}

The link is valid for 7 days. If you didn't sign up, ignore this email.
`))
	verifyHTML = template.Must(template.New("verify").Parse(`<p>Hi {{.Name}},</p>
<p>Welcome to CoachIn! Confirm your email address:</p>
<p><a href="{{.Link}}">Confirm my email</a></p>
<p>The link is valid for 7 days. If you didn't sign up, ignore this email.</p>
`))
	resetText = texttemplate.Must(texttemplate.New("reset").Parse(`Hi {{.Name}},

Someone asked to reset your CoachIn password. Choose a new one here:

{{.Link}}

The link is valid for 1 hour. If this wasn't you, ignore this email; your password stays the same.
`))
	resetHTML = template.Must(template.New("reset").Parse(`<p>Hi {{.Name}},</p>
<p>Someone asked to reset your CoachIn password.</p>
<p><a href="{{.Link}}">Choose a new password</a></p>
<p>The link is valid for 1 hour. If this wasn't you, ignore this email; your password stays the same.</p>
`))
)

// templateExecutor is satisfied by both text/template and html/template.
type templateExecutor interface {
	Execute(w io.Writer, data any) error
}

// render executes a built-in template; they are parsed at init and take only
// strings, so execution cannot fail.
func render(t templateExecutor, data emailContent) string {
	var buf bytes.Buffer
	_ = t.Execute(&buf, data)
	return buf.String()
}

// link builds baseURL + path?token=….
func link(baseURL, path, token string) string {
	return baseURL + path + "?" + url.Values{"token": {token}}.Encode()
}
