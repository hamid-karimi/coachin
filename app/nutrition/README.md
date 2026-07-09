# Nutrition Module

Log meals by search, photo, or hand; track calories and macros against a daily
goal, and earn XP for the habit.

## Structure

- `page.tsx`: day summary (kcal + macros vs goal) and meals grouped by type
- `actions.ts`: server actions — `logMealAction` (search / USDA / manual),
  `estimateMealPhotoAction` (photo → AI estimate, review-only),
  `confirmPhotoMealsAction`, `deleteMealLogAction`
- `api/foods/route.ts`: food autocomplete — local `foods` table first, explicit
  USDA FoodData Central fallback (`?remote=1`)
- `components/`
  - `meal-logger.tsx`: the search / photo / manual logger + photo-review sheet
  - `food-search-field.tsx`: reusable debounced food autocomplete (used by
    search mode and the photo-review "add item")
  - `unit-select.tsx`: household amount-unit dropdown
  - `meal-row.tsx`: a single logged meal
  - `nutrition-trends.tsx`: weekly + monthly rollup cards (week kcal bar chart)

## Units

Amounts can be entered in household units (g, ml, tsp, tbsp, cup, oz, slice,
piece, handful, serving). `lib/food-units.ts` normalises everything to grams on
submit, so the mass-based (`per-100g`) math downstream is unchanged. Volume
units use approximate densities — fine for portion logging.

## AI meal plan (`/nutrition/plan`)

An AI weekly menu built from body metrics + training load.

- `lib/nutrition-targets.ts` (pure, tested) computes daily kcal + macro targets
  (Mifflin–St Jeor → activity factor from weekly training days → goal → macro
  split; see FORMULAS.md §10).
- `plan/actions.ts` `generateMealPlanAction` gathers profile + schedules +
  consented body-photo analysis, computes targets, calls
  `lib/ai/meal-plan.ts` (Gemini structured output) for a 7-day menu, stores it
  in `meal_plans` / `meal_plan_items`, and points the active `calorie_intake`
  goal at the target (closes the loop with the tracker).
- The intake wizard softly *suggests* building a training plan first but never
  blocks. Each meal shows macros, an expandable recipe/ingredients block, and a
  "Watch how" YouTube link; `lib/meal-plan-grocery.ts` (tested) builds the
  grocery list. Regenerate re-runs from the stored intake; discard archives.
- The active plan is surfaced elsewhere via `lib/meal-plan-day.ts`
  (`getActiveMealPlanByDay`, weekday-keyed menu): the dashboard shows a
  "Today's meals" card and the calendar a per-day "N meals planned" link —
  both read-only pointers back to `/nutrition/plan`.

## AI photo estimation

`lib/ai/nutrition.ts` (Gemini vision) proposes items with per-portion calories
and macros. Accepts up to **3 photos of the same meal** (angles or a
packaging/nutrition-label shot — the prompt prefers label data) plus an
optional free-text hint; the model merges everything into one item list.
Nothing is auto-saved: the user always reviews and edits in the photo-review
sheet before it becomes `meal_logs` rows.

## Locale-aware suggestions

`profiles.country` (free text, set on the profile's body form) feeds both the
meal-plan prompt (ingredients commonly available/affordable there, familiar
local dishes, **never quote prices**) and photo recognition (cuisine hint).
When unset, `lib/user-country.ts` (pure, tested) falls back to Vercel's
`x-vercel-ip-country` header — the profile value always wins.

## Data

`meal_logs`: `meal_type`, `free_text`, `quantity_g`, `kcal`, `protein_g`,
`carbs_g`, `fat_g`, `sugar_g`, `fiber_g`, `sodium_mg`, `entry_method`, `date`. A
`calorie_intake` goal (set on the profile) drives the daily progress bar and the
+30 XP adherence bonus.

Nutrients tracked: calories, protein, carbs, fat (macros) plus sugar, fiber, and
sodium. `foods` carries per-100g values (sugar/fiber/sodium nullable — USDA
nutrient numbers 269 / 291 / 307); `meal_logs` stores the per-portion amount.
Photo estimation and USDA/local search all populate them.

## Coach sharing

Trainees can opt in to sharing nutrition with their active coach: the
"Share nutrition with my coach" toggle in Profile → Settings flips
`profiles.nutrition_sharing_enabled` (default off). While on, the coach-read
RLS policies (`20260707131000_nutrition_coach_read.sql`, copying the logs
coach-read pattern) grant the active coach **read-only** SELECT on
`meal_logs`, `meal_plans`, and `meal_plan_items`; the coach views the last 7
days at `/coaching/trainees/[id]/nutrition`. Turning the toggle off revokes
access immediately. Write policies remain self-only.

## Trends

The page fetches the last 30 days of `meal_logs` and `lib/nutrition-trends.ts`
(pure, unit-tested) aggregates them by day into weekly (7-day) and monthly
(30-day) summaries — averaged over *logged* days so gaps don't skew the number.
Rendered as two rollup cards, the weekly one with a per-day kcal bar chart
(goal line when a `calorie_intake` goal is set).
