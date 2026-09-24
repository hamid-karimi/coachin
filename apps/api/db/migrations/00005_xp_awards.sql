-- +goose Up
-- XP awards move from the web app into Go use cases (ADR-5): the API writes
-- the ledger row itself, inside the same transaction as the log it rewards.
CREATE POLICY xp_transactions_insert_self ON public.xp_transactions
  FOR INSERT TO coachin_app
  WITH CHECK (user_id = app.current_user_id());

-- +goose Down
DROP POLICY xp_transactions_insert_self ON public.xp_transactions;
