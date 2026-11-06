-- Política gratuita: metadados administrativos sem valores de credenciais.
create table public.mv_ai_free_allowances (
  provider_id text not null,
  model text not null,
  enabled boolean not null default false,
  billing_guard text not null default 'unverified' check (billing_guard in ('unverified','free-plan-hard-stop')),
  remaining_units numeric(18,4) not null default 0 check (remaining_units >= 0 and remaining_units <> 'NaN'::numeric),
  valid_until timestamptz not null default now(),
  next_reset_at timestamptz,
  renewal_period_seconds integer check (renewal_period_seconds>=60),
  renewal_units numeric(18,4) check (renewal_units>0 and renewal_units<>'NaN'::numeric),
  check ((renewal_period_seconds is null and renewal_units is null) or (renewal_period_seconds is not null and renewal_units is not null and next_reset_at is not null)),
  grant_revision uuid not null default gen_random_uuid(),
  commercial_use_confirmed boolean not null default false,
  evidence text not null default '',
  primary key (provider_id,model),
  check (billing_guard='unverified' or length(trim(evidence)) >= 10)
);
create table public.mv_ai_free_reservations (
  job_id uuid not null references public.mv_video_jobs(id) on delete cascade,
  stage text not null check (stage in ('image','video')),
  provider_id text not null,
  model text not null,
  units numeric(18,4) not null check (units>0 and units <> 'NaN'::numeric),
  grant_revision uuid not null,
  status text not null default 'reserved' check (status in ('reserved','consumed','released')),
  primary key (job_id,stage,provider_id),
  foreign key (provider_id,model) references public.mv_ai_free_allowances(provider_id,model)
);
create index mv_ai_free_reservations_provider_model_idx on public.mv_ai_free_reservations(provider_id,model);
alter table public.mv_ai_free_allowances enable row level security;
alter table public.mv_ai_free_allowances force row level security;
alter table public.mv_ai_free_reservations enable row level security;
alter table public.mv_ai_free_reservations force row level security;
revoke all on public.mv_ai_free_allowances,public.mv_ai_free_reservations from public,anon,authenticated;
grant all on public.mv_ai_free_allowances,public.mv_ai_free_reservations to service_role;

-- Renovação só para franquia periódica documentada do fornecedor; nunca para bônus único.
create function public.mv_refresh_free_allowance(p_provider_id text,p_model text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare allowance public.mv_ai_free_allowances%rowtype;
begin
  select * into allowance from public.mv_ai_free_allowances where provider_id=p_provider_id and model=p_model for update;
  if not found then return null; end if;
  if allowance.enabled and allowance.billing_guard='free-plan-hard-stop' and allowance.commercial_use_confirmed
    and allowance.valid_until>now() and allowance.renewal_period_seconds is not null and allowance.next_reset_at<=now() then
    update public.mv_ai_free_allowances set remaining_units=renewal_units,grant_revision=gen_random_uuid(),
      next_reset_at=allowance.next_reset_at+make_interval(secs => ((floor(extract(epoch from (now()-allowance.next_reset_at))/allowance.renewal_period_seconds)+1)*allowance.renewal_period_seconds)::integer)
      where provider_id=p_provider_id and model=p_model returning * into allowance;
  end if;
  return to_jsonb(allowance);
end;
$$;
revoke all on function public.mv_refresh_free_allowance(text,text) from public,anon,authenticated;
grant execute on function public.mv_refresh_free_allowance(text,text) to service_role;

create function public.mv_reserve_free_video_units(p_job_id uuid,p_lease_token uuid,p_stage text,p_provider_id text,p_model text,p_units numeric)
returns boolean language plpgsql security invoker set search_path='' as $$
declare allowance public.mv_ai_free_allowances%rowtype;
declare reservation public.mv_ai_free_reservations%rowtype;
begin
  if p_units is null or p_units<=0 or p_units='NaN'::numeric or p_units='Infinity'::numeric or p_units='-Infinity'::numeric
    or p_stage not in ('image','video') then return false; end if;
  -- Não reservar para uma execução que perdeu sua lease.
  if not exists(select 1 from public.mv_video_jobs where id=p_job_id and lease_token=p_lease_token
    and status='processing' and lease_expires_at>now()) then return false; end if;
  select * into allowance from public.mv_ai_free_allowances where provider_id=p_provider_id and model=p_model for update;
  if not found or not allowance.enabled or allowance.billing_guard<>'free-plan-hard-stop'
    or not allowance.commercial_use_confirmed or allowance.valid_until<=now() then return false; end if;
  select * into reservation from public.mv_ai_free_reservations
    where job_id=p_job_id and stage=p_stage and provider_id=p_provider_id for update;
  if found and reservation.status<>'released' then
    return reservation.status='reserved' and reservation.units=p_units and reservation.model=p_model and reservation.grant_revision=allowance.grant_revision;
  end if;
  if allowance.remaining_units<p_units then return false; end if;
  update public.mv_ai_free_allowances set remaining_units=remaining_units-p_units where provider_id=p_provider_id and model=p_model;
  insert into public.mv_ai_free_reservations(job_id,stage,provider_id,model,units,grant_revision,status)
    values(p_job_id,p_stage,p_provider_id,p_model,p_units,allowance.grant_revision,'reserved')
    on conflict(job_id,stage,provider_id) do update set model=excluded.model,units=excluded.units,grant_revision=excluded.grant_revision,status='reserved';
  return true;
end;
$$;

create function public.mv_settle_free_video_units(p_job_id uuid,p_stage text,p_provider_id text,p_model text,p_release boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare allowance public.mv_ai_free_allowances%rowtype;
declare reservation public.mv_ai_free_reservations%rowtype;
begin
  -- Mesma ordem de locks da reserva.
  select * into allowance from public.mv_ai_free_allowances where provider_id=p_provider_id and model=p_model for update;
  if not found then return false; end if;
  select * into reservation from public.mv_ai_free_reservations
    where job_id=p_job_id and stage=p_stage and provider_id=p_provider_id and model=p_model for update;
  if not found then return false; end if;
  if reservation.status<>'reserved' then return reservation.status=case when p_release then 'released' else 'consumed' end; end if;
  if p_release and reservation.grant_revision=allowance.grant_revision then
    update public.mv_ai_free_allowances set remaining_units=remaining_units+reservation.units where provider_id=p_provider_id and model=p_model;
  end if;
  update public.mv_ai_free_reservations set status=case when p_release then 'released' else 'consumed' end
    where job_id=p_job_id and stage=p_stage and provider_id=p_provider_id;
  return true;
end;
$$;
revoke all on function public.mv_reserve_free_video_units(uuid,uuid,text,text,text,numeric),public.mv_settle_free_video_units(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mv_reserve_free_video_units(uuid,uuid,text,text,text,numeric),public.mv_settle_free_video_units(uuid,text,text,text,boolean) to service_role;

-- Nenhuma renovação fictícia: remaining_units é observado/concedido no fornecedor.
-- next_reset_at sozinho nunca repõe saldo; exige franquia periódica documentada e hard stop válido.
insert into public.mv_ai_free_allowances(provider_id,model) values
  ('cloudflare-workers-ai','@cf/black-forest-labs/flux-2-dev'),
  ('magic-hour','ltx-2.5'),('replicate','alibaba/happyhorse-1.0'),
  ('google-gemini','gemini-3.8-flash'),('groq','llama-3.3-70b-versatile');

alter table public.mv_video_jobs drop constraint mv_video_jobs_stage_check;
alter table public.mv_video_jobs add constraint mv_video_jobs_stage_check check(stage in
  ('queued','image_generating','image_ready','video_submitting','video_processing','validating','awaiting_authorization','awaiting_free_credits','uncertain','completed','failed','cancelled'));

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

  -- Sem limite diário nem bloqueio de admissão por tarefas aguardando créditos.
  insert into public.mv_video_jobs(user_id,project_id,idempotency_key,request_data)
  values (p_user_id,p_project_id,p_idempotency_key,p_request_data)
  returning * into existing;
  return to_jsonb(existing);
end;
$$;


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
  if p_stage not in ('queued','image_ready','video_processing','validating','awaiting_authorization','awaiting_free_credits','uncertain','completed','failed','cancelled')
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
    when p_stage='awaiting_free_credits' then 'queued'
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

create or replace function public.mv_claim_video_job(p_lease_seconds integer default 90)
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
  order by next_attempt_at,created_at
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

