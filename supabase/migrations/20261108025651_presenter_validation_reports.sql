create table public.mv_presenter_validations (
 id text primary key,
 presenter_id text not null references public.mv_presenter_profiles(id),
 status text not null default 'claimed' check (status in ('claimed','running','completed','failed','uncertain')),
 report jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index mv_presenter_validations_presenter_idx on public.mv_presenter_validations(presenter_id,created_at desc);
alter table public.mv_presenter_validations enable row level security;
alter table public.mv_presenter_validations force row level security;
revoke all on public.mv_presenter_validations from public,anon,authenticated;
grant all on public.mv_presenter_validations to service_role;
