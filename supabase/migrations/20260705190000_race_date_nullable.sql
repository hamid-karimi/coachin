-- Phase 5 (adaptive training): hypertrophy plans have no race, so
-- training_plans.race_date becomes nullable. Race plans keep setting it.
ALTER TABLE public.training_plans
  ALTER COLUMN race_date DROP NOT NULL;
