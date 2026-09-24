  -- Plan-item completions earn XP and feed the streak like routine workouts.
  -- Ticking a plan item done now (atomically, via RPC):
  --   1. flips plan_items.is_completed
  --   2. awards type-based XP once per item (compensated on undo, so
  --      done/undone/done cycles can't farm XP)
  --   3. writes a logs row tied to the item (streak, calendar "logged" badge,
  --      group-streak nudge all read logs) — removed again on undo.

  -- Link a log row back to the plan item that produced it so undo can remove
  -- exactly that row. History survives plan deletion (link nulls out).
  ALTER TABLE public.logs
    ADD COLUMN IF NOT EXISTS plan_item_id uuid
      REFERENCES public.plan_items(id) ON DELETE SET NULL;

  -- One auto-log per plan item.
  CREATE UNIQUE INDEX IF NOT EXISTS logs_plan_item_unique
    ON public.logs (plan_item_id) WHERE plan_item_id IS NOT NULL;

  CREATE OR REPLACE FUNCTION public.complete_plan_item(
    p_item_id uuid,
    p_completed boolean,
    p_date date
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_user_id uuid;
    v_item record;
    v_xp int;
    v_awards int;
    v_undos int;
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Not authenticated');
    END IF;

    SELECT i.id, i.item_type, i.title, i.is_completed
    INTO v_item
    FROM public.plan_items i
    JOIN public.training_plans p ON p.id = i.plan_id
    WHERE i.id = p_item_id AND p.user_id = v_user_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Plan item not found');
    END IF;

    IF v_item.item_type = 'meal_note' THEN
      RETURN jsonb_build_object('error', 'Meal notes cannot be completed');
    END IF;

    UPDATE public.plan_items
    SET is_completed = p_completed
    WHERE id = p_item_id;

    -- Sessions weigh like a routine workout (60 XP); lighter items less.
    v_xp := CASE v_item.item_type
      WHEN 'run' THEN 60
      WHEN 'strength' THEN 60
      WHEN 'stretch' THEN 30
      WHEN 'mobility' THEN 30
      ELSE 20 -- recovery
    END;

    SELECT count(*) INTO v_awards FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'plan_item:' || p_item_id;
    SELECT count(*) INTO v_undos FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'plan_item_undo:' || p_item_id;

    IF p_completed THEN
      IF v_awards <= v_undos THEN
        INSERT INTO public.xp_transactions (user_id, amount, reason)
        VALUES (v_user_id, v_xp, 'plan_item:' || p_item_id);

        UPDATE public.profiles
        SET xp = COALESCE(xp, 0) + v_xp,
            level = FLOOR((COALESCE(xp, 0) + v_xp) / 1000.0) + 1
        WHERE id = v_user_id;
      ELSE
        v_xp := 0; -- already netted an award for this item
      END IF;

      INSERT INTO public.logs (user_id, date, sport_type_id, status, notes, plan_item_id)
      VALUES (v_user_id, p_date, NULL, 'completed', v_item.title, p_item_id)
      ON CONFLICT (plan_item_id) WHERE plan_item_id IS NOT NULL DO NOTHING;

      RETURN jsonb_build_object('success', true, 'awarded_xp', v_xp);
    ELSE
      DELETE FROM public.logs
      WHERE user_id = v_user_id AND plan_item_id = p_item_id;

      IF v_awards > v_undos THEN
        INSERT INTO public.xp_transactions (user_id, amount, reason)
        VALUES (v_user_id, -v_xp, 'plan_item_undo:' || p_item_id);

        UPDATE public.profiles
        SET xp = GREATEST(COALESCE(xp, 0) - v_xp, 0),
            level = FLOOR(GREATEST(COALESCE(xp, 0) - v_xp, 0) / 1000.0) + 1
        WHERE id = v_user_id;

        RETURN jsonb_build_object('success', true, 'awarded_xp', -v_xp);
      END IF;

      RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Plan item completion failed: %', SQLERRM;
      RETURN jsonb_build_object('error', 'Failed to update the item');
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.complete_plan_item(uuid, boolean, date) TO authenticated;
