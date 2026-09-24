-- User country for locale-aware nutrition (nutrition-integrations phase 2).
--
-- Free-text country name (e.g. "Iran") set by the user on their profile.
-- When unset, server code falls back to Vercel's x-vercel-ip-country request
-- header (ISO-2 code, decoded via Intl.DisplayNames) as a hint only — the
-- profile value always wins. Feeds the meal-plan and photo-recognition
-- prompts ("ingredients commonly available and affordable in X"); the AI is
-- explicitly told NOT to quote prices.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;
