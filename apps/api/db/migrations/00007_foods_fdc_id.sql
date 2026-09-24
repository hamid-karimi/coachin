-- +goose Up
-- USDA foods are logged by their FoodData Central id: the API re-reads the
-- nutrients from USDA (the legacy app trusted client-posted values) and keeps
-- one shared row per USDA food instead of a new row per log.
ALTER TABLE public.foods ADD COLUMN fdc_id integer;
CREATE UNIQUE INDEX foods_fdc_id_key ON public.foods (fdc_id) WHERE fdc_id IS NOT NULL;

-- +goose Down
DROP INDEX public.foods_fdc_id_key;
ALTER TABLE public.foods DROP COLUMN fdc_id;
