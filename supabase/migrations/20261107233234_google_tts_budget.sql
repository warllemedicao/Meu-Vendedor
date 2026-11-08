-- Persistent reservations count even if an account/audio row is deleted or a response is uncertain.
create table public.mv_google_tts_usage (
  generation_id uuid primary key,
  characters integer not null check (characters between 2 and 1500),
  created_at timestamptz not null default now()
);
create index mv_google_tts_usage_created on public.mv_google_tts_usage(created_at);
alter table public.mv_google_tts_usage enable row level security;
alter table public.mv_google_tts_usage force row level security;
revoke all on public.mv_google_tts_usage from public, anon, authenticated;
grant all on public.mv_google_tts_usage to service_role;

create function public.mv_google_audio_reserved_characters() returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(characters),0) from public.mv_google_tts_usage
    where created_at >= (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
$$;
revoke all on function public.mv_google_audio_reserved_characters() from public,anon,authenticated;
grant execute on function public.mv_google_audio_reserved_characters() to service_role;

create function public.mv_claim_google_audio(p_user_id uuid, p_request_key text, p_characters integer, p_limit integer default 900000)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing public.mv_audio_generations; created public.mv_audio_generations; used bigint;
begin
  if p_characters not between 2 and 1500 or p_limit not between 1 and 900000 then
    raise exception 'invalid_audio_request';
  end if;
  -- Shared across all users and Edge instances, before any synthesis request.
  perform pg_advisory_xact_lock(hashtextextended('mv-google-tts-monthly-budget',0));
  select * into existing from public.mv_audio_generations where user_id=p_user_id and request_key=p_request_key;
  if found then return jsonb_build_object('claimed',false,'generation',to_jsonb(existing)); end if;
  if (select count(*) from public.mv_audio_generations where user_id=p_user_id and created_at > now()-interval '1 minute') >= 4 then
    raise exception 'audio_rate_limit';
  end if;
  select coalesce(sum(characters),0) into used from public.mv_google_tts_usage
    where created_at >= (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC');
  if used+p_characters > p_limit then raise exception 'audio_monthly_limit'; end if;
  insert into public.mv_audio_generations(user_id,request_key,status,tier,commercial)
    values(p_user_id,p_request_key,'submitting','google-chirp3-hd',true) returning * into created;
  insert into public.mv_google_tts_usage(generation_id,characters) values(created.id,p_characters);
  return jsonb_build_object('claimed',true,'generation',to_jsonb(created));
end $$;
revoke all on function public.mv_claim_google_audio(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.mv_claim_google_audio(uuid,text,integer,integer) to service_role;
