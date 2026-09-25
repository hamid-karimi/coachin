-- +goose Up
-- Every ledger reason is a once-only key (workout_log:<sport>:<date>, meal_log:<id>,
-- goal_achieved:<id>, group_streak:<group>:<day>, …) except the plan-item toggle pair,
-- which repeats by design (awards and undos are counted), and legacy's undated
-- workout_log:<sport>. A unique index makes a double award impossible even if a use
-- case's own check races — and protects any new reason kind by default.
--
-- Existing duplicates keep their amounts (balances already include them); the 2nd and
-- later copies get a "#dup<n>" suffix so the index can be built.
WITH ranked AS (
  SELECT id, reason,
         row_number() OVER (PARTITION BY user_id, reason ORDER BY created_at, id) AS n
  FROM public.xp_transactions
  WHERE reason IS NOT NULL
    AND split_part(reason, ':', 1) NOT IN ('plan_item', 'plan_item_undo')
    AND reason !~ '^workout_log:[0-9]+$'
)
UPDATE public.xp_transactions x
SET reason = ranked.reason || '#dup' || ranked.n
FROM ranked
WHERE x.id = ranked.id AND ranked.n > 1;

CREATE UNIQUE INDEX xp_transactions_once_idx ON public.xp_transactions (user_id, reason)
WHERE split_part(reason, ':', 1) NOT IN ('plan_item', 'plan_item_undo')
  AND reason !~ '^workout_log:[0-9]+$';

-- +goose Down
-- The "#dup<n>" suffixes stay: they are harmless labels, and undoing them would
-- recreate the duplicates the Up removed.
DROP INDEX public.xp_transactions_once_idx;
