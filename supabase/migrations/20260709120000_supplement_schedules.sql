-- Supplement schedules: due-day rules for the daily stack.
--
-- Adds two columns to public.supplements:
--   schedule_type — when the supplement is due:
--     'daily'         → every day (the default; existing rows read as this)
--     'training_days' → only on days the user trains (degrades to daily when
--                       there is no active training plan)
--     'custom'        → specific weekdays, listed in days_of_week
--   days_of_week — custom weekdays (0=Sun … 6=Sat, same convention as
--                  plan_items.day_of_week); only meaningful for 'custom'.
--
-- Existing rows default to 'daily' with a null days_of_week, so this is a
-- zero behavior change. Still informational only — no XP, streaks, or hearts.

ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'daily'
  CHECK (schedule_type IN ('daily', 'training_days', 'custom'));

ALTER TABLE public.supplements
  ADD COLUMN IF NOT EXISTS days_of_week smallint[];
