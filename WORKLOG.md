# Work log

Running journal for session continuity. Newest entry first. Each entry: date ·
branch · what was done · decisions · next steps. Rules in `CLAUDE.md` § Work log.

---

## 2026-07-08 · `feat/meal-plan-surfacing-supplements`

**Done** (commit `1cfced7`, + docs/process commit after it):

- Dashboard "Today's meals" card: today's menu from the active AI meal plan
  (kcal vs target) linking to `/nutrition/plan`; hidden without an active plan.
- Calendar: per-day "N meals planned · X kcal" link on every day cell.
- Shared loader `app/nutrition/lib/meal-plan-day.ts` (weekday-keyed menu).
- "Daily stack" supplements habit: `supplements` + `supplement_logs` tables
  (migration `20260708090000_supplements.sql`, self-only RLS, unique per
  supplement per day), dashboard checklist card with add/delete manage sheet.
- Process: CLAUDE.md gained the QA-doc rule and this work-log rule;
  QA-ONBOARDING.md updated for meal-plan surfacing + supplements.

**Decisions**

- Supplements award **no XP/streaks/hearts** (FORMULAS.md §13) — too easy to
  fake-log; revisit as a card-local streak if the habit sticks.
- Calendar shows a meals *link*, not full meals — menu repeats weekly, cells
  stay training-first.
- "Reminder" = presence on Today with a pending count; push notifications are
  out of scope (no infra).

**Next steps**

- [ ] Push `feat/meal-plan-surfacing-supplements` and open PR → `develop`.
- [ ] Apply migration `20260708090000_supplements.sql` to hosted Supabase
      after merge.
- [ ] Deploy to Vercel (guide in progress — see session notes; env vars:
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      GEMINI_API_KEY, CLAUDE_API_KEY, USDA_API_KEY; do NOT copy
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY — unused in code and unsafe with
      the NEXT_PUBLIC_ prefix; remove/rotate it).
- Ideas parked: per-date meal adherence on calendar; supplement schedules
  (times / training-days-only); coach visibility of the supplement stack.

## 2026-07-07 · `feat/ranked-improvements` (merged → develop as PR #48)

**Done** — six phases, plan in `plans/ranked-improvements-plan.md`:

1. Short plan-item titles + `plan_items.description` (+ backfill migration).
2. Calendar routine rows tappable → "Log it on Today" sheet.
3. Onboarding add-commitment: 2-step bottom sheet, always-enabled Add with
   pointing validation, 12 new sports seeded.
4. Hevy-style per-set logging (`lib/workout-sets.ts`), total-volume
   celebration ("that's a small car 🚗"), volume NOT in XP (FORMULAS §12).
5. Coach arc: coach generates AI plans for trainees
   (`/training/new?student=<id>`, `created_by`, RPC relationship check) +
   trainee opt-in nutrition sharing (RLS) + coach 7-day nutrition view.
6. `QA-ONBOARDING.md` + README/FORMULAS updates.

**Decisions**: coach plans apply directly (no trainee acceptance); diet
sharing = full log access, opt-in, revocable; QA deliverable = markdown doc.

**State**: merged; migrations `20260707120000/121000/130000/131000` applied
to hosted Supabase by Hamid.
