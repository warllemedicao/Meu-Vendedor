-- Character reference library isolated from product photos and Google Flow robot assets.
create table if not exists public.mv_story_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1200),
  voice text not null default '' check (char_length(voice) <= 450),
  image_prompt text not null default '' check (char_length(image_prompt) <= 1600),
  storage_path text not null check (char_length(storage_path) between 5 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists mv_story_characters_user_idx
  on public.mv_story_characters(user_id, updated_at desc);
alter table public.mv_story_characters enable row level security;
create policy "Story character library owner select" on public.mv_story_characters
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Story character library owner insert" on public.mv_story_characters
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
create policy "Story character library owner update" on public.mv_story_characters
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text);
create policy "Story character library owner delete" on public.mv_story_characters
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.mv_story_characters to authenticated;
