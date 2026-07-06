-- Extend nutrition tracking beyond macros: sugar, fiber, sodium.
-- Nullable on foods (USDA/seed data may lack them) and defaulted to 0 on
-- meal_logs so day/period totals sum cleanly. Values are per-100g on foods,
-- per-portion on meal_logs (matching kcal/protein_g).

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS sugar_g numeric CHECK (sugar_g IS NULL OR sugar_g >= 0),
  ADD COLUMN IF NOT EXISTS fiber_g numeric CHECK (fiber_g IS NULL OR fiber_g >= 0),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric CHECK (sodium_mg IS NULL OR sodium_mg >= 0);

ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS sugar_g numeric NOT NULL DEFAULT 0 CHECK (sugar_g >= 0),
  ADD COLUMN IF NOT EXISTS fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric NOT NULL DEFAULT 0 CHECK (sodium_mg >= 0);
