-- ============================================================
-- Patch Map London — usernames + friend compare
-- Run in the Supabase SQL editor after the earlier migrations. Safe to re-run.
-- ============================================================

-- 1. Unique, changeable username (case-insensitive uniqueness).
alter table public.profiles
  add column if not exists username text;

-- Enforce case-insensitive uniqueness via a functional unique index.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

-- 2. Set / change your own username. Returns 'ok', 'taken', or 'invalid'.
create or replace function public.set_username(p_username text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  clean text;
begin
  if auth.uid() is null then return 'invalid'; end if;
  clean := lower(trim(p_username));
  -- 3–20 chars, letters/numbers/underscore only
  if clean !~ '^[a-z0-9_]{3,20}$' then
    return 'invalid';
  end if;
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

-- 3. Look up another explorer's map by username, for comparison.
--    Returns only their visited/wanted place_ids + display label — never email.
create or replace function public.get_user_map(p_username text)
returns table (display text, place_id text, state smallint)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(pf.display_name,''), pf.username) as display,
    pr.place_id, pr.state
  from profiles pf
  join progress pr on pr.user_id = pf.user_id
  where lower(pf.username) = lower(trim(p_username))
    and pr.state > 0;
$$;
grant execute on function public.get_user_map(text) to anon, authenticated;

-- 4. Does a username exist? (for nicer search feedback)
create or replace function public.username_exists(p_username text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where lower(username) = lower(trim(p_username)));
$$;
grant execute on function public.username_exists(text) to anon, authenticated;
