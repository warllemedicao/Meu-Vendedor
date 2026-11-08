create table public.mv_motion_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 asset_id uuid not null references public.mv_presenter_assets(id),
 engine text not null check(engine in ('wan-animate','scail','vace','fashn')),
 input jsonb not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 callback_hash text not null check(callback_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'submitting' check(status in ('submitting','running','uncertain','completed','failed','cancelled')),
 cancel_requested boolean not null default false,
 kernel_slug text,
 result_path text,
 report jsonb not null default '{}',
 error_code text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '70 minutes',
 unique(user_id,fingerprint)
);
create index mv_motion_jobs_asset_idx on public.mv_motion_jobs(asset_id);
create index mv_motion_jobs_user_created_idx on public.mv_motion_jobs(user_id,created_at desc);
create index mv_motion_jobs_active_idx on public.mv_motion_jobs(expires_at) where status in ('submitting','running','uncertain');
alter table public.mv_motion_jobs enable row level security;
alter table public.mv_motion_jobs force row level security;
revoke all on public.mv_motion_jobs from public,anon,authenticated;
grant all on public.mv_motion_jobs to service_role;

-- Same GPU admission lock as the existing MuseTalk queue. No client can submit raw jobs.
create function public.mv_claim_motion(p_user uuid,p_asset uuid,p_engine text,p_input jsonb,p_fingerprint text,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.mv_motion_jobs; k text; v text;
begin
 if p_engine not in ('wan-animate','scail','vace','fashn') or p_input->>'engine' is distinct from p_engine or p_input->>'assetId' is distinct from p_asset::text then raise exception 'input_invalid'; end if;
 foreach k in array array['referencePath','productPath','driverPath','maskPath'] loop
  v:=p_input->>k;
  if v is not null and (v !~ ('^'||p_user::text||'/inputs/[A-Za-z0-9_-]+[.](jpg|png|webp|mp4|webm)$')) and not (k='referencePath' and v ~ ('^'||p_user::text||'/motion/[a-f0-9-]{36}[.]png$')) then raise exception 'input_invalid'; end if;
 end loop;
 if not exists(select 1 from public.mv_presenter_assets where id=p_asset and approved and kind='image') then raise exception 'input_invalid'; end if;
 perform pg_advisory_xact_lock(784234);
 select * into j from public.mv_motion_jobs where user_id=p_user and fingerprint=p_fingerprint;
 if found then return jsonb_build_object('claimed',false,'job',to_jsonb(j)); end if;
 if exists(select 1 from public.mv_hybrid_jobs where status in ('submitting','running','uncertain') and expires_at>now()) or exists(select 1 from public.mv_motion_jobs where status in ('submitting','running','uncertain') and expires_at>now()) then raise exception 'motion_busy'; end if;
 if (select count(*) from public.mv_motion_jobs where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= 20 then raise exception 'motion_daily_limit'; end if;
 insert into public.mv_motion_jobs(user_id,asset_id,engine,input,fingerprint,callback_hash) values(p_user,p_asset,p_engine,p_input,p_fingerprint,p_hash) returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end $$;
revoke all on function public.mv_claim_motion(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.mv_claim_motion(uuid,uuid,text,jsonb,text,text) to service_role;

-- Coordinate the existing path too; keep its current implementation and grants intact.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.mv_claim_hybrid(uuid,uuid,uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'perform pg_advisory_xact_lock(784234);',
 'perform pg_advisory_xact_lock(784234); if exists(select 1 from public.mv_motion_jobs where status in (''submitting'',''running'',''uncertain'') and expires_at>now()) then raise exception ''hybrid_busy''; end if;');
 execute definition;
end $$;
