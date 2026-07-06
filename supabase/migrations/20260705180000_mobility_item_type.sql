-- Phase 4 (adaptive training): add 'mobility' to plan_items.item_type.
-- Drop + re-add the CHECK so existing rows stay valid (all current values
-- remain in the allowed set). RPCs don't re-validate item_type — the table
-- constraint is the single enforcement point.

ALTER TABLE public.plan_items
  DROP CONSTRAINT IF EXISTS plan_items_item_type_check;

ALTER TABLE public.plan_items
  ADD CONSTRAINT plan_items_item_type_check CHECK (item_type IN (
    'run', 'strength', 'stretch', 'mobility', 'recovery', 'meal_note'
  ));
