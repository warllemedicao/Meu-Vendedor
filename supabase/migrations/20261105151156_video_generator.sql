begin;

create table public.mv_video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_product_id uuid references public.mv_products(id) on delete set null,
  parent_id uuid,
  product_data jsonb not null check (
    jsonb_typeof(product_data) = 'object'
    and char_length(coalesce(product_data->>'name', '')) between 2 and 160
  ),
  presenter_id text not null check (presenter_id in ('ana','lucas','carla','rafael')),
  voice_gender text not null check (voice_gender in ('feminina','masculina')),
  voice_profile text not null check (voice_profile in ('jovem-adulta','adulta','grave','suave','energetica','natural','profissional')),
  emotional_tone text not null check (emotional_tone in ('alegre','engracado','serio','emotivo','enfatico','calmo','promocao','persuasivo')),
  advertising_style text not null check (advertising_style in ('tradicional','demonstracao','promocao','humor','influenciador','profissional')),
  duration_seconds integer not null check (duration_seconds in (10,15,20,30,45,60)),
  aspect_ratio text not null check (aspect_ratio in ('9:16','1:1','16:9')),
  generation_mode text not null check (generation_mode in ('ai-video','economy')),
  target_audience text not null default '' check (char_length(target_audience) <= 100),
  script text not null check (char_length(script) between 20 and 4000),
  prompt text not null check (char_length(prompt) between 20 and 12000),
  provider text not null check (provider in ('mock','google-gemini')),
  provider_job_id text check (provider_job_id is null or char_length(provider_job_id) <= 500),
  status text not null check (status in ('awaiting_configuration','ready','awaiting_provider','generating','processing','completed','simulation_completed','failed')),
  result_url text check (result_url is null or (result_url ~ '^https://' and result_url !~ '@')),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key(parent_id,user_id) references public.mv_video_projects(id,user_id) on delete set null (parent_id)
);

create index mv_video_projects_user_created_idx on public.mv_video_projects(user_id,created_at desc);
create index mv_video_projects_source_product_idx on public.mv_video_projects(source_product_id) where source_product_id is not null;
create index mv_video_projects_parent_idx on public.mv_video_projects(parent_id,user_id) where parent_id is not null;

alter table public.mv_video_projects enable row level security;
alter table public.mv_video_projects force row level security;

create policy mv_video_projects_read on public.mv_video_projects
for select to authenticated
using ((select auth.uid()) = user_id);

create policy mv_video_projects_insert on public.mv_video_projects
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (source_product_id is null or exists (
    select 1 from public.mv_products p where p.id = source_product_id and p.user_id = (select auth.uid())
  ))
);

create policy mv_video_projects_update on public.mv_video_projects
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (source_product_id is null or exists (
    select 1 from public.mv_products p where p.id = source_product_id and p.user_id = (select auth.uid())
  ))
);

create policy mv_video_projects_delete on public.mv_video_projects
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.mv_video_projects from public,anon,authenticated;
grant select on public.mv_video_projects to authenticated;
grant insert (
  id,source_product_id,parent_id,product_data,presenter_id,voice_gender,voice_profile,
  emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,
  target_audience,script,prompt,provider,provider_job_id,status,result_url,error_code
) on public.mv_video_projects to authenticated;
grant update (
  source_product_id,parent_id,product_data,presenter_id,voice_gender,voice_profile,
  emotional_tone,advertising_style,duration_seconds,aspect_ratio,generation_mode,
  target_audience,script,prompt,provider,provider_job_id,status,result_url,error_code
) on public.mv_video_projects to authenticated;
grant delete on public.mv_video_projects to authenticated;
grant all on public.mv_video_projects to service_role;

create trigger mv_video_projects_updated
before update on public.mv_video_projects
for each row execute function public.mv_set_updated_at();

commit;
