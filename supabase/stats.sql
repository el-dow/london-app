-- ============================================================
-- Patch Map London — Stats functions
-- Communal, aggregated, identity-safe (returns counts only, never who).
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Most-visited places across everyone (place_id + how many people visited).
create or replace function public.top_visited(p_limit int default 20)
returns table (place_id text, visitors int)
language sql stable security definer set search_path = public as $$
  select place_id, count(*)::int as visitors
  from progress
  where state = 2
  group by place_id
  order by visitors desc, place_id
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.top_visited(int) to anon, authenticated;

-- Most "wanted to go" places across everyone.
create or replace function public.top_wanted(p_limit int default 20)
returns table (place_id text, wants int)
language sql stable security definer set search_path = public as $$
  select place_id, count(*)::int as wants
  from progress
  where state = 1
  group by place_id
  order by wants desc, place_id
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.top_wanted(int) to anon, authenticated;

-- Most-used impression tags across everyone (tag + how many place-tags).
create or replace function public.top_tags(p_limit int default 20)
returns table (tag text, uses int)
language sql stable security definer set search_path = public as $$
  select t as tag, count(*)::int as uses
  from progress, unnest(tags) as t
  group by t
  order by uses desc, tag
  limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.top_tags(int) to anon, authenticated;

-- Headline totals for the stats page.
create or replace function public.community_totals()
returns table (explorers int, total_visits int, total_photos int, total_tags int)
language sql stable security definer set search_path = public as $$
  select
    (select count(distinct user_id) from progress)::int,
    (select count(*) from progress where state = 2)::int,
    (select count(*) from photos_meta)::int,
    (select count(*) from progress where array_length(tags,1) >= 1)::int;
$$;
grant execute on function public.community_totals() to anon, authenticated;
