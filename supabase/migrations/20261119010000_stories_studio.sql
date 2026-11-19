-- Histórias: dados isolados do estúdio de produtos e do robô Google Flow.
create table if not exists public.mv_story_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 160),
  title text not null check (char_length(title) between 3 and 220),
  genre text not null default 'geral',
  synopsis text not null default '',
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, subject, title)
);
create index if not exists mv_story_topics_user_subject_idx on public.mv_story_topics (user_id, subject, created_at desc);

create table if not exists public.mv_story_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.mv_story_topics(id) on delete set null,
  title text not null check (char_length(title) between 3 and 220),
  genre text not null default 'geral',
  characters jsonb not null default '[]'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','in_production','completed')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mv_story_projects_user_idx on public.mv_story_projects (user_id, updated_at desc);

create table if not exists public.mv_story_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.mv_story_projects(id) on delete cascade,
  scene_number integer not null check (scene_number between 1 and 12),
  platform text not null check (platform in ('youtube-create','google-flow','dreamina')),
  prompt text not null check (char_length(prompt) between 1 and 6000),
  created_at timestamptz not null default now(),
  unique (project_id, scene_number, platform)
);
create index if not exists mv_story_prompts_user_idx on public.mv_story_prompts (user_id, project_id);

create table if not exists public.mv_story_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.mv_story_projects(id) on delete cascade,
  scene_number integer not null check (scene_number between 1 and 12),
  storage_path text not null,
  duration_seconds numeric(6,2) check (duration_seconds > 0 and duration_seconds <= 30),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, scene_number)
);
create index if not exists mv_story_clips_user_idx on public.mv_story_clips (user_id, project_id);

alter table public.mv_story_topics enable row level security;
alter table public.mv_story_projects enable row level security;
alter table public.mv_story_prompts enable row level security;
alter table public.mv_story_clips enable row level security;

create policy "Topics are private" on public.mv_story_topics
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Projects are private" on public.mv_story_projects
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Prompts are private" on public.mv_story_prompts
  for all to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.mv_story_projects p where p.id = project_id and p.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.mv_story_projects p where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
create policy "Clips are private" on public.mv_story_clips
  for all to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.mv_story_projects p where p.id = project_id and p.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.mv_story_projects p where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.mv_story_topics to authenticated;
grant select, insert, update, delete on public.mv_story_projects to authenticated;
grant select, insert, update, delete on public.mv_story_prompts to authenticated;
grant select, insert, update, delete on public.mv_story_clips to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mv-story-clips', 'mv-story-clips', false, 104857600, array['video/mp4'])
on conflict (id) do nothing;

create policy "Story clips upload by owner" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mv-story-clips' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Story clips read by owner" on storage.objects
  for select to authenticated using (
    bucket_id = 'mv-story-clips' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Story clips delete by owner" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mv-story-clips' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Referências visuais independentes dos clipes e privadas por usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mv-story-images', 'mv-story-images', false, 10485760,
  array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy "Story images upload by owner" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mv-story-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Story images read by owner" on storage.objects
  for select to authenticated using (
    bucket_id = 'mv-story-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Story images delete by owner" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mv-story-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
