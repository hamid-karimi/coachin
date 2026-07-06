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

## Units

Amounts can be entered in household units (g, ml, tsp, tbsp, cup, oz, slice,
piece, handful, serving). `lib/food-units.ts` normalises everything to grams on
submit, so the mass-based (`per-100g`) math downstream is unchanged. Volume
units use approximate densities — fine for portion logging.

## AI photo estimation

`lib/ai/nutrition.ts` (Gemini vision) proposes items with per-portion calories
and macros. Nothing is auto-saved: the user always reviews and edits in the
photo-review sheet before it becomes `meal_logs` rows.

## Data

`meal_logs`: `meal_type`, `free_text`, `quantity_g`, `kcal`, `protein_g`,
`carbs_g`, `fat_g`, `entry_method`, `date`. A `calorie_intake` goal (set on the
profile) drives the daily progress bar and the +30 XP adherence bonus.
