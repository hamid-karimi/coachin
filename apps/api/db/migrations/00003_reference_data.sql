-- Reference data the app needs to work, carried over from the legacy seed
-- migrations (sport types from 20260707121000, the starter food catalogue from
-- 20260705120000). Ids and timestamps are left to the database; the Supabase
-- importer (plan Phase 7) replaces these rows with production's, ids included,
-- because schedules and meal logs reference them.
--
-- The core sports (Running … Mobility) were hand-entered in production and are
-- in no legacy migration; they are added here so a fresh database can onboard.
-- Their xp_multiplier is the neutral 1.0 (FORMULAS.md §1) until the import
-- brings production's values.

-- +goose Up
INSERT INTO public.sport_types (name, xp_multiplier) VALUES
  ('Running', 1),
  ('Strength training', 1),
  ('Swimming', 1),
  ('Cycling', 1),
  ('Yoga', 1),
  ('Mobility', 1),
  ('Football', 1),
  ('Basketball', 1),
  ('Boxing', 1),
  ('Tennis', 1),
  ('Volleyball', 1),
  ('Martial arts', 1),
  ('Climbing', 1),
  ('Hiking', 1),
  ('Rowing', 1),
  ('Dance', 1),
  ('Table tennis', 1),
  ('Badminton', 1)
;

INSERT INTO public.foods (name, brand, kcal_per_100g, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, source) VALUES
  ('Almonds', NULL, 579, 21, 22, 50, NULL, NULL, NULL, 'seed'),
  ('Apple', NULL, 52, 0.3, 14, 0.2, NULL, NULL, NULL, 'seed'),
  ('Avocado', NULL, 160, 2, 8.5, 15, NULL, NULL, NULL, 'seed'),
  ('Banana', NULL, 89, 1.1, 23, 0.3, NULL, NULL, NULL, 'seed'),
  ('Beef, lean, cooked', NULL, 250, 26, 0, 15, NULL, NULL, NULL, 'seed'),
  ('Bell pepper', NULL, 26, 1, 6, 0.3, NULL, NULL, NULL, 'seed'),
  ('Black beans, cooked', NULL, 132, 8.9, 24, 0.5, NULL, NULL, NULL, 'seed'),
  ('Blueberries', NULL, 57, 0.7, 14, 0.3, NULL, NULL, NULL, 'seed'),
  ('Bread, white', NULL, 265, 9, 49, 3.2, NULL, NULL, NULL, 'seed'),
  ('Bread, whole wheat', NULL, 247, 13, 41, 3.4, NULL, NULL, NULL, 'seed'),
  ('Broccoli, cooked', NULL, 35, 2.4, 7.2, 0.4, NULL, NULL, NULL, 'seed'),
  ('Brown rice, cooked', NULL, 112, 2.6, 24, 0.9, NULL, NULL, NULL, 'seed'),
  ('Burger, beef with bun', NULL, 254, 13, 24, 12, NULL, NULL, NULL, 'seed'),
  ('Butter', NULL, 717, 0.9, 0.1, 81, NULL, NULL, NULL, 'seed'),
  ('Carrot', NULL, 41, 0.9, 9.6, 0.2, NULL, NULL, NULL, 'seed'),
  ('Cheese, cheddar', NULL, 403, 25, 1.3, 33, NULL, NULL, NULL, 'seed'),
  ('Cheese, feta', NULL, 264, 14, 4.1, 21, NULL, NULL, NULL, 'seed'),
  ('Chicken breast, cooked', NULL, 165, 31, 0, 3.6, NULL, NULL, NULL, 'seed'),
  ('Chicken thigh, cooked', NULL, 209, 26, 0, 10.9, NULL, NULL, NULL, 'seed'),
  ('Chickpeas, cooked', NULL, 164, 8.9, 27, 2.6, NULL, NULL, NULL, 'seed'),
  ('Coffee with milk (latte)', NULL, 42, 2.2, 3.6, 2.2, NULL, NULL, NULL, 'seed'),
  ('Corn tortilla', NULL, 218, 5.7, 45, 2.9, NULL, NULL, NULL, 'seed'),
  ('Cottage cheese', NULL, 98, 11, 3.4, 4.3, NULL, NULL, NULL, 'seed'),
  ('Cucumber', NULL, 15, 0.7, 3.6, 0.1, NULL, NULL, NULL, 'seed'),
  ('Dark chocolate 70%', NULL, 598, 7.8, 46, 43, NULL, NULL, NULL, 'seed'),
  ('Dates', NULL, 277, 1.8, 75, 0.2, NULL, NULL, NULL, 'seed'),
  ('Doogh / ayran', NULL, 38, 1.7, 2.9, 1.5, NULL, NULL, NULL, 'seed'),
  ('Egg white', NULL, 52, 11, 0.7, 0.2, NULL, NULL, NULL, 'seed'),
  ('Egg, whole', NULL, 155, 13, 1.1, 11, NULL, NULL, NULL, 'seed'),
  ('Falafel', NULL, 333, 13, 32, 18, NULL, NULL, NULL, 'seed'),
  ('French fries', NULL, 312, 3.4, 41, 15, NULL, NULL, NULL, 'seed'),
  ('Ghormeh sabzi', NULL, 145, 9, 6, 9.5, NULL, NULL, NULL, 'seed'),
  ('Granola', NULL, 471, 10, 64, 20, NULL, NULL, NULL, 'seed'),
  ('Grapes', NULL, 69, 0.7, 18, 0.2, NULL, NULL, NULL, 'seed'),
  ('Greek yogurt, plain', NULL, 59, 10, 3.6, 0.4, NULL, NULL, NULL, 'seed'),
  ('Ground beef 85/15, cooked', NULL, 250, 25, 0, 16, NULL, NULL, NULL, 'seed'),
  ('Honey', NULL, 304, 0.3, 82, 0, NULL, NULL, NULL, 'seed'),
  ('Hummus', NULL, 166, 7.9, 14, 9.6, NULL, NULL, NULL, 'seed'),
  ('Ice cream, vanilla', NULL, 207, 3.5, 24, 11, NULL, NULL, NULL, 'seed'),
  ('Kebab, grilled (koobideh)', NULL, 245, 18, 4, 17, NULL, NULL, NULL, 'seed'),
  ('Lavash bread', NULL, 275, 9, 56, 1.2, NULL, NULL, NULL, 'seed'),
  ('Lentils, cooked', NULL, 116, 9, 20, 0.4, NULL, NULL, NULL, 'seed'),
  ('Lettuce', NULL, 15, 1.4, 2.9, 0.2, NULL, NULL, NULL, 'seed'),
  ('Milk, skim', NULL, 34, 3.4, 5, 0.1, NULL, NULL, NULL, 'seed'),
  ('Milk, whole', NULL, 61, 3.2, 4.8, 3.3, NULL, NULL, NULL, 'seed'),
  ('Mushrooms', NULL, 22, 3.1, 3.3, 0.3, NULL, NULL, NULL, 'seed'),
  ('Oats, dry', NULL, 389, 17, 66, 6.9, NULL, NULL, NULL, 'seed'),
  ('Olive oil', NULL, 884, 0, 0, 100, NULL, NULL, NULL, 'seed'),
  ('Onion', NULL, 40, 1.1, 9.3, 0.1, NULL, NULL, NULL, 'seed'),
  ('Orange', NULL, 47, 0.9, 12, 0.1, NULL, NULL, NULL, 'seed'),
  ('Orange juice', NULL, 45, 0.7, 10.4, 0.2, NULL, NULL, NULL, 'seed'),
  ('Pasta, cooked', NULL, 158, 5.8, 31, 0.9, NULL, NULL, NULL, 'seed'),
  ('Peanut butter', NULL, 588, 25, 20, 50, NULL, NULL, NULL, 'seed'),
  ('Persian rice with butter (chelow)', NULL, 180, 2.5, 32, 4.5, NULL, NULL, NULL, 'seed'),
  ('Pita bread', NULL, 275, 9.1, 55, 1.2, NULL, NULL, NULL, 'seed'),
  ('Pizza, cheese', NULL, 266, 11, 33, 10, NULL, NULL, NULL, 'seed'),
  ('Potato, boiled', NULL, 87, 1.9, 20, 0.1, NULL, NULL, NULL, 'seed'),
  ('Protein powder (whey)', NULL, 400, 80, 8, 7, NULL, NULL, NULL, 'seed'),
  ('Quinoa, cooked', NULL, 120, 4.4, 21, 1.9, NULL, NULL, NULL, 'seed'),
  ('Salmon, cooked', NULL, 208, 20, 0, 13, NULL, NULL, NULL, 'seed'),
  ('Shrimp, cooked', NULL, 99, 24, 0, 0.3, NULL, NULL, NULL, 'seed'),
  ('Soda / cola', NULL, 42, 0, 10.6, 0, NULL, NULL, NULL, 'seed'),
  ('Spinach, raw', NULL, 23, 2.9, 3.6, 0.4, NULL, NULL, NULL, 'seed'),
  ('Strawberries', NULL, 32, 0.7, 7.7, 0.3, NULL, NULL, NULL, 'seed'),
  ('Sugar', NULL, 387, 0, 100, 0, NULL, NULL, NULL, 'seed'),
  ('Sweet potato, baked', NULL, 90, 2, 21, 0.2, NULL, NULL, NULL, 'seed'),
  ('Tofu, firm', NULL, 76, 8, 1.9, 4.8, NULL, NULL, NULL, 'seed'),
  ('Tomato', NULL, 18, 0.9, 3.9, 0.2, NULL, NULL, NULL, 'seed'),
  ('Tuna, canned in water', NULL, 116, 26, 0, 1, NULL, NULL, NULL, 'seed'),
  ('Walnuts', NULL, 654, 15, 14, 65, NULL, NULL, NULL, 'seed'),
  ('Watermelon', NULL, 30, 0.6, 7.6, 0.2, NULL, NULL, NULL, 'seed'),
  ('White rice, cooked', NULL, 130, 2.7, 28, 0.3, NULL, NULL, NULL, 'seed'),
  ('Yogurt, plain whole milk', NULL, 61, 3.5, 4.7, 3.3, NULL, NULL, NULL, 'seed')
;

-- +goose Down
DELETE FROM public.foods WHERE created_by IS NULL;
DELETE FROM public.sport_types;
