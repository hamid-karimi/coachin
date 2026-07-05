-- Per-session logs (adaptive training phase 1): optional "how did it go?"
-- log for completed run/strength plan items. `actual` carries the sport-shaped
-- payload (run: distance_km/duration_min/avg_hr; strength: exercises[]);
-- ai_feedback is filled by a later phase. One log per plan item.

CREATE TABLE IF NOT EXISTS public.session_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_item_id uuid NOT NULL,
  sport text NOT NULL CHECK (sport IN ('run', 'strength')),
  rpe int CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10)),
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  ai_feedback jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_logs_pkey PRIMARY KEY (id),
  CONSTRAINT session_logs_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT session_logs_plan_item_id_fkey FOREIGN KEY (plan_item_id)
    REFERENCES public.plan_items(id) ON DELETE CASCADE,
  CONSTRAINT session_logs_plan_item_unique UNIQUE (plan_item_id)
);

CREATE INDEX IF NOT EXISTS session_logs_user_idx
  ON public.session_logs (user_id);

-- RLS: self-only (policy style copied from body_measurements)
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_logs_select_self ON public.session_logs;
CREATE POLICY session_logs_select_self
ON public.session_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS session_logs_insert_self ON public.session_logs;
CREATE POLICY session_logs_insert_self
ON public.session_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS session_logs_update_self ON public.session_logs;
CREATE POLICY session_logs_update_self
ON public.session_logs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Session-logging XP: +10 per logged session, idempotent per log
-- (body copied from award_meal_xp in 20260705120000_nutrition.sql)
CREATE OR REPLACE FUNCTION public.award_session_log_xp(p_session_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_log record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_log
  FROM public.session_logs
  WHERE id = p_session_log_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Session log not found');
  END IF;

  -- Idempotent per session log
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'session_log:' || p_session_log_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 10, 'session_log:' || p_session_log_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 10,
      level = FLOOR((COALESCE(xp, 0) + 10) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 10);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Session log XP award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award XP');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_session_log_xp(uuid) TO authenticated;
