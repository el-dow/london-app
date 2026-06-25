-- ============================================================
-- Patch Map London — backfill photos_meta from existing uploads
-- Run once in the Supabase SQL editor if photos added before the rankings
-- update aren't counting toward scores.
--
-- Photos are stored at  photos/{user_id}/{place_id}.jpg  (place_id's ":" was
-- written as "_"). This reads the storage bucket and recreates the meta rows.
-- ============================================================

insert into public.photos_meta (user_id, place_id, created_at)
select
  (split_part(name, '/', 1))::uuid as user_id,
  -- turn "n_soho.jpg" back into "n:soho"
  regexp_replace(split_part(name, '/', 2), '\.jpg$', '')
    as place_raw,
  coalesce(created_at, now())
from storage.objects
where bucket_id = 'photos'
  and name like '%/%'
on conflict (user_id, place_id) do nothing;

-- The place_id stored used "_" instead of ":" for the first separator.
-- Fix those back to the app's id format (n:slug / g:slug).
update public.photos_meta
set place_id = regexp_replace(place_id, '^([ng])_', '\1:')
where place_id ~ '^[ng]_';

-- Check the result:
select user_id, place_id, created_at from public.photos_meta order by created_at desc;
