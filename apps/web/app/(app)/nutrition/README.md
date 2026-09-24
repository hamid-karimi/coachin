# Nutrition module

Log meals by search or by hand; track calories and macros against the daily goal; earn
XP for the habit. (Photo estimates and the AI meal plan arrive in 3.5b / 3.5c.)

## API (Go: `apps/api/internal/app/nutrition`)

| Call | What |
| --- | --- |
| `GET /nutrition/day` | Today's `meals` (logging order), `totals`, the active calorie-intake `target`, `week` / `month` trends (a point per day, averages over logged days only), `usdaEnabled` |
| `GET /foods?q=` | Local foods containing `q` (2+ characters, wildcards literal), up to 8, per 100 g |
| `GET /foods/usda?q=` | USDA FoodData Central (Foundation + SR Legacy), up to 6 with calories; 502 without `USDA_API_KEY` or when USDA fails; rate limited |
| `POST /meals` | `{mealType, foodId + quantityG}` or `{mealType, usdaFdcId + quantityG}` or `{mealType, manual: {name, kcal, proteinG?, carbsG?, fatG?}}` → the log, `award_meal_xp` (+5, 3 a day) and yesterday's `award_day_adherence` (+30) in one transaction under the profile lock. A USDA pick is re-read from USDA and stored once (`foods.fdc_id`); the client never sends nutrients |
| `DELETE /meals/{id}` | Removes the meal and refunds its meal XP (`meal_log_undo:<id>`) |

Portion math (`domain/nutrition.Portion`): per-100 g × grams / 100; kcal and sodium whole,
the rest to 0.1. Manual meals keep the entered macros (negatives → 0), kcal rounded.

## Structure

- `page.tsx` — prefetches `/nutrition/day` and hydrates; no logic
- `loading.tsx` — skeleton
- `hooks/use-nutrition.ts` — day query, log/delete mutations (refetch the page and
  Today), debounced local search (`components/hooks/use-debounced-value.ts`), on-demand
  USDA search
- `lib/nutrition.ts` — meal groups, kcal/macro/micro lines, goal %, week bars;
  `lib/meal-logger.ts` — logger reducer and request bodies; both unit-tested.
  Shared `lib/food-units.ts` (household units → grams) replays the API's
  `nutrition.json` golden vectors
- `components/`
  - `nutrition-view.tsx` — header, `day-summary.tsx`, `meal-logger.tsx`,
    `meal-groups.tsx` (`meal-row.tsx`), `nutrition-trends.tsx` (`week-bars.tsx`)
  - `meal-logger.tsx` — meal-type chips, Search / Manual; `food-search-field.tsx`,
    `picked-food-form.tsx` (`unit-select.tsx`), `manual-meal-form.tsx`

## Differences from legacy

- USDA picks are re-read from USDA by id (legacy stored whatever nutrients the client
  posted into the shared food list) and kept once per USDA food (legacy added a row per
  log).
- Deleting a meal gives its XP back; legacy's cap counted remaining meals only, so
  delete + re-log farmed XP.
- Meal logging is serialized per user, so parallel logs can't pass the 3-a-day cap.
- Search treats `%` and `_` literally.

## Not yet ported

Photo estimate (3.5b); AI meal plan, Today's menu card, the calendar's meal line (3.5c);
"Share today" / meal share cards (share-card step); the coach's read-only nutrition view
(Coaching).
