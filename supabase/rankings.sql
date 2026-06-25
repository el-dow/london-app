-- ============================================================
-- Patch Map London — Rankings / leaderboard migration
-- Run this in the Supabase SQL editor AFTER the original schema.sql.
-- Safe to run more than once.
-- ============================================================

-- 1. Profile gets a display name and a leaderboard opt-in flag.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists on_leaderboard boolean not null default false;

-- 2. Scoring rules live in one place so they're easy to change.
--    visited = 10, first tag on a place = 5, photo = 5.
--    Photos are tracked in their own tiny table so a score can count them
--    without reading the (private) storage bucket.
create table if not exists public.photos_meta (
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.photos_meta enable row level security;
create policy "own photos_meta" on public.photos_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. A per-user score function (used for "my score" breakdown).
create or replace function public.my_score()
returns table (visited_pts int, tag_pts int, photo_pts int, total int)
language sql stable security definer set search_path = public as $$
  with v as (select count(*) c from progress where user_id = auth.uid() and state = 2),
       t as (select count(*) c from progress where user_id = auth.uid() and array_length(tags,1) >= 1),
       p as (select count(*) c from photos_meta where user_id = auth.uid())
  select (v.c*10)::int, (t.c*5)::int, (p.c*5)::int,
         (v.c*10 + t.c*5 + p.c*5)::int
  from v, t, p;
$$;
grant execute on function public.my_score() to authenticated;

-- 4. The public leaderboard. Returns ONLY opted-in users, and ONLY their
--    chosen display name + computed score — never email, never raw progress.
--    security definer lets it read across users for the ranking; the WHERE
--    clause is the privacy gate.
create or replace function public.get_leaderboard()
returns table (display_name text, score int, visited int, places int, photos int, rank bigint)
language sql stable security definer set search_path = public as $$
  with scored as (
    select pf.user_id,
           coalesce(nullif(pf.display_name,''), 'Anonymous explorer') as display_name,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2) as visited,
           (select count(*) from progress pr where pr.user_id = pf.user_id and (pr.state > 0 or array_length(pr.tags,1) >= 1)) as places,
           (select count(*) from progress pr where pr.user_id = pf.user_id and array_length(pr.tags,1) >= 1) as tagged,
           (select count(*) from photos_meta pm where pm.user_id = pf.user_id) as photos
    from profiles pf
    where pf.on_leaderboard = true
  )
  select display_name,
         (visited*10 + tagged*5 + photos*5)::int as score,
         visited::int, places::int, photos::int,
         rank() over (order by (visited*10 + tagged*5 + photos*5) desc) as rank
  from scored
  order by score desc
  limit 200;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
