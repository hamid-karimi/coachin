-- Seed the wider sports catalogue for the onboarding picker.
--
-- sport_types.name has NO unique constraint (the table was admin-seeded at
-- runtime — see 20260706140000_dedup_mobility_sport_types.sql), so each insert
-- guards itself with a case-insensitive NOT EXISTS instead of ON CONFLICT.
-- Re-running the migration, or environments where an admin already added one
-- of these names by hand, are both no-ops.
--
-- All rows use xp_multiplier 1.0 (neutral): new sports must not inflate XP.
-- Icons come from name matching in lib/sports.ts, not from this table.

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Football', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Football'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Basketball', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Basketball'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Boxing', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Boxing'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Tennis', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Tennis'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Volleyball', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Volleyball'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Martial arts', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Martial arts'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Climbing', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Climbing'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Hiking', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Hiking'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Rowing', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Rowing'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Dance', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Dance'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Table tennis', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Table tennis'));

INSERT INTO public.sport_types (name, xp_multiplier)
SELECT 'Badminton', 1.0
WHERE NOT EXISTS (SELECT 1 FROM public.sport_types WHERE lower(name) = lower('Badminton'));
