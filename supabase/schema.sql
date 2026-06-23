-- London, on foot — Supabase schema
-- Paste this whole file into your project's SQL editor and run it once.

-- Each user's progress per place
create table if not exists public.progress (
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  state smallint not null default 0,         -- 0 unexplored, 1 want to go, 2 visited
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.progress enable row level security;
create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One profile per user, holding their public share id
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  share_id text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read-only access to someone's map via their share id (no sign-in needed).
-- security definer lets anonymous visitors read just the shared rows.
create or replace function public.get_shared_map(p_share_id text)
returns table (place_id text, state smallint, tags text[], user_id uuid)
language sql
security definer
set search_path = public
as $$
  select pr.place_id, pr.state, pr.tags, pr.user_id
  from progress pr
  join profiles pf on pf.user_id = pr.user_id
  where pf.share_id = p_share_id;
$$;
grant execute on function public.get_shared_map(text) to anon, authenticated;

-- Storage: create a bucket named "photos" in the dashboard and mark it PUBLIC,
-- then run these policies so users can only write inside their own folder:
create policy "users write own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
