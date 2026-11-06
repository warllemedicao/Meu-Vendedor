-- Relatórios privados: nunca armazenar tokens, cabeçalhos ou respostas brutas.
create table public.mv_ai_provider_audits (
  provider_id text primary key,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('not_configured','checked','invalid_credentials','permission_missing','unavailable','no_inference_endpoint')),
  report jsonb not null check (jsonb_typeof(report) = 'object' and octet_length(report::text) <= 8192)
);
create table public.mv_ai_audit_state (
  id boolean primary key default true check (id),
  next_run_at timestamptz not null default now(),
  last_worker_request_at timestamptz
);
insert into public.mv_ai_audit_state(id) values (true);
alter table public.mv_ai_provider_audits enable row level security;
alter table public.mv_ai_provider_audits force row level security;
alter table public.mv_ai_audit_state enable row level security;
alter table public.mv_ai_audit_state force row level security;
revoke all on public.mv_ai_provider_audits, public.mv_ai_audit_state from public, anon, authenticated;
grant select, insert, update on public.mv_ai_provider_audits, public.mv_ai_audit_state to service_role;
create function public.mv_claim_provider_audit() returns boolean
language sql security invoker set search_path = '' as $$
  with claimed as (
    update public.mv_ai_audit_state set next_run_at = now() + interval '1 hour'
    where id and next_run_at <= now() returning id
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.mv_claim_provider_audit() from public, anon, authenticated;
grant execute on function public.mv_claim_provider_audit() to service_role;
