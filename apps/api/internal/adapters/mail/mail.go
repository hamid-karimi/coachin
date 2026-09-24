// Package mail sends transactional email over SMTP: Mailpit locally, any SMTP
// provider on the VPS.
package mail

import (
	"context"
	"fmt"
	"time"

	gomail "github.com/wneessen/go-mail"

	"github.com/hamid-karimi/coachin/apps/api/internal/config"
)

// Message is one email with plain-text and HTML bodies.
type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

// SMTP delivers messages through one SMTP server.
type SMTP struct {
	cfg config.SMTP
}

// NewSMTP returns a sender for cfg; it connects per message.
func NewSMTP(cfg config.SMTP) *SMTP { return &SMTP{cfg: cfg} }

// tlsPolicies maps SMTP_TLS values to connection settings.
var tlsPolicies = map[string][]gomail.Option{
	"none":     {gomail.WithTLSPolicy(gomail.NoTLS)},
	"starttls": {gomail.WithTLSPolicy(gomail.TLSMandatory)},
	"tls":      {gomail.WithSSL()},
}

// Send delivers msg or returns why it couldn't.
func (s *SMTP) Send(ctx context.Context, msg Message) error {
	m := gomail.NewMsg()
	if err := m.From(s.cfg.From); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	if err := m.To(msg.To); err != nil {
		return fmt.Errorf("mail to: %w", err)
	}
	m.Subject(msg.Subject)
	m.SetBodyString(gomail.TypeTextPlain, msg.Text)
	if msg.HTML != "" {
		m.AddAlternativeString(gomail.TypeTextHTML, msg.HTML)
	}

	opts := []gomail.Option{gomail.WithPort(s.cfg.Port), gomail.WithTimeout(15 * time.Second)}
	opts = append(opts, tlsPolicies[s.cfg.TLS]...)
	if s.cfg.Username != "" {
		opts = append(opts,
			gomail.WithSMTPAuth(gomail.SMTPAuthPlain),
			gomail.WithUsername(s.cfg.Username),
			gomail.WithPassword(s.cfg.Password))
	}
	client, err := gomail.NewClient(s.cfg.Host, opts...)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	if err := client.DialAndSendWithContext(ctx, m); err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return nil
}
