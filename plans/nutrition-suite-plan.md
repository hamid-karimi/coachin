# Nutrition Suite — Phased Implementation Plan

AI meal planning + full macro/micro tracking + logging fixes. Each phase is
self-contained, executable in a fresh context, and ships as its **own PR** off
`develop`. Builds on the merged onboarding work (commit with `lib/plan-items.ts`
`planItemVideoUrl` — reused for recipe video links).

---

## Context & locked decisions

The current nutrition surface (`app/nutrition/`) already logs meals by search /
photo / manual, stores `protein_g/carbs_g/fat_g`, and sums them for "today".
The photo AI already returns per-item macros; the review UI just hides them.
Rich meal-plan inputs already exist (profile metrics, AI body-photo analysis,
training load, calorie goal).

Product decisions locked with the owner:

1. **Meal-plan gating:** a **dedicated nutrition intake wizard**, with a *soft,
   dismissible* suggestion to build a training plan first — **never a hard gate**.
2. **Meal-plan output:** a **full 7-day menu** + grocery list + **YouTube recipe
   links** per meal. Items are editable and per-day regenerable (escape hatch:
   people rarely follow rigid menus).
3. **Nutrient scope:** **P/C/F + sugar + fiber + sodium** (P/C/F already stored).

**Design verdict (Dieter Rams audit): REFINE.** Solid bones; real gaps —
repeat-logging friction, grams-only mental math (#2 useful), review sheet hides
macros, truncated number inputs mislead (#8 thorough / honesty). No structural
redesign warranted.

**Sequencing rationale:** Phases 0–2 fix the reported bugs and make macros
visible with no AI and low risk; Phase 3's deterministic target math is a
prerequisite the Phase 4 menu generator consumes.

---

## Phase 0 — Documentation Discovery (cite before use)

**Database (`supabase/migrations/20260705120000_nutrition.sql`):**
- `foods` — `id, name, kcal_per_100g, protein_g, carbs_g, fat_g, source, created_by` (all macro cols `numeric NOT NULL DEFAULT 0 CHECK >= 0`).
- `meal_logs` — `id, user_id, date, meal_type, food_id?, free_text, quantity_g, kcal (CHECK 0..5000), protein_g, carbs_g, fat_g, entry_method, photo_estimate (jsonb), created_at`. Owner-only RLS (`user_id = auth.uid()` on select/insert/delete). Index `meal_logs_user_date_idx (user_id, date DESC)`.
- RPC `award_meal_xp(p_meal_log_id)` — +5 XP, 3/day cap, idempotent via reason `'meal_log:{id}'` (copy this body for any new XP award).
- RPC `award_day_adherence(p_date)` — settles the +30 calorie-goal bonus.
- Physical inputs: `profiles(birth_date, sex, height_cm, weight_kg, training_history)` (`20260704150000_profiles_body_metrics.sql`); `body_photos.analysis jsonb {build_notes, posture_notes}, analyzed_at` (`20260704170000_body_photos.sql`); `goals(goal_type, target_value, status)` with `goal_type='calorie_intake'` + `achieve_goal` (+200, `20260704160000_goals.sql`).
- Training load: `training_plans(intake jsonb, weeks_total, created_at, status)` + `plan_items` (`20260705100000_training_plans.sql`).

**Server / actions:**
- Action-state pattern: `useActionState` + `NutritionActionState {error?, success?, message?, status?, estimate?}` + `useActionToast` — `app/nutrition/actions.ts`, `app/nutrition/components/meal-logger.tsx`.
- Log paths: `logMealAction` (search / USDA / manual), `estimateMealPhotoAction` (never persists), `confirmPhotoMealsAction` (persists reviewed items) — `app/nutrition/actions.ts`.
- Food search API: local `foods` ilike first, USDA `?remote=1` on demand — `app/nutrition/api/foods/route.ts` (USDA nutrient numbers: kcal `208`, protein `203`, carbs `205`, fat `204`; **add** sugar `269`, fiber `291`, sodium `307`).

**AI (`lib/ai/`):**
- `getGeminiClient()` / `getGeminiModel()` — `lib/ai/gemini.ts` (also `analyzeBodyPhotos`, `extractReportMetrics`).
- Gemini structured output pattern (`responseMimeType: "application/json"`, `responseSchema`) — `lib/ai/nutrition.ts` (`estimateMealFromPhoto`), `lib/ai/marathon.ts`.
- **Never trust AI shapes** — validate field-by-field like `estimateMealFromPhoto`'s mapper / marathon's `validateItems`.
- Target math to mirror: `lib/ai/hypertrophy.ts` already derives daily protein from the calorie goal.

**UI / reuse:**
- `planItemVideoUrl(details)` → YouTube-search "Watch how" link — `lib/plan-items.ts` (reuse for recipe videos).
- Vertical day agenda pattern — `app/onboarding/components/WeekAgenda.tsx` (reuse for the menu view).
- `BottomSheet` (mobile sheet / desktop dialog) — `components/design-system/bottom-sheet.tsx`.
- Design-system: `Progress`, `stat-card`, `tabs`, `sport-chip`, tokens in `app/globals.css`.

**Anti-patterns (enforce every phase):**
- ❌ LLM-emitted YouTube URLs (hallucinated IDs) — emit `video_query` strings, link to YouTube **search** (matches existing repo rule).
- ❌ Auto-saving AI estimates — user always reviews/edits before persist.
- ❌ New tables without owner-only RLS — copy the `meal_logs` policy trio.
- ❌ Non-idempotent XP — unique `xp_transactions.reason` + exists-check.
- ❌ Required fields in logging — everything beyond name+kcal stays optional.
- ❌ Formula math in components or AI prompts — targets live in `lib/`, documented in `FORMULAS.md`.

---

## Phase 1 — Logging fixes: units, truncation, searchable add-item (PR #1)

The three reported bugs. No migration (unless persisting display units). Fast, safe.

**What to implement:**
1. **`lib/food-units.ts`** (pure, tested): `UNIT_TO_GRAMS` lookup (`g, ml, tsp≈5, tbsp≈15, cup≈240, slice, piece, handful, …`, with density notes where oil/liquids differ) + `toGrams(qty, unit): number`. Unit-tested incl. unknown-unit fallback to grams.
2. **Unit selector** beside every amount field (search, manual, photo-review) — a compact `<select>`; convert to grams on submit so all downstream kcal/macro math is unchanged. (Optional: persist `serving_unit text` + `serving_qty numeric` on `meal_logs` so a row reads "2 tbsp · 27g" — migration + `MealRow`.)
3. **Truncation fix:** widen amount/kcal inputs in the photo-review sheet — `w-16` → `w-20 min-w-16`, `text-right` — `app/nutrition/components/meal-logger.tsx` (~lines 454, 470). Bug shows "220g" as "22"; it's an honesty defect.
4. **`<FoodSearchField>`** design-system component (+ story): extract the existing debounced local→USDA autocomplete out of `meal-logger.tsx` search mode; reuse it in **Manual** mode and the **photo-review "Add item"** so "2 tbsp olive oil" autocompletes and prefills macros.

**Verification:** `pnpm exec tsc --noEmit`; `pnpm exec eslint app/nutrition lib`; `pnpm test`; Storybook renders `FoodSearchField`; manual check: 220 g displays fully, add-item searches, tbsp converts.

**Anti-pattern guards:** conversions in `lib/` (framework-free, tested); no required fields added.

---

## Phase 2 — Full nutrient detection & per-meal display (PR #2)

Request #2a — surface hidden macros and extend to sugar/fiber/sodium.

**What to implement:**
1. **Migration** `supabase/migrations/<ts>_nutrition_micros.sql`: add `sugar_g, fiber_g, sodium_mg numeric DEFAULT 0 CHECK >= 0` to `meal_logs` and `foods`. No RLS change (inherit).
2. **AI + USDA:** extend `estimateMealFromPhoto` responseSchema + mapper (`lib/ai/nutrition.ts`) and the USDA nutrient map (`app/nutrition/api/foods/route.ts`, numbers 269/291/307) with validation/clamping.
3. **Actions:** thread the three fields through `logMealAction`, `confirmPhotoMealsAction`, manual inputs (`app/nutrition/actions.ts`).
4. **Display:** show full macro chips per meal in `MealRow` (today: protein only) and per row in the photo-review sheet (AI already returns P/C/F); add sugar/fiber/sodium to the day summary (`app/nutrition/page.tsx`).
5. **FORMULAS.md:** document nutrient rounding (1-decimal grams, integer mg).

**Verification:** migration applies; tsc/eslint/test; log via each path → all six nutrients persist and render; USDA import backfills micros.

---

## Phase 3 — Nutrition targets engine + close-the-loop (PR #3)

Deterministic target math + wire it into the existing tracker. Prerequisite for Phase 4.

**What to implement:**
1. **`lib/nutrition-targets.ts`** (pure, tested): Mifflin–St Jeor BMR from `profiles` → TDEE via an activity factor derived from the active training plan's weekly load (`plan_items` count/type; sane default when no plan) → goal adjustment (cut/maintain/gain/recomp) → macro split (protein g/kg bodyweight, fat % of kcal, carbs = remainder). Returns `{kcal, protein_g, carbs_g, fat_g}`.
2. **FORMULAS.md** new section §"Nutrition targets" — the authoritative formulas + constants (activity factors, g/kg, split). Source of truth.
3. **Close the loop:** a server action/RPC that upserts `goals` (`calorie_intake` target, and a protein goal) from computed targets, so the existing progress bar + adherence-XP bonus track automatically. Idempotent.

**Verification:** unit tests cover BMR/TDEE/split across sexes, no-plan default, goal variants; tsc/eslint; setting targets updates the day-summary bar.

---

## Phase 4 — AI meal plan: intake wizard → weekly menu (PR #4)

Request #1 — the headline feature. Consumes Phase 3 targets.

**What to implement:**
1. **Migration** `<ts>_meal_plans.sql` (copy `training_plans` structure + RLS + an atomic `create_meal_plan` RPC that archives prior active + inserts plan + items):
   - `meal_plans` — `id, user_id, status (active|archived), intake jsonb (goal, diet, allergies[], dislikes[], meals_per_day), targets jsonb (kcal/protein/carbs/fat), raw_ai_response, model, created_at`. Owner-only RLS.
   - `meal_plan_items` — `id, plan_id, day_of_week (0-6), meal_type, title, ingredients jsonb[], kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, recipe_steps text, video_query text, sort`. RLS via plan ownership.
2. **`lib/ai/meal-plan.ts`:** `generateMealPlan(intake, targets)` → Gemini structured output: a 7-day menu where each meal carries macros, an ingredient list, `recipe_steps`, and a `video_query` (→ `planItemVideoUrl` for the "Watch recipe" link). Validate field-by-field; clamp; cap items.
3. **`app/nutrition/plan/`:**
   - **Intake wizard** (model on `app/training/components/intake-wizard.tsx`): goal → diet/allergies/dislikes → meals-per-day → confirm (show Phase-3 computed targets) → generate. **Soft banner** when no active training plan: "For a load-aware menu, build a training plan first → [Build one] · [Skip]" — dismissible, non-blocking.
   - **Plan view:** daily targets + 7-day menu (reuse the `WeekAgenda` vertical-agenda pattern) + **grocery list** (aggregated ingredients) + per-day regenerate + editable items + "Watch recipe" links.
4. **On activate:** call the Phase-3 close-the-loop action so goals reflect the plan.
5. **Docs:** create `app/nutrition/README.md` (module behavior) and update `plans/features-roadmap.md`.

**Verification:** migration + RPC apply; RLS: user B cannot read user A's plans/items; tsc/eslint/test; generate with/without a training plan (soft path); AI output validated (no hallucinated URLs); grocery list aggregates; activating sets goals.

**Anti-pattern guards:** `video_query` not URLs; AI output validated; targets from `lib/` not the model; wizard steps skippable; RLS on both new tables.

---

## Out of scope (candidate follow-ups)
Recents/favorites quick-add · barcode scan (Open Food Facts) · training-aware daily nudge ("40g protein short") · water/hydration logging · macro-adherence streak.
