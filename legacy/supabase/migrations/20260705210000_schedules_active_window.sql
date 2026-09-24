-- Recurring routines can now be bounded: a schedule with an ends_on stops
-- repeating after that date; starts_on delays it. Both nullable = the old
-- "repeats forever from now" behavior, so existing rows are unchanged.
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;
