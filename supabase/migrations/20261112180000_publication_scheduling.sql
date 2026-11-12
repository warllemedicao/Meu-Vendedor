begin;

create table public.mv_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  product_id text,
  product_title text not null check (char_length(product_title) between 1 and 500),
  source_marketplace text not null check (char_length(source_marketplace) between 1 and 80),
  affiliate_url text not null check (affiliate_url ~ '^https://[^[:space:]]+$'),
  publication_title text not null check (char_length(publication_title) between 1 and 200),
  caption text not null check (char_length(caption) <= 5000),
  hashtags text not null check (char_length(hashtags) <= 1000),
  destination text not null check (destination in ('shopee_video','pinterest','other_app')),
  media_path text not null,
  media_type text not null check (media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  media_filename text not null check (char_length(media_filename) between 1 and 255),
  status text not null check (status in ('draft','scheduled','awaiting_manual_action','processing','published','failed','cancelled')),
  scheduled_at timestamptz,
  timezone text not null check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id),
  unique (user_id, idempotency_key, destination),
  check ((status = 'draft' and scheduled_at is null) or (status <> 'draft' and scheduled_at is not null))
);

create index mv_publications_user_status_schedule_idx
  on public.mv_publications (user_id, status, scheduled_at);
create index mv_publications_due_idx
  on public.mv_publications (scheduled_at, id)
  where status = 'scheduled';

create table public.mv_publication_attempts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  request_key uuid not null unique,
  action text not null check (action in ('action_required','share_handoff','manual_published','manual_failed')),
  result text not null check (result in ('action_required','handed_to_share_sheet','user_confirmed_published','user_marked_failed')),
  details text not null check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  foreign key (publication_id, user_id) references public.mv_publications(id, user_id) on delete cascade,
  unique (publication_id, attempt_number)
);

create index mv_publication_attempts_publication_owner_idx
  on public.mv_publication_attempts (publication_id, user_id);

alter table public.mv_publications enable row level security;
alter table public.mv_publication_attempts enable row level security;

revoke all on public.mv_publications, public.mv_publication_attempts from anon, authenticated;
grant select on public.mv_publications, public.mv_publication_attempts to authenticated;
grant all on public.mv_publications, public.mv_publication_attempts to service_role;

create policy mv_publications_read_own on public.mv_publications
for select to authenticated
using (user_id = (select auth.uid()));

create policy mv_publication_attempts_read_own on public.mv_publication_attempts
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.mv_process_due_publications()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  processed integer;
begin
  with due as (
    update public.mv_publications p
    set status = 'awaiting_manual_action', updated_at = now()
    where p.id in (
      select candidate.id
      from public.mv_publications candidate
      where candidate.status = 'scheduled' and candidate.scheduled_at <= now()
      order by candidate.scheduled_at, candidate.id
      for update skip locked
      limit 100
    )
    returning p.id, p.user_id
  ), logged as (
    insert into public.mv_publication_attempts
      (publication_id, user_id, attempt_number, request_key, action, result, details)
    select id, user_id, 1, gen_random_uuid(), 'action_required', 'action_required',
      'O horário programado chegou. A publicação aguarda ação manual.'
    from due
    on conflict (publication_id, attempt_number) do nothing
    returning id
  )
  select count(*) into processed from due;
  return processed;
end;
$$;

create or replace function public.mv_apply_publication_action(
  p_user_id uuid,
  p_publication_id uuid,
  p_action text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  publication public.mv_publications%rowtype;
  existing_action public.mv_publication_attempts%rowtype;
  next_attempt integer;
  action_result text;
  detail text;
begin
  if p_action not in ('share_handoff','manual_published','manual_failed') then
    raise exception 'publication_action_invalid';
  end if;

  select * into publication
  from public.mv_publications
  where id = p_publication_id and user_id = p_user_id
  for update;
  if not found then raise exception 'publication_not_found'; end if;

  select * into existing_action
  from public.mv_publication_attempts
  where request_key = p_request_key and user_id = p_user_id;
  if found then return to_jsonb(publication); end if;

  if publication.status <> 'awaiting_manual_action' then
    raise exception 'publication_action_not_available';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt
  from public.mv_publication_attempts
  where publication_id = p_publication_id;

  if p_action = 'manual_published' then
    action_result := 'user_confirmed_published';
    detail := 'O usuário confirmou manualmente que concluiu a publicação.';
    update public.mv_publications
    set status = 'published', completed_at = now(), updated_at = now()
    where id = p_publication_id and user_id = p_user_id
    returning * into publication;
  elsif p_action = 'manual_failed' then
    action_result := 'user_marked_failed';
    detail := 'O usuário informou que a ação manual não foi concluída.';
    update public.mv_publications
    set status = 'failed', updated_at = now()
    where id = p_publication_id and user_id = p_user_id
    returning * into publication;
  else
    action_result := 'handed_to_share_sheet';
    detail := 'O conteúdo foi entregue ao seletor de compartilhamento; a postagem não foi confirmada.';
  end if;

  insert into public.mv_publication_attempts
    (publication_id, user_id, attempt_number, request_key, action, result, details)
  values
    (p_publication_id, p_user_id, next_attempt, p_request_key, p_action, action_result, detail);

  return to_jsonb(publication);
end;
$$;

revoke all on function public.mv_process_due_publications() from public, anon, authenticated;
revoke all on function public.mv_apply_publication_action(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.mv_process_due_publications() to service_role;
grant execute on function public.mv_apply_publication_action(uuid,uuid,text,uuid) to service_role;

commit;
