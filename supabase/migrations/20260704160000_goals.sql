-- Goals system (roadmap branch 2): user-defined targets with progress and
-- an idempotent achievement XP award.

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN (
    'weight', 'calorie_intake', 'calories_burned',
    'weekly_run_km', 'monthly_run_km', 'body_fat_pct'
  )),
  target_value numeric NOT NULL CHECK (target_value > 0),
  start_value numeric,
  target_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'achieved', 'abandoned')),
  achieved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT goals_pkey PRIMARY KEY (id),
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- One ACTIVE goal per type per user
CREATE UNIQUE INDEX IF NOT EXISTS goals_one_active_per_type
  ON public.goals (user_id, goal_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS goals_user_status_idx
  ON public.goals (user_id, status);

-- RLS: self-only (style copied from xp_transactions/body_measurements)
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_select_self ON public.goals;
CREATE POLICY goals_select_self
ON public.goals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS goals_insert_self ON public.goals;
CREATE POLICY goals_insert_self
ON public.goals
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS goals_update_self ON public.goals;
CREATE POLICY goals_update_self
ON public.goals
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Idempotent achievement award: marks the goal achieved and pays +200 XP
-- exactly once (row lock + status check). Level formula mirrors the app:
-- every 1000 XP = +1 level (see app/dashboard/actions.ts / lib/xp.ts).
CREATE OR REPLACE FUNCTION public.achieve_goal(p_goal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_goal record;
  v_new_xp int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_goal
  FROM public.goals
  WHERE id = p_goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;

  IF v_goal.status <> 'active' THEN
    -- Already settled — idempotent no-op.
    RETURN jsonb_build_object('success', true, 'status', 'already_settled');
  END IF;

  UPDATE public.goals
  SET status = 'achieved', achieved_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 200, 'goal_achieved:' || p_goal_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 200,
      level = FLOOR((COALESCE(xp, 0) + 200) / 1000.0) + 1
  WHERE id = v_user_id
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'achieved',
    'awarded_xp', 200,
    'new_xp', v_new_xp
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Goal achievement failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to record goal achievement');
END;
$$;

GRANT EXECUTE ON FUNCTION public.achieve_goal(uuid) TO authenticated;
