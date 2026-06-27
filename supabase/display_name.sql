-- ============================================================
-- Patch Map London — display name (as-typed, caps allowed, no @)
-- Uniqueness is case-insensitive: "Tom" and "tom" can't coexist.
-- Run after social_all.sql. Safe to re-run.
-- ============================================================

-- Store the name exactly as typed (the unique index already lowercases for
-- the comparison, so case-insensitive uniqueness still holds).
create or replace function public.set_username(p_username text)
returns text
language plpgsql security definer set search_path = public as $$
declare clean text;
begin
  if auth.uid() is null then return 'invalid'; end if;
  clean := trim(p_username);                       -- keep original case
  -- 2–24 chars: letters, numbers, spaces, _ . - allowed
  if clean !~ '^[A-Za-z0-9 _.\-]{2,24}$' then return 'invalid'; end if;
  -- case-insensitive uniqueness
  if exists (select 1 from profiles where lower(username) = lower(clean) and user_id <> auth.uid()) then
    return 'taken';
  end if;
  update profiles set username = clean where user_id = auth.uid();
  if not found then
    insert into profiles (user_id, username) values (auth.uid(), clean)
    on conflict (user_id) do update set username = clean;
  end if;
  return 'ok';
end;
$$;
grant execute on function public.set_username(text) to authenticated;

-- Compare lookup: match case-insensitively, return the name as stored (no @).
drop function if exists public.get_user_map(text);
create function public.get_user_map(p_username text)
returns table (display text, place_id text, state smallint)
language sql stable security definer set search_path = public as $$
  select pf.username as display, pr.place_id, pr.state
  from profiles pf
  join progress pr on pr.user_id = pf.user_id
  where lower(pf.username) = lower(trim(p_username))
    and pr.state > 0;
$$;
grant execute on function public.get_user_map(text) to anon, authenticated;

-- Leaderboard: show the name as stored, no @ prefix.
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (display_name text, score int, visited int, hoods int, greens int, photos int, referrals int, rank bigint)
language sql stable security definer set search_path = public as $$
  with scored as (
    select pf.user_id,
           case
             when pf.on_leaderboard = false then 'Anonymous explorer'
             when coalesce(nullif(pf.username,''), '') = '' then 'Anonymous explorer'
             else pf.username
           end as display_name,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2) as visited,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2 and pr.place_id like 'n:%') as hoods,
           (select count(*) from progress pr where pr.user_id = pf.user_id and pr.state = 2 and pr.place_id like 'g:%') as greens,
           (select count(*) from progress pr where pr.user_id = pf.user_id and array_length(pr.tags,1) >= 1) as tagged,
           (select count(*) from photos_meta pm where pm.user_id = pf.user_id) as photos,
           (select count(*) from referrals rf where rf.referrer_user = pf.user_id) as referrals
    from profiles pf
  )
  select display_name,
         (visited*10 + tagged*5 + photos*5 + referrals*25)::int as score,
         visited::int, hoods::int, greens::int, photos::int, referrals::int,
         rank() over (order by (visited*10 + tagged*5 + photos*5 + referrals*25) desc) as rank
  from scored
  where (visited*10 + tagged*5 + photos*5 + referrals*25) > 0
  order by score desc
  limit 200;
$$;
grant execute on function public.get_leaderboard() to anon, authenticated;
