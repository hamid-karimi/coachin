# Nutrition module

Log meals by search, photo, or hand; track calories and macros against the daily goal;
earn XP for the habit; generate an AI weekly meal plan sized to body metrics and training
load.

## API (Go: `apps/api/internal/app/nutrition`)

| Call | What |
| --- | --- |
| `GET /nutrition/day` | Today's `meals` (logging order), `totals`, the active calorie-intake `target`, `week` / `month` trends (a point per day, averages over logged days only), `usdaEnabled` |
| `GET /foods?q=` | Local foods containing `q` (2+ characters, wildcards literal), up to 8, per 100 g |
| `GET /foods/usda?q=` | USDA FoodData Central (Foundation + SR Legacy), up to 6 with calories; 502 without `USDA_API_KEY` or when USDA fails; rate limited |
| `POST /meals` | `{mealType, foodId + quantityG}` or `{mealType, usdaFdcId + quantityG}` or `{mealType, manual: {name, kcal, proteinG?, carbsG?, fatG?}}` → the log, `award_meal_xp` (+5, 3 a day) and yesterday's `award_day_adherence` (+30) in one transaction under the profile lock. A USDA pick is re-read from USDA and stored once (`foods.fdc_id`); the client never sends nutrients |
| `DELETE /meals/{id}` | Removes the meal and refunds its meal XP (`meal_log_undo:<id>`) |
| `POST /meals/photo-estimate` | Multipart `photos` (1–3 of the same meal, 2 MB each after the browser's compression; JPEG/PNG/WebP/GIF by content) + optional `context` hint (140 chars) → the AI's items for review (`domain/aigen.MealPhotoRequest` / `ParseMealEstimate`, byte-identical to legacy via `ai.json`); the profile's country joins the prompt. Nothing is saved. 400 "Couldn't recognize food in that photo — try another angle", 502 when AI is unavailable; rate limited |
| `GET /nutrition/plan` | The active `plan` (targets, intake, 7-day `meals` with ingredients / recipe / video query) or none, its `grocery` list (ingredient names with counts), `hasTrainingPlan` (for the wizard's hint) |
| `POST /nutrition/plan` | `{goal, diet, allergies, dislikes, mealsPerDay}` → targets from the profile (FORMULAS §10; 400 "Add your height, weight, and birth date…" when missing), the AI menu (`domain/aigen.MealPlanRequest` / `ParseMealPlan`, byte-identical to legacy via `ai.json`, profile country + latest body analysis in the prompt); archives the old plan, saves the new one, and points the calorie-intake goal at the target — one transaction. "Meal plan ready — your calorie goal is set to match." 502 when AI is unavailable; rate limited |
| `POST /nutrition/plan/regenerate` | Re-runs with the stored intake (404 "No meal plan to regenerate") |
| `DELETE /nutrition/plan` | Archives the active plan ("Meal plan discarded."); the calorie goal stays |
| `POST /meals/batch` | `{mealType, items: [{name, estKcal, estQuantityG?, proteinG?, …, source?}]}` → logs each valid row (0 < kcal ≤ 5000, max 10) with meal XP in one transaction; photo rows keep their estimate in `photo_estimate`, rows added from search are `search` logs. "N items logged · +X XP." |

Portion math (`domain/nutrition.Portion`): per-100 g × grams / 100; kcal and sodium whole,
the rest to 0.1. Manual meals keep the entered macros (negatives → 0), kcal rounded.

## Structure

- `page.tsx` — prefetches `/nutrition/day` and hydrates; no logic. `plan/page.tsx` (+
  `plan/loading.tsx`) does the same for `/nutrition/plan`
- `loading.tsx` — skeleton
- `hooks/use-nutrition.ts` — day query, log/delete mutations (refetch the page and
  Today), debounced local search (`components/hooks/use-debounced-value.ts`), on-demand
  USDA search, photo estimate (multipart) and batch confirm; `hooks/use-meal-plan.ts` —
  plan query, generate / regenerate / discard (refetch the plan, the day, Today, and the
  calendar)
- `lib/nutrition.ts` — meal groups, kcal/macro/micro lines, goal %, week bars;
  `lib/meal-logger.ts` — logger reducer and request bodies; `lib/photo-review.ts` —
  review reducer, totals, search-to-review rows, upload form; `lib/meal-plan.ts` — goals,
  diets, intake reducer and body, Monday-first days, meal lines, video link, and the
  Today / calendar summary lines; all unit-tested.
  Shared `lib/food-units.ts` (household units → grams) replays the API's
  `nutrition.json` golden vectors; shared `lib/client-image.ts` compresses photos on the
  device (≤1600 px JPEG, ~1 MB) and strips EXIF
- `components/`
  - `nutrition-view.tsx` — header, `day-summary.tsx`, `meal-logger.tsx`,
    `meal-groups.tsx` (`meal-row.tsx`), `nutrition-trends.tsx` (`week-bars.tsx`)
  - `meal-logger.tsx` — meal-type chips, Search / Photo / Manual; `food-search-field.tsx`,
    `picked-food-form.tsx` (`unit-select.tsx`), `manual-meal-form.tsx`
  - `photo-mode.tsx` — `photo-capture.tsx` (up to 3 photos + hint) → `photo-review.tsx`
    (edit name / grams / kcal, remove, `add-review-item.tsx` from search, total, Save N
    items / Discard)
  - `meal-plan-screen.tsx` — the plan (`meal-plan-view.tsx`: targets, days of
    `planned-meal-card.tsx` with recipe & ingredients and "Watch how", grocery list,
    `meal-plan-actions.tsx`) or the wizard (`meal-plan-intake.tsx`: goal, diet, meals a
    day, allergies, foods to avoid, a dismissible "build a training plan first" hint)
- The active plan also shows on Today (`dashboard/components/todays-meals-card.tsx`) and
  the calendar (`calendar/components/day-meals-line.tsx`); the menu repeats weekly by
  weekday

## Differences from legacy

- USDA picks are re-read from USDA by id (legacy stored whatever nutrients the client
  posted into the shared food list) and kept once per USDA food (legacy added a row per
  log).
- Deleting a meal gives its XP back; legacy's cap counted remaining meals only, so
  delete + re-log farmed XP.
- Meal logging is serialized per user, so parallel logs can't pass the 3-a-day cap.
- Search treats `%` and `_` literally.
- Photo uploads are checked to be images by content; the country hint comes from the
  profile only (legacy also used Vercel's IP-country header).
- A confirmed photo batch is one transaction (legacy inserted row by row, skipping
  failures).

- Saving a plan (archive old, insert plan + meals, set the calorie goal) is one
  transaction; legacy did it in separate calls and could leave a half-saved plan.

## Not yet ported

"Share today" / meal share cards (share-card step); the coach's read-only nutrition view
(Coaching).
