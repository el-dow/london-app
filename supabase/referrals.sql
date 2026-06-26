-- ============================================================
-- Patch Map London — referrals
-- Each user's share_id doubles as their referral code (?ref=<share_id>).
-- Run after the earlier migrations. Safe to re-run.
-- ============================================================

-- Who referred whom. One row per referred user (can only be referred once).
create table if not exists public.referrals (
  referred_user uuid primary key references auth.users on delete cascade,
  referrer_user uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
-- Users can see referrals where they are the referrer (to count their own).
create policy "see own referrals" on public.referrals
  for select using (auth.uid() = referrer_user);

-- Claim a referral: called once by a freshly signed-in user who arrived with a
-- ref code. security definer so it can look up the referrer by share_id and
-- insert the row under RLS. Guards against self-referral and double-claims.
create or replace function public.claim_referral(p_ref_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ref_uid uuid;
  me uuid := auth.uid();
begin
  if me is null then return 'no_session'; end if;
  -- already referred?
  if exists (select 1 from referrals where referred_user = me) then
    return 'already';
  end if;
  -- find the referrer by their share_id
  select user_id into ref_uid from profiles where share_id = p_ref_code;
  if ref_uid is null then return 'bad_code'; end if;
  if ref_uid = me then return 'self'; end if;
  insert into referrals (referred_user, referrer_user) values (me, ref_uid)
  on conflict (referred_user) do nothing;
  return 'ok';
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

-- How many people have I referred?
create or replace function public.my_referrals()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from referrals where referrer_user = auth.uid();
$$;
grant execute on function public.my_referrals() to authenticated;

-- Update the score to include referral points (25 each — referrals are gold).
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

-- Include referral points in the public leaderboard score too.
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
