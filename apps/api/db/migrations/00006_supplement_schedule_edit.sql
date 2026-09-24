-- +goose Up
-- The baseline has no UPDATE policy on supplements, so editing a schedule
-- silently changed nothing. Owners may update their own rows.
CREATE POLICY supplements_update_self ON public.supplements
  FOR UPDATE TO coachin_app
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- +goose Down
DROP POLICY supplements_update_self ON public.supplements;
