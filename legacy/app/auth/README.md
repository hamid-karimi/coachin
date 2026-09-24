# Authentication Module

This module handles user sign-in and registration through Supabase Auth.

## Structure

- `components/`
  - `auth-container.tsx`: auth layout wrapper
  - `auth-shell.tsx`: split layout — desktop brand panel (left) + form column
  - `feature-slideshow.tsx`: auto-advancing what-the-system-does carousel in
    the brand panel. **Text + lucide icons only, no screenshots** — nothing
    to re-shoot when the UI changes, always on-brand via tokens. 5 slides ×
    ~5s, pauses on hover, clickable dots, `aria-roledescription="carousel"`.
    Desktop-only (the brand panel is hidden on mobile).
  - `submit-button.tsx`: submit button with pending state
- `login/`
  - `page.tsx`
  - `actions.ts`
- `register/`
  - `page.tsx`
  - `actions.ts`

## Validation and Behavior

- Registration validates required fields, password length, complexity, and confirmation.
- Login validates required credentials and email format.
- Server actions return normalized action-state responses.

## Notifications

- Transient auth feedback now uses global toast notifications.
- Inline transient error blocks were removed for consistency.

## Storybook

Initial coverage includes:

- `components/auth-container.stories.tsx`
