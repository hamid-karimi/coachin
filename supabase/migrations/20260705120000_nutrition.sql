-- Nutrition (roadmap branch 5): food database, meal logs, and food XP.
-- XP mechanic (user-approved): +5 XP per logged meal capped at 3/day, and a
-- +30 XP bonus for staying within ±10% of the calorie-intake goal for a day.

-- 1) Foods: local-first search table (seeded generics + USDA backfill + custom)
CREATE TABLE IF NOT EXISTS public.foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  kcal_per_100g numeric NOT NULL CHECK (kcal_per_100g >= 0),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  source text NOT NULL DEFAULT 'custom'
    CHECK (source IN ('seed', 'usda', 'custom')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT foods_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS foods_name_trgm_idx
  ON public.foods USING gin (to_tsvector('simple', name));
CREATE UNIQUE INDEX IF NOT EXISTS foods_seed_name_unique
  ON public.foods (lower(name)) WHERE source = 'seed';

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS foods_select_all ON public.foods;
CREATE POLICY foods_select_all
ON public.foods FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS foods_insert_own ON public.foods;
CREATE POLICY foods_insert_own
ON public.foods FOR INSERT TO authenticated
WITH CHECK (source IN ('usda', 'custom') AND created_by = auth.uid());

-- 2) Meal logs
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  free_text text,
  quantity_g numeric CHECK (quantity_g IS NULL OR quantity_g > 0),
  kcal numeric NOT NULL CHECK (kcal >= 0 AND kcal <= 5000),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  entry_method text NOT NULL DEFAULT 'search'
    CHECK (entry_method IN ('search', 'photo', 'manual')),
  photo_estimate jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meal_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx
  ON public.meal_logs (user_id, date DESC);

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_logs_select_self ON public.meal_logs;
CREATE POLICY meal_logs_select_self
ON public.meal_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS meal_logs_insert_self ON public.meal_logs;
CREATE POLICY meal_logs_insert_self
ON public.meal_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS meal_logs_delete_self ON public.meal_logs;
CREATE POLICY meal_logs_delete_self
ON public.meal_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3) Meal-logging XP: +5 per meal, hard cap 3 awards/day, idempotent per log
CREATE OR REPLACE FUNCTION public.award_meal_xp(p_meal_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_log record;
  v_today_awards int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_log
  FROM public.meal_logs
  WHERE id = p_meal_log_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Meal log not found');
  END IF;

  -- Idempotent per meal log
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'meal_log:' || p_meal_log_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0, 'capped', false);
  END IF;

  -- Daily cap: 3 meal awards per log date
  SELECT COUNT(*) INTO v_today_awards
  FROM public.xp_transactions x
  JOIN public.meal_logs m ON x.reason = 'meal_log:' || m.id
  WHERE x.user_id = v_user_id AND m.date = v_log.date;

  IF v_today_awards >= 3 THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0, 'capped', true);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 5, 'meal_log:' || p_meal_log_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 5,
      level = FLOOR((COALESCE(xp, 0) + 5) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 5, 'capped', false);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Meal XP award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award XP');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_meal_xp(uuid) TO authenticated;

-- 4) Daily adherence bonus: within ±10% of the active calorie_intake goal
--    with ≥2 meals logged → +30 XP, once per day. Evaluated lazily for
--    PAST days (never "today", which is still in progress).
CREATE OR REPLACE FUNCTION public.award_day_adherence(p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_target numeric;
  v_total numeric;
  v_meals int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_date >= CURRENT_DATE THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  -- Once per day
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'calorie_goal:' || p_date
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  SELECT target_value INTO v_target
  FROM public.goals
  WHERE user_id = v_user_id AND goal_type = 'calorie_intake'
    AND status = 'active'
  LIMIT 1;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  SELECT COALESCE(SUM(kcal), 0), COUNT(*) INTO v_total, v_meals
  FROM public.meal_logs
  WHERE user_id = v_user_id AND date = p_date;

  IF v_meals < 2 OR v_total < v_target * 0.9 OR v_total > v_target * 1.1 THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 30, 'calorie_goal:' || p_date);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 30,
      level = FLOOR((COALESCE(xp, 0) + 30) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 30);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Adherence award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award adherence bonus');
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_day_adherence(date) TO authenticated;

-- 5) Seed: common generic foods, per 100g (approximate standard values)
INSERT INTO public.foods (name, kcal_per_100g, protein_g, carbs_g, fat_g, source) VALUES
  ('Chicken breast, cooked', 165, 31, 0, 3.6, 'seed'),
  ('Chicken thigh, cooked', 209, 26, 0, 10.9, 'seed'),
  ('Beef, lean, cooked', 250, 26, 0, 15, 'seed'),
  ('Ground beef 85/15, cooked', 250, 25, 0, 16, 'seed'),
  ('Salmon, cooked', 208, 20, 0, 13, 'seed'),
  ('Tuna, canned in water', 116, 26, 0, 1, 'seed'),
  ('Shrimp, cooked', 99, 24, 0, 0.3, 'seed'),
  ('Egg, whole', 155, 13, 1.1, 11, 'seed'),
  ('Egg white', 52, 11, 0.7, 0.2, 'seed'),
  ('Greek yogurt, plain', 59, 10, 3.6, 0.4, 'seed'),
  ('Yogurt, plain whole milk', 61, 3.5, 4.7, 3.3, 'seed'),
  ('Milk, whole', 61, 3.2, 4.8, 3.3, 'seed'),
  ('Milk, skim', 34, 3.4, 5, 0.1, 'seed'),
  ('Cheese, cheddar', 403, 25, 1.3, 33, 'seed'),
  ('Cheese, feta', 264, 14, 4.1, 21, 'seed'),
  ('Cottage cheese', 98, 11, 3.4, 4.3, 'seed'),
  ('Tofu, firm', 76, 8, 1.9, 4.8, 'seed'),
  ('Lentils, cooked', 116, 9, 20, 0.4, 'seed'),
  ('Chickpeas, cooked', 164, 8.9, 27, 2.6, 'seed'),
  ('Black beans, cooked', 132, 8.9, 24, 0.5, 'seed'),
  ('White rice, cooked', 130, 2.7, 28, 0.3, 'seed'),
  ('Brown rice, cooked', 112, 2.6, 24, 0.9, 'seed'),
  ('Pasta, cooked', 158, 5.8, 31, 0.9, 'seed'),
  ('Bread, white', 265, 9, 49, 3.2, 'seed'),
  ('Bread, whole wheat', 247, 13, 41, 3.4, 'seed'),
  ('Pita bread', 275, 9.1, 55, 1.2, 'seed'),
  ('Oats, dry', 389, 17, 66, 6.9, 'seed'),
  ('Quinoa, cooked', 120, 4.4, 21, 1.9, 'seed'),
  ('Potato, boiled', 87, 1.9, 20, 0.1, 'seed'),
  ('Sweet potato, baked', 90, 2, 21, 0.2, 'seed'),
  ('Corn tortilla', 218, 5.7, 45, 2.9, 'seed'),
  ('Apple', 52, 0.3, 14, 0.2, 'seed'),
  ('Banana', 89, 1.1, 23, 0.3, 'seed'),
  ('Orange', 47, 0.9, 12, 0.1, 'seed'),
  ('Strawberries', 32, 0.7, 7.7, 0.3, 'seed'),
  ('Blueberries', 57, 0.7, 14, 0.3, 'seed'),
  ('Grapes', 69, 0.7, 18, 0.2, 'seed'),
  ('Watermelon', 30, 0.6, 7.6, 0.2, 'seed'),
  ('Dates', 277, 1.8, 75, 0.2, 'seed'),
  ('Avocado', 160, 2, 8.5, 15, 'seed'),
  ('Broccoli, cooked', 35, 2.4, 7.2, 0.4, 'seed'),
  ('Spinach, raw', 23, 2.9, 3.6, 0.4, 'seed'),
  ('Carrot', 41, 0.9, 9.6, 0.2, 'seed'),
  ('Tomato', 18, 0.9, 3.9, 0.2, 'seed'),
  ('Cucumber', 15, 0.7, 3.6, 0.1, 'seed'),
  ('Bell pepper', 26, 1, 6, 0.3, 'seed'),
  ('Lettuce', 15, 1.4, 2.9, 0.2, 'seed'),
  ('Onion', 40, 1.1, 9.3, 0.1, 'seed'),
  ('Mushrooms', 22, 3.1, 3.3, 0.3, 'seed'),
  ('Olive oil', 884, 0, 0, 100, 'seed'),
  ('Butter', 717, 0.9, 0.1, 81, 'seed'),
  ('Peanut butter', 588, 25, 20, 50, 'seed'),
  ('Almonds', 579, 21, 22, 50, 'seed'),
  ('Walnuts', 654, 15, 14, 65, 'seed'),
  ('Hummus', 166, 7.9, 14, 9.6, 'seed'),
  ('Dark chocolate 70%', 598, 7.8, 46, 43, 'seed'),
  ('Honey', 304, 0.3, 82, 0, 'seed'),
  ('Sugar', 387, 0, 100, 0, 'seed'),
  ('Protein powder (whey)', 400, 80, 8, 7, 'seed'),
  ('Granola', 471, 10, 64, 20, 'seed'),
  ('Pizza, cheese', 266, 11, 33, 10, 'seed'),
  ('Burger, beef with bun', 254, 13, 24, 12, 'seed'),
  ('French fries', 312, 3.4, 41, 15, 'seed'),
  ('Doogh / ayran', 38, 1.7, 2.9, 1.5, 'seed'),
  ('Kebab, grilled (koobideh)', 245, 18, 4, 17, 'seed'),
  ('Persian rice with butter (chelow)', 180, 2.5, 32, 4.5, 'seed'),
  ('Ghormeh sabzi', 145, 9, 6, 9.5, 'seed'),
  ('Lavash bread', 275, 9, 56, 1.2, 'seed'),
  ('Falafel', 333, 13, 32, 18, 'seed'),
  ('Soda / cola', 42, 0, 10.6, 0, 'seed'),
  ('Orange juice', 45, 0.7, 10.4, 0.2, 'seed'),
  ('Coffee with milk (latte)', 42, 2.2, 3.6, 2.2, 'seed'),
  ('Ice cream, vanilla', 207, 3.5, 24, 11, 'seed')
ON CONFLICT DO NOTHING;
