-- ============================================================
-- Patch Map London — leaderboard v2
-- Everyone is on the leaderboard. The on_leaderboard flag now means
-- "show my name"; when off (or no name set) others see "Anonymous explorer".
-- Run in the Supabase SQL editor after rankings.sql. Safe to re-run.
-- ============================================================

-- Default the visibility flag to true so names show unless someone opts out.
alter table public.profiles alter column on_leaderboard set default true;

-- Anyone who has a profile but never touched the flag: leave as-is, but the
-- function below treats only an explicit false as "hide name".

create or replace function public.get_leaderboard()
returns table (display_name text, score int, visited int, hoods int, greens int, photos int, rank bigint)
language sql stable security definer set search_path = public as $$
  with scored as (
    select pf.user_id,
           case
             when pf.on_leaderboard = false then 'Anonymous explorer'
             when coalesce(nullif(pf.display_name,''), '') = '' then 'Anonymous explorer'
             else pf.display_name
           end as display_name,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2) as visited,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2 and pr.place_id like 'n:%') as hoods,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2 and pr.place_id like 'g:%') as greens,
           (select count(*) from progress pr where pr.user_id = pf.user_id and array_length(pr.tags,1) >= 1) as tagged,
           (select count(*) from photos_meta pm where pm.user_id = pf.user_id) as photos
    from profiles pf
  )
  select display_name,
         (visited*10 + tagged*5 + photos*5)::int as score,
         visited::int, hoods::int, greens::int, photos::int,
         rank() over (order by (visited*10 + tagged*5 + photos*5) desc) as rank
  from scored
  where (visited*10 + tagged*5 + photos*5) > 0
  order by score desc
  limit 200;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
