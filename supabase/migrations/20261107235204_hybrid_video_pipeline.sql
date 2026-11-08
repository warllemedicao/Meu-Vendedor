-- Reusable media is approved by operators; clients cannot change paths/crops/licenses.
create table public.mv_presenter_assets (
 id uuid primary key default gen_random_uuid(),
 presenter_id text not null check(presenter_id in ('ana','carla','rafael','lucas')),
 name text not null check(length(name) between 1 and 120),
 object_path text not null check(object_path ~ '^operator/hybrid-assets/[A-Za-z0-9._/-]+$' and object_path not like '%..%'),
 face_crop jsonb not null check(jsonb_array_length(face_crop)=4),
 kind text not null check(kind in ('image','video')),
 scene text not null default 'studio',
 approved boolean not null default false,
 license_note text not null,
 created_at timestamptz not null default now()
);
create table public.mv_hybrid_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 asset_id uuid not null references public.mv_presenter_assets(id),
 audio_id uuid not null references public.mv_audio_generations(id),
 status text not null default 'submitting' check(status in ('submitting','running','completed','failed','uncertain')),
 callback_hash text not null check(callback_hash ~ '^[0-9a-f]{64}$'),
 kernel_slug text,
 result_path text,
 report jsonb not null default '{}',
 error_code text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 minutes',
 unique(user_id,asset_id,audio_id)
);
create index mv_hybrid_jobs_created_idx on public.mv_hybrid_jobs(created_at);
create index mv_hybrid_jobs_asset_idx on public.mv_hybrid_jobs(asset_id);
create index mv_hybrid_jobs_audio_idx on public.mv_hybrid_jobs(audio_id);
alter table public.mv_presenter_assets enable row level security;
alter table public.mv_presenter_assets force row level security;
alter table public.mv_hybrid_jobs enable row level security;
alter table public.mv_hybrid_jobs force row level security;
revoke all on public.mv_presenter_assets,public.mv_hybrid_jobs from public,anon,authenticated;
grant select on public.mv_presenter_assets to authenticated;
create policy approved_presenter_assets on public.mv_presenter_assets for select to authenticated using(approved);
grant all on public.mv_presenter_assets,public.mv_hybrid_jobs to service_role;

-- One global GPU submission at a time, at most twenty per UTC day. Claims never retry uncertain launches.
create function public.mv_claim_hybrid(p_user uuid,p_asset uuid,p_audio uuid,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.mv_hybrid_jobs; a public.mv_presenter_assets;
begin
 perform pg_advisory_xact_lock(784234);
 select * into j from public.mv_hybrid_jobs where user_id=p_user and asset_id=p_asset and audio_id=p_audio;
 if found then return jsonb_build_object('claimed',false,'job',to_jsonb(j)); end if;
 select * into a from public.mv_presenter_assets where id=p_asset and approved;
 if not found or not exists(select 1 from public.mv_audio_generations where id=p_audio and user_id=p_user and status='completed' and tier='google-chirp3-hd') then
   raise exception 'hybrid_input_unavailable';
 end if;
 if exists(select 1 from public.mv_hybrid_jobs where status in ('submitting','running','uncertain') and expires_at>now()) then raise exception 'hybrid_busy'; end if;
 if (select count(*) from public.mv_hybrid_jobs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'hybrid_daily_limit'; end if;
 insert into public.mv_hybrid_jobs(user_id,asset_id,audio_id,callback_hash) values(p_user,p_asset,p_audio,p_hash) returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end $$;
revoke all on function public.mv_claim_hybrid(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mv_claim_hybrid(uuid,uuid,uuid,text) to service_role;
