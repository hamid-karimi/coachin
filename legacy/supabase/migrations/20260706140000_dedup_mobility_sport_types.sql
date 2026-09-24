-- Dedup "Mobility" sport_types down to a single canonical row.
--
-- The sport_types table is admin-seeded at runtime (not in any migration), and
-- several "Mobility" rows were hand-entered as duplicates. Because lib/sports.ts
-- maps every "Mobility"-named row to the same design-system Sport, they render
-- identically in the onboarding picker. This collapses them to one canonical row.
--
-- Defensive PL/pgSQL: ids are environment-specific, so we resolve them by name at
-- runtime and never hardcode. If 0 or 1 Mobility rows exist, this is a no-op.
--
-- The canonical row's xp_multiplier is set to 1.0 (neutral) to avoid a "2× mobility"
-- that would inflate future routine XP. This affects future logWorkout XP only —
-- past xp_transactions are immutable and are not touched.

DO $$
DECLARE v_canonical bigint;
BEGIN
  SELECT MIN(id) INTO v_canonical FROM public.sport_types WHERE name ILIKE 'mobility';
  IF v_canonical IS NULL THEN RETURN; END IF;

  -- Repoint references BEFORE deleting dupes (avoids FK violations / orphaned logs).
  UPDATE public.schedules SET sport_type_id = v_canonical
    WHERE sport_type_id IN (SELECT id FROM public.sport_types
                            WHERE name ILIKE 'mobility' AND id <> v_canonical);
  UPDATE public.logs SET sport_type_id = v_canonical
    WHERE sport_type_id IN (SELECT id FROM public.sport_types
                            WHERE name ILIKE 'mobility' AND id <> v_canonical);

  -- Delete the non-canonical Mobility rows.
  DELETE FROM public.sport_types WHERE name ILIKE 'mobility' AND id <> v_canonical;

  -- Normalize the canonical row's name + neutralize its multiplier.
  UPDATE public.sport_types SET name = 'Mobility', xp_multiplier = 1.0 WHERE id = v_canonical;
END $$;
