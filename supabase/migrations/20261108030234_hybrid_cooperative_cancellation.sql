alter table public.mv_hybrid_jobs add column cancel_requested boolean not null default false;
alter table public.mv_hybrid_jobs drop constraint mv_hybrid_jobs_status_check;
alter table public.mv_hybrid_jobs add constraint mv_hybrid_jobs_status_check check (status in ('submitting','running','completed','failed','uncertain','cancelled'));
