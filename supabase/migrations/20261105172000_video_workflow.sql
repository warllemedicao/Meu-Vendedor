begin;

alter table public.mv_video_projects
  add column template_id text not null default 'presenting-product'
    check (template_id in ('wearing-product','presenting-product','demonstrating-product')),
  add column scene_preset_id text not null default 'beauty-counter',
  add column narration_mode text not null default 'voiceover'
    check (narration_mode in ('character-speech','voiceover')),
  add column motion_mode text not null default 'poses'
    check (motion_mode in ('poses','continuous')),
  add column result_storage_path text
    check (result_storage_path is null or result_storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]+$');

alter table public.mv_video_projects
  drop constraint if exists mv_video_projects_duration_seconds_check,
  add constraint mv_video_projects_duration_seconds_check
    check (duration_seconds in (6,7,8,10,15,20,30,45,60));

alter table public.mv_video_projects
  drop constraint if exists mv_video_projects_provider_check,
  add constraint mv_video_projects_provider_check
    check (provider in ('mock','google-gemini','huggingface','modal')),
  drop constraint if exists mv_video_projects_status_check,
  add constraint mv_video_projects_status_check
    check (status in ('awaiting_configuration','ready','awaiting_provider','generating','processing','completed','simulation_completed','failed','cancelled'));

grant insert (template_id,scene_preset_id,narration_mode,motion_mode)
on public.mv_video_projects to authenticated;
grant update (template_id,scene_preset_id,narration_mode,motion_mode)
on public.mv_video_projects to authenticated;

drop policy if exists mv_video_projects_insert on public.mv_video_projects;
create policy mv_video_projects_insert on public.mv_video_projects
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and provider = 'mock'
  and status = 'simulation_completed'
  and result_url is null
  and result_storage_path is null
  and error_code is null
  and (source_product_id is null or exists (
    select 1 from public.mv_products p where p.id = source_product_id and p.user_id = (select auth.uid())
  ))
);

revoke update (provider,provider_job_id,status,result_url,result_storage_path,error_code)
on public.mv_video_projects from authenticated;

create table public.mv_video_scenes (
  id text primary key check (id ~ '^[a-z0-9-]{2,80}$'),
  template_id text not null check (template_id in ('wearing-product','presenting-product','demonstrating-product')),
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (category in ('Moda','Limpeza','Beleza','Eletrônicos','Utilidades')),
  compatible_product_types text[] not null default '{}',
  base_asset_path text,
  duration_seconds integer not null default 8 check (duration_seconds between 1 and 8),
  aspect_ratio text not null default '9:16' check (aspect_ratio = '9:16'),
  replaceable_regions jsonb not null default '[]'::jsonb check (jsonb_typeof(replaceable_regions) = 'array'),
  tracking_points jsonb not null default '[]'::jsonb check (jsonb_typeof(tracking_points) = 'array'),
  movement_type text not null check (movement_type in ('poses','continuous','camera-only')),
  gpu_required boolean not null default false,
  estimated_cost_usd numeric(10,4),
  availability text not null default 'planned' check (availability in ('planned','ready','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (availability <> 'ready' or base_asset_path is not null),
  check (base_asset_path is null or base_asset_path !~ '(^/|(^|/)\.\.(/|$))'),
  unique (id,template_id)
);

insert into public.mv_video_scenes
  (id,template_id,name,category,compatible_product_types,movement_type,availability)
values
  ('fashion-studio','wearing-product','Estúdio de moda','Moda',array['vestuário','acessórios'],'poses','planned'),
  ('everyday-outfit','wearing-product','Ambiente cotidiano','Moda',array['vestuário','acessórios'],'continuous','planned'),
  ('beauty-counter','presenting-product','Bancada de beleza','Beleza',array['beleza','perfume','cosméticos'],'poses','planned'),
  ('neutral-product-table','presenting-product','Mesa de apresentação','Utilidades',array['eletrônicos','utilidades','beleza'],'camera-only','planned'),
  ('electronics-studio','presenting-product','Estúdio de eletrônicos','Eletrônicos',array['eletrônicos','acessórios'],'camera-only','planned'),
  ('cleaning-kitchen','demonstrating-product','Cozinha','Limpeza',array['limpeza','utilidades domésticas'],'continuous','planned'),
  ('bathroom-counter','demonstrating-product','Bancada de banheiro','Limpeza',array['limpeza','beleza'],'poses','planned')
on conflict (id) do nothing;

alter table public.mv_video_projects
  add constraint mv_video_projects_scene_template_fk
  foreign key (scene_preset_id,template_id)
  references public.mv_video_scenes(id,template_id);

create index mv_video_scenes_available_idx on public.mv_video_scenes(template_id,category)
where availability = 'ready';

alter table public.mv_video_scenes enable row level security;
alter table public.mv_video_scenes force row level security;
create policy mv_video_scenes_read on public.mv_video_scenes
for select to authenticated using (true);
create trigger mv_video_scenes_updated
before update on public.mv_video_scenes
for each row execute function public.mv_set_updated_at();
revoke all on public.mv_video_scenes from public,anon,authenticated;
grant select on public.mv_video_scenes to authenticated;
grant all on public.mv_video_scenes to service_role;

create table public.mv_video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  request_data jsonb not null check (jsonb_typeof(request_data) = 'object' and octet_length(request_data::text) <= 16384),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  provider text not null default 'pending' check (provider in ('pending','gemini','huggingface','modal')),
  provider_job_id text check (provider_job_id is null or char_length(provider_job_id) <= 500),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  progress integer not null default 0 check (progress between 0 and 100),
  estimated_cost_usd numeric(10,4) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  result_object_path text check (result_object_path is null or result_object_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_-]{1,100}$'),
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id,idempotency_key),
  foreign key (project_id,user_id) references public.mv_video_projects(id,user_id) on delete cascade
);

create index mv_video_jobs_user_created_idx on public.mv_video_jobs(user_id,created_at desc);
create index mv_video_jobs_queue_idx on public.mv_video_jobs(created_at) where status = 'queued';
create index mv_video_jobs_active_idx on public.mv_video_jobs(user_id,status) where status in ('queued','processing');
create unique index mv_video_jobs_project_unique_idx on public.mv_video_jobs(project_id) where project_id is not null;

alter table public.mv_video_jobs enable row level security;
alter table public.mv_video_jobs force row level security;
create policy mv_video_jobs_read on public.mv_video_jobs
for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.mv_video_jobs from public,anon,authenticated;
grant select on public.mv_video_jobs to authenticated;
grant all on public.mv_video_jobs to service_role;

create trigger mv_video_jobs_updated
before update on public.mv_video_jobs
for each row execute function public.mv_set_updated_at();

create function public.mv_enqueue_video_job(
  p_user_id uuid,
  p_project_id uuid,
  p_idempotency_key text,
  p_request_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_jobs%rowtype;
begin
  if p_user_id is null or coalesce(p_idempotency_key,'') !~ '^[A-Za-z0-9._:-]{16,128}$'
    or jsonb_typeof(p_request_data) is distinct from 'object'
    or octet_length(p_request_data::text) > 16384 then
    raise exception 'invalid_video_job_request';
  end if;
  if coalesce(p_request_data->>'durationSeconds','') not in ('6','7','8')
    or coalesce(p_request_data->>'format','') <> '9:16'
    or coalesce(p_request_data->>'templateId','') not in ('wearing-product','presenting-product','demonstrating-product')
    or not exists (
      select 1 from public.mv_video_scenes s
      where s.id = p_request_data->>'scenePresetId'
        and s.template_id = p_request_data->>'templateId'
    )
    or coalesce(p_request_data #>> '{product,imageStoragePath}','') !~ ('^' || p_user_id::text || '/inputs/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_video_job_configuration';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.mv_video_projects p where p.id = p_project_id and p.user_id = p_user_id
  ) then
    raise exception 'video_project_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);
  select * into existing from public.mv_video_jobs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_data is distinct from p_request_data or existing.project_id is distinct from p_project_id then
      raise exception 'idempotency_key_conflict';
    end if;
    return to_jsonb(existing);
  end if;
  if p_project_id is not null and exists (
    select 1 from public.mv_video_jobs where project_id = p_project_id
  ) then
    raise exception 'video_project_job_exists';
  end if;

  if (select count(*) from public.mv_video_jobs
      where user_id = p_user_id and created_at >= now() - interval '24 hours'
        and status <> 'cancelled') >= 15 then
    raise exception 'video_daily_limit';
  end if;
  if (select count(*) from public.mv_video_jobs
      where user_id = p_user_id and status in ('queued','processing')) >= 2 then
    raise exception 'video_concurrency_limit';
  end if;

  insert into public.mv_video_jobs(user_id,project_id,idempotency_key,request_data)
  values (p_user_id,p_project_id,p_idempotency_key,p_request_data)
  returning * into existing;
  return to_jsonb(existing);
end;
$$;

create function public.mv_transition_video_job(
  p_job_id uuid,
  p_status text,
  p_progress integer default null,
  p_provider text default null,
  p_provider_job_id text default null,
  p_result_object_path text default null,
  p_error_code text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_jobs%rowtype;
begin
  select * into existing from public.mv_video_jobs where id = p_job_id for update;
  if not found then raise exception 'video_job_not_found'; end if;
  if not (
    (existing.status = 'queued' and p_status in ('processing','failed','cancelled'))
    or (existing.status = 'processing' and p_status in ('processing','completed','failed','cancelled'))
  ) then
    raise exception 'invalid_video_job_transition';
  end if;
  if p_progress is not null and p_progress not between 0 and 100 then
    raise exception 'invalid_video_job_progress';
  end if;
  if p_result_object_path is not null
    and p_result_object_path !~ ('^' || existing.user_id::text || '/outputs/[A-Za-z0-9._/-]+$') then
    raise exception 'invalid_video_result_path';
  end if;
  if p_status = 'completed' and p_result_object_path is null then
    raise exception 'video_result_required';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_-]{1,100}$' then
    raise exception 'invalid_video_job_error';
  end if;

  update public.mv_video_jobs set
    status = p_status,
    progress = coalesce(p_progress,progress),
    provider = coalesce(p_provider,provider),
    provider_job_id = coalesce(p_provider_job_id,provider_job_id),
    result_object_path = case when p_status = 'completed' then p_result_object_path else result_object_path end,
    error_code = case when p_status = 'failed' then p_error_code else null end,
    started_at = case when p_status = 'processing' then coalesce(started_at,now()) else started_at end,
    completed_at = case when p_status in ('completed','failed','cancelled') then now() else null end
  where id = p_job_id returning * into existing;
  if existing.project_id is not null then
    update public.mv_video_projects set
      status = case p_status
        when 'queued' then 'awaiting_provider'
        when 'processing' then 'processing'
        when 'completed' then 'completed'
        when 'failed' then 'failed'
        else 'cancelled'
      end,
      provider = case existing.provider
        when 'gemini' then 'google-gemini'
        when 'huggingface' then 'huggingface'
        when 'modal' then 'modal'
        else provider
      end,
      provider_job_id = coalesce(existing.provider_job_id,provider_job_id),
      result_storage_path = case when p_status = 'completed' then p_result_object_path else result_storage_path end,
      result_url = case when p_status = 'completed' then null else result_url end,
      error_code = case when p_status = 'failed' then p_error_code else null end
    where id = existing.project_id and user_id = existing.user_id;
  end if;
  return to_jsonb(existing);
end;
$$;

create function public.mv_cancel_video_job(p_user_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_jobs%rowtype;
begin
  select * into existing from public.mv_video_jobs
  where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'video_job_not_found'; end if;
  if existing.status = 'queued' then
    update public.mv_video_jobs set status = 'cancelled', completed_at = now()
    where id = p_job_id returning * into existing;
    if existing.project_id is not null then
      update public.mv_video_projects set status = 'cancelled'
      where id = existing.project_id and user_id = existing.user_id;
    end if;
  elsif existing.status = 'processing' then
    update public.mv_video_jobs set cancel_requested_at = coalesce(cancel_requested_at,now())
    where id = p_job_id returning * into existing;
  end if;
  return to_jsonb(existing);
end;
$$;

revoke all on function public.mv_enqueue_video_job(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.mv_transition_video_job(uuid,text,integer,text,text,text,text) from public,anon,authenticated;
revoke all on function public.mv_cancel_video_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mv_enqueue_video_job(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.mv_transition_video_job(uuid,text,integer,text,text,text,text) to service_role;
grant execute on function public.mv_cancel_video_job(uuid,uuid) to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('mv-video-assets','mv-video-assets',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('mv-video-scenes','mv-video-scenes',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

create policy mv_video_assets_read_own on storage.objects
for select to authenticated
using (bucket_id = 'mv-video-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy mv_video_assets_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'mv-video-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy mv_video_assets_update_own on storage.objects
for update to authenticated
using (bucket_id = 'mv-video-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'mv-video-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy mv_video_assets_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'mv-video-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
