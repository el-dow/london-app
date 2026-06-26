-- ============================================================
-- Patch Map London — unify identity to a single @username
-- Run after compare.sql. Safe to re-run.
-- The leaderboard / shared map / compare all now show @username.
-- display_name is no longer used (kept in the table but ignored).
-- ============================================================

-- Leaderboard now shows username (or "Anonymous explorer" if hidden / unset).
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (display_name text, score int, visited int, hoods int, greens int, photos int, rank bigint)
language sql stable security definer set search_path = public as $$
  with scored as (
    select pf.user_id,
           case
             when pf.on_leaderboard = false then 'Anonymous explorer'
             when coalesce(nullif(pf.username,''), '') = '' then 'Anonymous explorer'
             else '@' || pf.username
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

-- Compare lookup shows @username as the label.
drop function if exists public.get_user_map(text);
create function public.get_user_map(p_username text)
returns table (display text, place_id text, state smallint)
language sql stable security definer set search_path = public as $$
  select '@' || pf.username as display, pr.place_id, pr.state
  from profiles pf
  join progress pr on pr.user_id = pf.user_id
  where lower(pf.username) = lower(trim(p_username))
    and pr.state > 0;
$$;
grant execute on function public.get_user_map(text) to anon, authenticated;
