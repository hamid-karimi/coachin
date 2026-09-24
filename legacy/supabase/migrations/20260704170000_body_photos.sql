-- Body photos (roadmap branch 3): private storage + metadata + consent.
-- Max 5 progress photos per user; analysis-report photos feed measurements.

-- 1) AI-analysis consent timestamp on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_photo_consent_at timestamp with time zone;

-- 2) Private storage bucket (id doubles as the name)
INSERT INTO storage.buckets (id, name, public)
VALUES ('body-photos', 'body-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only object access: first path segment must be the user's id
-- (upload paths are always '{user_id}/{uuid}.jpg').
DROP POLICY IF EXISTS body_photos_objects_select_own ON storage.objects;
CREATE POLICY body_photos_objects_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'body-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS body_photos_objects_insert_own ON storage.objects;
CREATE POLICY body_photos_objects_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'body-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS body_photos_objects_delete_own ON storage.objects;
CREATE POLICY body_photos_objects_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'body-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Photo metadata
CREATE TABLE IF NOT EXISTS public.body_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('body_photo', 'analysis_report')),
  analysis jsonb,
  analyzed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT body_photos_pkey PRIMARY KEY (id),
  CONSTRAINT body_photos_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT body_photos_storage_path_unique UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS body_photos_user_idx
  ON public.body_photos (user_id, created_at DESC);

ALTER TABLE public.body_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_photos_select_self ON public.body_photos;
CREATE POLICY body_photos_select_self
ON public.body_photos
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS body_photos_insert_self ON public.body_photos;
CREATE POLICY body_photos_insert_self
ON public.body_photos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS body_photos_update_self ON public.body_photos;
CREATE POLICY body_photos_update_self
ON public.body_photos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS body_photos_delete_self ON public.body_photos;
CREATE POLICY body_photos_delete_self
ON public.body_photos
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 4) Hard cap: max 5 progress photos per user (app enforces too; this is
--    the backstop against races/direct inserts)
CREATE OR REPLACE FUNCTION public.enforce_body_photo_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind = 'body_photo' AND (
    SELECT COUNT(*) FROM public.body_photos
    WHERE user_id = NEW.user_id AND kind = 'body_photo'
  ) >= 5 THEN
    RAISE EXCEPTION 'body photo limit reached (max 5)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS body_photos_cap ON public.body_photos;
CREATE TRIGGER body_photos_cap
BEFORE INSERT ON public.body_photos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_body_photo_cap();
