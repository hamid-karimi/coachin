-- Progress photos (share-progress plan phase 2): an occasional photo journal
-- separate from the 5-photo AI-analysis set. Same private bucket, same
-- owner-only policies (metadata rows reuse body_photos).

-- 1) Allow the new kind.
ALTER TABLE public.body_photos
  DROP CONSTRAINT IF EXISTS body_photos_kind_check;
ALTER TABLE public.body_photos
  ADD CONSTRAINT body_photos_kind_check
  CHECK (kind IN ('body_photo', 'analysis_report', 'progress'));

-- 2) Per-kind caps: body_photo keeps its 5 (analysis set), progress gets a
--    journal-sized 24. Replaces the body_photo-only cap function; the app
--    enforces the same limits — this is the backstop.
CREATE OR REPLACE FUNCTION public.enforce_body_photo_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap int;
  v_count int;
BEGIN
  v_cap := CASE NEW.kind
    WHEN 'body_photo' THEN 5
    WHEN 'progress' THEN 24
    ELSE NULL
  END;
  IF v_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.body_photos
    WHERE user_id = NEW.user_id AND kind = NEW.kind;
    IF v_count >= v_cap THEN
      RAISE EXCEPTION '% limit reached (max %)', NEW.kind, v_cap;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger body_photos_cap already exists (20260704170000) and calls this
-- function; replacing the function body is enough.
