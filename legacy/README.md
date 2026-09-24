> **Legacy app — read-only reference.** This is the Next.js + Supabase app that still runs
> on `main` / `develop`. On the rewrite branch it is kept only as the reference for porting
> to `apps/api` + `apps/web`, and is deleted at cutover. See
> [`plans/go-backend-rewrite/`](../plans/go-backend-rewrite/).

# CoachIn

CoachIn is a Next.js fitness app for weekly planning, workout logging, social leaderboards, and coach-student collaboration.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (Auth, Postgres, RLS)
- Sonner (toast notifications)
- Storybook 10 (`@storybook/nextjs-vite`)

## Core Features

- Authentication (`/auth/login`, `/auth/register`)
- Weekly schedule onboarding (`/onboarding`)
- Daily dashboard with workout logging and XP progression (`/dashboard`)
- Community module (`/community`):
  - Leaderboards: `Global League`, `My Club`, `My Circle`
  - Coach-student management via invite codes
  - Club memberships (create/join/leave/set primary)
  - Following and user discovery

## Recent Updates (February 2026)

### 1) Add-Coach reliability fix

A root-cause fix was applied for the case where students saw success but no coach was actually added.

- Added deterministic join statuses in DB RPC:
  - `created`
  - `already_connected`
  - `reactivated`
- App actions now map statuses correctly:
  - New connection => success toast
  - Existing connection => info toast (no false positive)

Migration:
- `supabase/migrations/20260215143000_fix_join_coach_statuses.sql`

### 2) English-only user messaging

User-visible messages were standardized to English across:

- UI labels and placeholders
- Server action messages
- API error payloads
- RPC fallback errors

Migration:
- `supabase/migrations/20260215144500_translate_rpc_error_messages.sql`

### 3) Unified toast system (shadcn-compatible Sonner)

- Global toaster mounted in `app/layout.tsx`
- Shared hook for action results: `components/hooks/use-action-toast.ts`
- Success/error/info feedback migrated from inline transient messages to toast in auth, onboarding, dashboard, and community flows

### 4) Storybook baseline and component stories

Storybook setup:
- `.storybook/main.ts`
- `.storybook/preview.js`
- `npm run storybook`
- `npm run build-storybook`

Initial stories are available for key UI modules, including interactive component previews.

## Project Structure

- `app/auth`: authentication pages + server actions
- `app/onboarding`: weekly schedule setup flow
- `app/dashboard`: daily missions + workout logging
- `app/community`: social + coaching module
- `components/ui`: shared UI primitives
- `components/hooks`: shared client hooks
- `lib/supabase`: server/client Supabase helpers
- `supabase/migrations`: schema + RLS + RPC migrations

## Setup

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Storybook

```bash
npm run storybook
npm run build-storybook
```
