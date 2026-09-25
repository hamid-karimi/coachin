-- name: CountPhotosByKind :many
SELECT kind, count(*)::int AS n FROM public.body_photos WHERE user_id = sqlc.arg(user_id) GROUP BY kind;

-- name: InsertPhotoUnderCap :one
-- Inserts only while the user has fewer than max_count of that kind (the
-- caller holds the profile lock, so concurrent uploads can't both pass).
INSERT INTO public.body_photos (user_id, storage_path, kind)
SELECT sqlc.arg(user_id)::uuid, sqlc.arg(storage_path)::text, sqlc.arg(kind)::text
WHERE (SELECT count(*) FROM public.body_photos WHERE user_id = sqlc.arg(user_id)::uuid AND kind = sqlc.arg(kind)::text) < sqlc.arg(max_count)::int
RETURNING id;

-- name: ListPhotos :many
SELECT id, kind, created_at, analysis, analyzed_at FROM public.body_photos
WHERE user_id = sqlc.arg(user_id)
ORDER BY created_at DESC;

-- name: PhotoPath :one
SELECT storage_path FROM public.body_photos WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: DeletePhoto :one
DELETE FROM public.body_photos WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id)
RETURNING storage_path;
