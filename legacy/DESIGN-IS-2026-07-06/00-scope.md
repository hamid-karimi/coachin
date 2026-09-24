# Scope — Onboarding "add a sport session" form

**Audited surface:** `app/onboarding/components/AddScheduleForm.tsx` (the standalone
add-form) in the context of `app/onboarding/page.tsx` and
`app/onboarding/components/WeekAgenda.tsx` (the week it feeds).

**Primary user:** a new Coachin athlete setting up their training week during onboarding.

**Primary task:** compose a weekly routine — the header explicitly asks for "3+ days"
(`app/onboarding/components/PageHeader`-fed copy: "Pick a day, pick a sport, add it.
Aim for 3+ days.").

**Constraints:** Next.js App Router, Tailwind + tokens in `app/globals.css`
(`brand`, `brand-tint`, `brand-ink`, `secondary`, `border`, `muted-foreground`),
shadcn/ui, design-system `SportChip` / `SportIcon` (`components/design-system/sport-chip.tsx`).

**Input materials:** component source (read in full), `sport-chip.tsx`, a live screenshot
of the rendered form, and the converged redesign direction from the prior brainstorm.

**Reference designs:** none supplied; judged against generic scheduling-form conventions.
