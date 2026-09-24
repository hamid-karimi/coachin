-- Add index on profiles.xp column to improve performance of discover query
-- which orders profiles by XP in descending order
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
