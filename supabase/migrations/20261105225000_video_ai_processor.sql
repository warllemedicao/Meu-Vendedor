begin;

alter table public.mv_video_projects
  drop constraint if exists mv_video_projects_provider_check,
  add constraint mv_video_projects_provider_check
    check (provider in ('mock','google-gemini','huggingface','modal','cloudflare-workers-ai','magic-hour','replicate'));

alter table public.mv_video_jobs
  drop constraint if exists mv_video_jobs_provider_check,
  add constraint mv_video_jobs_provider_check
    check (provider in ('pending','gemini','huggingface','modal','cloudflare-workers-ai','magic-hour','replicate')),
  add column stage text not null default 'queued'
    check (stage in ('queued','image_generating','image_ready','video_submitting','video_processing','validating','awaiting_authorization','uncertain','completed','failed','cancelled')),
  add column stage_message text,
  add column intermediate_image_path text
    check (intermediate_image_path is null or intermediate_image_path ~ '^[0-9a-f-]{36}/intermediate/[A-Za-z0-9._-]+$'),
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column status_poll_attempts integer not null default 0 check (status_poll_attempts between 0 and 1000);

create index mv_video_jobs_worker_idx
  on public.mv_video_jobs(next_attempt_at,created_at)
  where status in ('queued','processing');

update public.mv_video_jobs set
  status = case when status in ('queued','processing') then 'failed' else status end,
  stage = case status
    when 'queued' then 'failed'
    when 'processing' then 'uncertain'
    when 'completed' then 'completed'
    when 'failed' then 'failed'
    else 'cancelled'
  end,
  stage_message = case status
    when 'queued' then 'legacy_job_requires_reenqueue'
    when 'processing' then 'provider_submission_uncertain'
    else status
  end,
  error_code = case status
    when 'queued' then 'legacy_job_requires_reenqueue'
    when 'processing' then 'provider_submission_uncertain'
    else error_code
  end,
  lease_token = null,
  lease_expires_at = null,
  completed_at = case when status in ('queued','processing') then now() else completed_at end
where status in ('queued','processing','completed','failed','cancelled');

update public.mv_video_projects p set
  status = 'failed',
  error_code = j.error_code
from public.mv_video_jobs j
where j.project_id = p.id and j.user_id = p.user_id
  and j.error_code in ('legacy_job_requires_reenqueue','provider_submission_uncertain')
  and p.status not in ('failed','cancelled');

create function public.mv_validate_video_job_ai_refs()
returns trigger language plpgsql set search_path = '' as $$
declare owner_path text := '^' || new.user_id::text || '/inputs/[A-Za-z0-9._-]+[.]jpg$';
begin
  if coalesce(new.request_data->'product'->>'aiReferenceStoragePath','') !~ owner_path
    or coalesce(new.request_data->>'presenterReferenceStoragePath','') !~ owner_path
    or coalesce(new.request_data->'product'->>'aiReferenceWidth','') !~ '^[1-9][0-9]{0,2}$'
    or coalesce(new.request_data->'product'->>'aiReferenceHeight','') !~ '^[1-9][0-9]{0,2}$'
    or coalesce(new.request_data->>'presenterReferenceWidth','') !~ '^[1-9][0-9]{0,2}$'
    or coalesce(new.request_data->>'presenterReferenceHeight','') !~ '^[1-9][0-9]{0,2}$'
    or (new.request_data->'product'->>'aiReferenceWidth')::integer > 512
    or (new.request_data->'product'->>'aiReferenceHeight')::integer > 512
    or (new.request_data->>'presenterReferenceWidth')::integer > 512
    or (new.request_data->>'presenterReferenceHeight')::integer > 512 then
    raise exception 'invalid_video_ai_reference';
  end if;
  return new;
end;
$$;
create trigger mv_video_jobs_ai_refs
before insert or update of request_data,user_id on public.mv_video_jobs
for each row execute function public.mv_validate_video_job_ai_refs();

create table public.mv_video_ai_attempts (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.mv_video_jobs(id) on delete cascade,
  stage text not null check (stage in ('image','video')),
  provider_id text not null check (provider_id in ('cloudflare-workers-ai','magic-hour','replicate')),
  model text not null check (char_length(model) between 1 and 200),
  status text not null check (status in ('started','succeeded','failed','uncertain','skipped')),
  reason_code text check (reason_code is null or reason_code ~ '^[a-z0-9_-]{1,100}$'),
  estimated_cost_usd numeric(10,4) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  remote_job_id text check (remote_job_id is null or char_length(remote_job_id) <= 500),
  created_at timestamptz not null default now()
);
create index mv_video_ai_attempts_job_idx on public.mv_video_ai_attempts(job_id,id);

create table public.mv_video_ai_budget_reservations (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.mv_video_jobs(id) on delete cascade,
  stage text not null check (stage in ('image','video')),
  provider_id text not null check (provider_id in ('cloudflare-workers-ai','magic-hour','replicate')),
  reserved_usd numeric(10,4) not null check (reserved_usd >= 0),
  actual_usd numeric(10,4) check (actual_usd is null or actual_usd >= 0),
  status text not null default 'reserved' check (status in ('reserved','settled','released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id,stage,provider_id)
);

create table public.mv_video_ai_provider_cooldowns (
  provider_id text primary key check (provider_id in ('cloudflare-workers-ai','magic-hour','replicate')),
  cooldown_until timestamptz not null,
  reason_code text not null check (reason_code ~ '^[a-z0-9_-]{1,100}$'),
  updated_at timestamptz not null default now()
);

alter table public.mv_video_ai_attempts enable row level security;
alter table public.mv_video_ai_attempts force row level security;
alter table public.mv_video_ai_budget_reservations enable row level security;
alter table public.mv_video_ai_budget_reservations force row level security;
alter table public.mv_video_ai_provider_cooldowns enable row level security;
alter table public.mv_video_ai_provider_cooldowns force row level security;
revoke all on public.mv_video_ai_attempts, public.mv_video_ai_budget_reservations,
  public.mv_video_ai_provider_cooldowns from public,anon,authenticated;
grant all on public.mv_video_ai_attempts, public.mv_video_ai_budget_reservations,
  public.mv_video_ai_provider_cooldowns to service_role;
grant usage,select on sequence public.mv_video_ai_attempts_id_seq,
  public.mv_video_ai_budget_reservations_id_seq to service_role;

create function public.mv_claim_video_job(p_lease_seconds integer default 90)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare claimed public.mv_video_jobs%rowtype;
begin
  if p_lease_seconds not between 30 and 300 then raise exception 'invalid_video_job_lease'; end if;

  update public.mv_video_jobs set
    status = 'failed',
    stage = 'uncertain',
    stage_message = 'provider_submission_uncertain',
    error_code = 'provider_submission_uncertain',
    completed_at = now(),
    lease_token = null,
    lease_expires_at = null
  where status = 'processing'
    and lease_expires_at <= now()
    and stage in ('image_generating','video_submitting');
  update public.mv_video_projects p set
    status = 'failed',
    error_code = 'provider_submission_uncertain'
  from public.mv_video_jobs j
  where j.project_id = p.id and j.user_id = p.user_id
    and j.status = 'failed' and j.stage = 'uncertain'
    and j.error_code = 'provider_submission_uncertain' and p.status not in ('failed','cancelled');

  select * into claimed
  from public.mv_video_jobs
  where status in ('queued','processing')
    and next_attempt_at <= now()
    and (status = 'queued' or lease_expires_at is null or lease_expires_at <= now())
    and stage not in ('image_generating','video_submitting','uncertain','completed','failed','cancelled')
  order by created_at
  for update skip locked
  limit 1;
  if not found then return null; end if;

  update public.mv_video_jobs set
    status = 'processing',
    lease_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    started_at = coalesce(started_at,now())
  where id = claimed.id returning * into claimed;
  return to_jsonb(claimed);
end;
$$;

create function public.mv_mark_video_job_submitting(
  p_job_id uuid,
  p_lease_token uuid,
  p_stage text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_stage not in ('image_generating','video_submitting') then
    raise exception 'invalid_video_job_stage';
  end if;
  update public.mv_video_jobs set
    stage = p_stage,
    stage_message = p_stage,
    lease_expires_at = now() + interval '180 seconds'
  where id = p_job_id and status = 'processing'
    and lease_token = p_lease_token and lease_expires_at > now();
  return found;
end;
$$;

create function public.mv_advance_video_job(
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

create function public.mv_record_video_ai_attempt(
  p_job_id uuid,
  p_stage text,
  p_provider_id text,
  p_model text,
  p_status text,
  p_reason_code text default null,
  p_estimated_cost_usd numeric default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_stage not in ('image','video') or p_status not in ('started','succeeded','failed','uncertain','skipped')
    or p_provider_id not in ('cloudflare-workers-ai','magic-hour','replicate')
    or p_reason_code is not null and p_reason_code !~ '^[a-z0-9_-]{1,100}$'
    or p_estimated_cost_usd is not null and p_estimated_cost_usd < 0 then
    raise exception 'invalid_video_ai_attempt';
  end if;
  insert into public.mv_video_ai_attempts(job_id,stage,provider_id,model,status,reason_code,estimated_cost_usd)
  values(p_job_id,p_stage,p_provider_id,p_model,p_status,p_reason_code,p_estimated_cost_usd);
  if p_status = 'started' then
    update public.mv_video_jobs set attempt_count = least(attempt_count + 1,3)
    where id = p_job_id;
  end if;
end;
$$;

create or replace function public.mv_cancel_video_job(p_user_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_jobs%rowtype;
begin
  select * into existing from public.mv_video_jobs
  where id = p_job_id and user_id = p_user_id for update;
  if not found then raise exception 'video_job_not_found'; end if;
  if existing.status = 'queued' then
    update public.mv_video_jobs set
      status = 'cancelled',
      stage = 'cancelled',
      stage_message = 'cancelled',
      completed_at = now()
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

create function public.mv_reserve_video_ai_budget(
  p_job_id uuid,
  p_stage text,
  p_provider_id text,
  p_estimated_usd numeric,
  p_job_budget_usd numeric,
  p_daily_budget_usd numeric
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare existing public.mv_video_ai_budget_reservations%rowtype;
declare job_total numeric;
declare daily_total numeric;
begin
  if p_stage not in ('image','video') or p_provider_id not in ('cloudflare-workers-ai','magic-hour','replicate')
    or p_estimated_usd is null or p_estimated_usd < 0
    or p_job_budget_usd is null or p_job_budget_usd <= 0
    or p_daily_budget_usd is null or p_daily_budget_usd <= 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtext('mv-video-budget-' || current_date::text)::bigint);
  select * into existing from public.mv_video_ai_budget_reservations
  where job_id = p_job_id and stage = p_stage and provider_id = p_provider_id
  for update;
  if found then return existing.status = 'reserved' and existing.reserved_usd = p_estimated_usd; end if;

  select coalesce(sum(case when status = 'settled' then actual_usd else case when status = 'reserved' then reserved_usd else 0 end end),0)
    into job_total from public.mv_video_ai_budget_reservations where job_id = p_job_id;
  select coalesce(sum(case when status = 'settled' then actual_usd else case when status = 'reserved' then reserved_usd else 0 end end),0)
    into daily_total from public.mv_video_ai_budget_reservations
    where status = 'reserved'
      or created_at >= date_trunc('day',now())
        and created_at < date_trunc('day',now()) + interval '1 day';
  if job_total + p_estimated_usd > p_job_budget_usd
    or daily_total + p_estimated_usd > p_daily_budget_usd then return false; end if;
  insert into public.mv_video_ai_budget_reservations(job_id,stage,provider_id,reserved_usd)
  values(p_job_id,p_stage,p_provider_id,p_estimated_usd);
  return true;
end;
$$;

create function public.mv_settle_video_ai_budget(
  p_job_id uuid,
  p_stage text,
  p_provider_id text,
  p_actual_usd numeric,
  p_release boolean default false
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare reservation public.mv_video_ai_budget_reservations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('mv-video-budget-' || current_date::text)::bigint);
  select * into reservation from public.mv_video_ai_budget_reservations
  where job_id = p_job_id and stage = p_stage and provider_id = p_provider_id
  for update;
  if not found then return false; end if;
  if reservation.status <> 'reserved' then
    return reservation.status = case when p_release then 'released' else 'settled' end;
  end if;
  if p_release then
    update public.mv_video_ai_budget_reservations set status = 'released', updated_at = now()
    where id = reservation.id;
    return true;
  end if;
  if p_actual_usd is null or p_actual_usd < 0 then
    raise exception 'invalid_video_ai_actual_cost';
  end if;
  if p_actual_usd > reservation.reserved_usd then
    update public.mv_video_ai_budget_reservations set
      status = 'settled',
      reserved_usd = p_actual_usd,
      actual_usd = p_actual_usd,
      updated_at = now()
    where id = reservation.id;
    return false;
  end if;
  update public.mv_video_ai_budget_reservations set
    status = 'settled', actual_usd = p_actual_usd, updated_at = now()
  where id = reservation.id;
  return true;
end;
$$;

create function public.mv_set_video_ai_cooldown(
  p_provider_id text,
  p_cooldown_until timestamptz,
  p_reason_code text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_provider_id not in ('cloudflare-workers-ai','magic-hour','replicate')
    or p_cooldown_until <= now()
    or p_reason_code !~ '^[a-z0-9_-]{1,100}$' then raise exception 'invalid_video_ai_cooldown'; end if;
  insert into public.mv_video_ai_provider_cooldowns(provider_id,cooldown_until,reason_code)
  values(p_provider_id,p_cooldown_until,p_reason_code)
  on conflict(provider_id) do update set
    cooldown_until = excluded.cooldown_until,
    reason_code = excluded.reason_code,
    updated_at = now();
end;
$$;

revoke all on function public.mv_claim_video_job(integer),
  public.mv_mark_video_job_submitting(uuid,uuid,text),
  public.mv_advance_video_job(uuid,uuid,text,integer,text,text,text,text,text,integer),
  public.mv_record_video_ai_attempt(uuid,text,text,text,text,text,numeric),
  public.mv_reserve_video_ai_budget(uuid,text,text,numeric,numeric,numeric),
  public.mv_settle_video_ai_budget(uuid,text,text,numeric,boolean),
  public.mv_set_video_ai_cooldown(text,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.mv_claim_video_job(integer),
  public.mv_mark_video_job_submitting(uuid,uuid,text),
  public.mv_advance_video_job(uuid,uuid,text,integer,text,text,text,text,text,integer),
  public.mv_record_video_ai_attempt(uuid,text,text,text,text,text,numeric),
  public.mv_reserve_video_ai_budget(uuid,text,text,numeric,numeric,numeric),
  public.mv_settle_video_ai_budget(uuid,text,text,numeric,boolean),
  public.mv_set_video_ai_cooldown(text,timestamptz,text)
to service_role;

commit;
