-- ============================================================
-- Patch Map London — combined social migration
-- Adds: unique @username (the single identity, no separate display name),
--       friend compare, and referrals.
-- Run this whole file once in the Supabase SQL editor. Safe to re-run.
-- (Replaces the need to run compare.sql, unify_identity.sql, referrals.sql
--  separately — it includes all three, in the correct order.)
-- ============================================================

-- ---------- 1. Username (unique, case-insensitive, changeable) ----------
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.set_username(p_username text)
returns text
language plpgsql security definer set search_path = public as $$
declare clean text;
begin
  if auth.uid() is null then return 'invalid'; end if;
  clean := lower(trim(p_username));
  if clean !~ '^[a-z0-9_]{3,20}$' then return 'invalid'; end if;
  if exists (select 1 from profiles where lower(username) = clean and user_id <> auth.uid()) then
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

-- ---------- 2. Compare: fetch another explorer's map by username ----------
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

-- ---------- 3. Referrals ----------
create table if not exists public.referrals (
  referred_user uuid primary key references auth.users on delete cascade,
  referrer_user uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
drop policy if exists "see own referrals" on public.referrals;
create policy "see own referrals" on public.referrals
  for select using (auth.uid() = referrer_user);

create or replace function public.claim_referral(p_ref_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare ref_uid uuid; me uuid := auth.uid();
begin
  if me is null then return 'no_session'; end if;
  if exists (select 1 from referrals where referred_user = me) then return 'already'; end if;
  select user_id into ref_uid from profiles where share_id = p_ref_code;
  if ref_uid is null then return 'bad_code'; end if;
  if ref_uid = me then return 'self'; end if;
  insert into referrals (referred_user, referrer_user) values (me, ref_uid)
  on conflict (referred_user) do nothing;
  return 'ok';
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

create or replace function public.my_referrals()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from referrals where referrer_user = auth.uid();
$$;
grant execute on function public.my_referrals() to authenticated;

-- ---------- 4. Score (with referral points) ----------
drop function if exists public.my_score();
create function public.my_score()
returns table (visited_pts int, tag_pts int, photo_pts int, referral_pts int, total int)
language sql stable security definer set search_path = public as $$
  with v as (select count(*) c from progress where user_id = auth.uid() and state = 2),
       t as (select count(*) c from progress where user_id = auth.uid() and array_length(tags,1) >= 1),
       p as (select count(*) c from photos_meta where user_id = auth.uid()),
       r as (select count(*) c from referrals where referrer_user = auth.uid())
  select (v.c*10)::int, (t.c*5)::int, (p.c*5)::int, (r.c*25)::int,
         (v.c*10 + t.c*5 + p.c*5 + r.c*25)::int
  from v, t, p, r;
$$;
grant execute on function public.my_score() to authenticated;

-- ---------- 5. Leaderboard (username identity + referral points) ----------
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table (display_name text, score int, visited int, hoods int, greens int, photos int, referrals int, rank bigint)
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
