-- Bring two dormant profile columns to life:
--   * current_streak / best_streak / hearts — a personal daily streak with a
--     Duolingo-style "streak freeze" heart economy, evaluated lazily like the
--     group streak (evaluate_group_days).
--   * league_tier — now derived from lifetime XP via a trigger, so the
--     leaderboard (which reads profiles.league_tier) is always correct.
-- Rules are the source of truth in FORMULAS.md §2 (streak) and §3 (league);
-- the pure state transition is mirrored + unit-tested in lib/streak.ts.

-- Tracks the last day settled by evaluate_user_streak (NULL = never run).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_evaluated_date date;

-- ---------------------------------------------------------------------------
-- League tier from lifetime XP (cumulative thresholds, only ever goes up).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.league_tier_for_xp(p_xp bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_xp, 0) >= 50000 THEN 'platinum'
    WHEN COALESCE(p_xp, 0) >= 20000 THEN 'gold'
    WHEN COALESCE(p_xp, 0) >=  5000 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_league_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.league_tier := public.league_tier_for_xp(NEW.xp);
  RETURN NEW;
END;
$$;

-- Keep league_tier in lockstep with xp; fires only when xp changes.
DROP TRIGGER IF EXISTS profiles_league_tier ON public.profiles;
CREATE TRIGGER profiles_league_tier
BEFORE INSERT OR UPDATE OF xp ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_league_tier();

-- Backfill existing rows so nobody is stuck at the default 'bronze'.
UPDATE public.profiles
SET league_tier = public.league_tier_for_xp(xp)
WHERE league_tier IS DISTINCT FROM public.league_tier_for_xp(xp);

-- ---------------------------------------------------------------------------
-- Personal streak: lazy settle of every un-evaluated day up to YESTERDAY.
-- Idempotent via streak_evaluated_date + row lock. A day with a completed log
-- extends the streak (and regains a heart, capped at 3); a MISSED scheduled
-- day (routine schedule or a non-meal plan item) spends a heart and freezes
-- the streak; a rest day (nothing scheduled) is safe; missing while already at
-- 0 hearts resets the streak to 0 and refills hearts to 3.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_plan record;
  v_day date;
  v_dow int;
  v_trained boolean;
  v_required boolean;
  v_plan_week int;
  v_streak int;
  v_best int;
  v_hearts int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT current_streak, best_streak, hearts, streak_evaluated_date
    INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  v_streak := COALESCE(v_profile.current_streak, 0);
  v_best   := COALESCE(v_profile.best_streak, 0);
  v_hearts := LEAST(GREATEST(COALESCE(v_profile.hearts, 3), 0), 3);

  -- First run settles only yesterday — no retroactive punishment for days
  -- before the mechanic existed.
  v_day := COALESCE(v_profile.streak_evaluated_date + 1, CURRENT_DATE - 1);

  SELECT id, created_at, weeks_total
    INTO v_plan
  FROM public.training_plans
  WHERE user_id = v_user_id AND status = 'active'
  LIMIT 1;

  WHILE v_day < CURRENT_DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int; -- 0=Sun..6=Sat, matches the app

    v_trained := EXISTS (
      SELECT 1 FROM public.logs
      WHERE user_id = v_user_id AND date = v_day AND status = 'completed'
    );

    IF v_trained THEN
      v_streak := v_streak + 1;
      v_best := GREATEST(v_best, v_streak);
      v_hearts := LEAST(v_hearts + 1, 3);
    ELSE
      -- A "training day" = a routine scheduled that weekday...
      v_required := EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.user_id = v_user_id
          AND s.day_of_week = v_dow
          AND (s.starts_on IS NULL OR s.starts_on <= v_day)
          AND (s.ends_on IS NULL OR s.ends_on >= v_day)
      );

      -- ...or a non-meal item in the active plan on that date.
      IF NOT v_required AND v_plan.id IS NOT NULL THEN
        v_plan_week := (
          (date_trunc('week', v_day)::date
            - date_trunc('week', v_plan.created_at::date)::date) / 7
        ) + 1;
        IF v_plan_week BETWEEN 1 AND v_plan.weeks_total THEN
          v_required := EXISTS (
            SELECT 1 FROM public.plan_items
            WHERE plan_id = v_plan.id
              AND week = v_plan_week
              AND day_of_week = v_dow
              AND item_type <> 'meal_note'
          );
        END IF;
      END IF;

      IF v_required THEN
        IF v_hearts > 0 THEN
          v_hearts := v_hearts - 1; -- missed: spend a heart, streak frozen
        ELSE
          v_streak := 0;            -- out of hearts: reset
          v_hearts := 3;
        END IF;
      END IF;
      -- rest day (not required): streak safe, nothing changes
    END IF;

    v_day := v_day + 1;
  END LOOP;

  UPDATE public.profiles
  SET current_streak = v_streak,
      best_streak = v_best,
      hearts = v_hearts,
      streak_evaluated_date = CURRENT_DATE - 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'current_streak', v_streak,
    'best_streak', v_best,
    'hearts', v_hearts
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'User streak evaluation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to evaluate streak');
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_user_streak() TO authenticated;
