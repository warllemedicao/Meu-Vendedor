create table public.mv_audio_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (request_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('submitting','completed','failed','uncertain')),
  result_path text,
  commercial boolean not null default false,
  tier text not null,
  error_code text,
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index mv_audio_generations_user_created on public.mv_audio_generations(user_id, created_at desc);
alter table public.mv_audio_generations enable row level security;
alter table public.mv_audio_generations force row level security;
revoke all on public.mv_audio_generations from anon, authenticated;
grant select on public.mv_audio_generations to authenticated;
grant all on public.mv_audio_generations to service_role;
create policy mv_audio_read_own on public.mv_audio_generations for select to authenticated using ((select auth.uid()) = user_id);

-- The service claims before calling ElevenLabs. A duplicate never starts another synthesis.
create function public.mv_claim_audio_generation(p_user_id uuid, p_request_key text, p_tier text, p_commercial boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.mv_audio_generations; created public.mv_audio_generations;
begin
  perform pg_advisory_xact_lock(hashtextextended('mv-audio:' || p_user_id::text, 0));
  select * into existing from public.mv_audio_generations where user_id=p_user_id and request_key=p_request_key;
  if found then return jsonb_build_object('claimed',false,'generation',to_jsonb(existing)); end if;
  if (select count(*) from public.mv_audio_generations where user_id=p_user_id and created_at > now()-interval '1 minute') >= 4 then
    raise exception 'audio_rate_limit';
  end if;
  insert into public.mv_audio_generations(user_id,request_key,status,tier,commercial)
  values(p_user_id,p_request_key,'submitting',p_tier,p_commercial) returning * into created;
  return jsonb_build_object('claimed',true,'generation',to_jsonb(created));
end $$;
revoke all on function public.mv_claim_audio_generation(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mv_claim_audio_generation(uuid,text,text,boolean) to service_role;

update storage.buckets set allowed_mime_types = array_append(allowed_mime_types, 'audio/mpeg')
where id='mv-video-assets' and allowed_mime_types is not null and not ('audio/mpeg'=any(allowed_mime_types));
