create table public.mv_youtube_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_subject text not null,
  google_email text not null,
  channel_id text not null,
  channel_title text not null,
  encrypted_tokens text not null,
  scopes text[] not null,
  status text not null default 'connected' check (status in ('connected','reauthorization_required')),
  verified_at timestamptz not null default now()
);
create table public.mv_youtube_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expected_email text not null,
  encrypted_verifier text not null,
  opened_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes'
);
create index mv_youtube_oauth_states_user_created on public.mv_youtube_oauth_states(user_id,created_at);
create index mv_youtube_oauth_states_expiry on public.mv_youtube_oauth_states(expires_at);
alter table public.mv_youtube_connections enable row level security;
alter table public.mv_youtube_connections force row level security;
alter table public.mv_youtube_oauth_states enable row level security;
alter table public.mv_youtube_oauth_states force row level security;
revoke all on public.mv_youtube_connections,public.mv_youtube_oauth_states from public,anon,authenticated;
grant all on public.mv_youtube_connections,public.mv_youtube_oauth_states to service_role;

create function public.mv_begin_youtube_oauth(p_user_id uuid,p_state_hash text,p_expected_email text,p_encrypted_verifier text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mv-youtube:'||p_user_id::text,0));
  delete from public.mv_youtube_oauth_states where expires_at<now();
  if (select count(*) from public.mv_youtube_oauth_states where user_id=p_user_id) >=5 then
    raise exception 'youtube_connection_rate_limit';
  end if;
  insert into public.mv_youtube_oauth_states(state_hash,user_id,expected_email,encrypted_verifier)
  values(p_state_hash,p_user_id,p_expected_email,p_encrypted_verifier);
end $$;
revoke all on function public.mv_begin_youtube_oauth(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.mv_begin_youtube_oauth(uuid,text,text,text) to service_role;

create function public.mv_finish_youtube_connection(p_user_id uuid,p_state_hash text,p_subject text,p_email text,p_channel_id text,p_channel_title text,p_encrypted_tokens text,p_scopes text[])
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mv-youtube:'||p_user_id::text,0));
  if not exists(select 1 from public.mv_youtube_oauth_states where user_id=p_user_id and state_hash=p_state_hash and consumed_at is not null and expires_at>now()) then
    raise exception 'youtube_authorization_expired';
  end if;
  insert into public.mv_youtube_connections(user_id,google_subject,google_email,channel_id,channel_title,encrypted_tokens,scopes)
  values(p_user_id,p_subject,p_email,p_channel_id,p_channel_title,p_encrypted_tokens,p_scopes)
  on conflict(user_id) do update set google_subject=excluded.google_subject,google_email=excluded.google_email,
    channel_id=excluded.channel_id,channel_title=excluded.channel_title,encrypted_tokens=excluded.encrypted_tokens,
    scopes=excluded.scopes,status='connected',verified_at=now();
  delete from public.mv_youtube_oauth_states where user_id=p_user_id;
end $$;
revoke all on function public.mv_finish_youtube_connection(uuid,text,text,text,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.mv_finish_youtube_connection(uuid,text,text,text,text,text,text,text[]) to service_role;

create function public.mv_disconnect_youtube(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mv-youtube:'||p_user_id::text,0));
  delete from public.mv_youtube_oauth_states where user_id=p_user_id;
  delete from public.mv_youtube_connections where user_id=p_user_id;
end $$;
revoke all on function public.mv_disconnect_youtube(uuid) from public,anon,authenticated;
grant execute on function public.mv_disconnect_youtube(uuid) to service_role;
