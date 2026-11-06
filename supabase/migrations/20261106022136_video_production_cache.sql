-- Cache de composições por proprietário, nunca compartilhado entre contas.
create table public.mv_video_image_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  object_path text not null,
  expires_at timestamptz not null,
  primary key (user_id,cache_key),
  check (object_path ~ ('^' || user_id::text || '/intermediate/[A-Za-z0-9._-]+$'))
);
alter table public.mv_video_image_cache enable row level security;
alter table public.mv_video_image_cache force row level security;
revoke all on public.mv_video_image_cache from public,anon,authenticated;
grant all on public.mv_video_image_cache to service_role;

-- Até 100 entregas/tarefas ativas por janela de 24h; falhas não consomem a cota.
-- A política financeira do backend continua aplicada separadamente.
create or replace function public.mv_enqueue_video_job(
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
        and status in ('queued','processing','completed')) >= 100 then
    raise exception 'video_daily_limit';
  end if;
  if (select count(*) from public.mv_video_jobs
      where user_id = p_user_id and status in ('queued','processing')) >= 5 then
    raise exception 'video_concurrency_limit';
  end if;

  insert into public.mv_video_jobs(user_id,project_id,idempotency_key,request_data)
  values (p_user_id,p_project_id,p_idempotency_key,p_request_data)
  returning * into existing;
  return to_jsonb(existing);
end;
$$;

-- Repetir finalização de download/Storage sem submeter outro vídeo pago.
alter table public.mv_video_jobs add column finalization_attempts integer not null default 0 check (finalization_attempts >= 0);
create or replace function public.mv_advance_video_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_progress integer,
  p_provider text default null,
  p_provider_job_id text default null,
  p_intermediate_image_path text default null,
  p_result_object_path text default null,
  p_error_code text default null,
  p_delay_seconds integer default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_jobs%rowtype;
declare next_status text;
begin
  if p_stage not in ('queued','image_ready','video_processing','validating','awaiting_authorization','uncertain','completed','failed','cancelled')
    or p_progress not between 0 and 100
    or p_delay_seconds not between 0 and 3600 then
    raise exception 'invalid_video_job_transition';
  end if;
  select * into existing from public.mv_video_jobs
  where id = p_job_id and status = 'processing' and lease_token = p_lease_token
    and lease_expires_at > now()
  for update;
  if not found then raise exception 'video_job_lease_lost'; end if;
  if p_result_object_path is not null
    and p_result_object_path !~ ('^' || existing.user_id::text || '/outputs/[A-Za-z0-9._-]+[.]mp4$') then
    raise exception 'invalid_video_result_path';
  end if;
  if p_intermediate_image_path is not null
    and p_intermediate_image_path !~ ('^' || existing.user_id::text || '/intermediate/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_video_intermediate_path';
  end if;
  if p_stage = 'completed' and p_result_object_path is null then raise exception 'video_result_required'; end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_-]{1,100}$' then raise exception 'invalid_video_job_error'; end if;

  next_status := case
    when p_stage in ('completed','failed','uncertain','cancelled') then
      case when p_stage = 'completed' then 'completed' else case when p_stage = 'cancelled' then 'cancelled' else 'failed' end end
    else 'processing'
  end;
  update public.mv_video_jobs set
    status = next_status,
    stage = p_stage,
    stage_message = coalesce(p_error_code,p_stage),
    progress = p_progress,
    finalization_attempts = finalization_attempts + case when p_stage = 'validating' then 1 else 0 end,
    status_poll_attempts = case when p_stage = 'video_processing' then status_poll_attempts + 1 else status_poll_attempts end,
    provider = coalesce(p_provider,provider),
    provider_job_id = coalesce(p_provider_job_id,provider_job_id),
    intermediate_image_path = coalesce(p_intermediate_image_path,intermediate_image_path),
    result_object_path = coalesce(p_result_object_path,result_object_path),
    error_code = case when next_status = 'failed' then p_error_code else null end,
    lease_token = null,
    lease_expires_at = null,
    next_attempt_at = now() + make_interval(secs => p_delay_seconds),
    completed_at = case when next_status in ('completed','failed','cancelled') then now() else null end
  where id = p_job_id returning * into existing;
  if p_provider_job_id is not null and p_provider is not null then
    update public.mv_video_ai_attempts set remote_job_id = p_provider_job_id
    where id = (
      select id from public.mv_video_ai_attempts
      where job_id = p_job_id and provider_id = p_provider and stage = 'video' and status = 'started'
      order by id desc limit 1
    );
  end if;

  if existing.project_id is not null then
    update public.mv_video_projects set
      status = case next_status when 'completed' then 'completed' when 'failed' then 'failed' when 'cancelled' then 'cancelled' else 'processing' end,
      provider = case existing.provider
        when 'cloudflare-workers-ai' then 'cloudflare-workers-ai'
        when 'magic-hour' then 'magic-hour'
        when 'replicate' then 'replicate'
        else provider
      end,
      provider_job_id = coalesce(existing.provider_job_id,provider_job_id),
      result_storage_path = case when next_status = 'completed' then p_result_object_path else result_storage_path end,
      result_url = case when next_status = 'completed' then null else result_url end,
      error_code = case when next_status = 'failed' then p_error_code else null end
    where id = existing.project_id and user_id = existing.user_id;
  end if;
  return to_jsonb(existing);
end;
$$;
