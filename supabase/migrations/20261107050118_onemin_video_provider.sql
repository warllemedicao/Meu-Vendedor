-- Add 1min.ai without changing ownership, RLS, function security attributes or grants.
alter table public.mv_video_jobs drop constraint if exists mv_video_jobs_provider_check;
alter table public.mv_video_jobs add constraint mv_video_jobs_provider_check
  check (provider in ('pending','gemini','google-gemini','huggingface','modal','cloudflare-workers-ai','magic-hour','replicate','onemin'));

alter table public.mv_video_ai_attempts drop constraint if exists mv_video_ai_attempts_provider_id_check;
alter table public.mv_video_ai_attempts add constraint mv_video_ai_attempts_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate','onemin'));
alter table public.mv_video_ai_budget_reservations drop constraint if exists mv_video_ai_budget_reservations_provider_id_check;
alter table public.mv_video_ai_budget_reservations add constraint mv_video_ai_budget_reservations_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate','onemin'));
alter table public.mv_video_ai_provider_cooldowns drop constraint if exists mv_video_ai_provider_cooldowns_provider_id_check;
alter table public.mv_video_ai_provider_cooldowns add constraint mv_video_ai_provider_cooldowns_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate','onemin'));

alter table public.mv_video_projects drop constraint if exists mv_video_projects_provider_check;
alter table public.mv_video_projects add constraint mv_video_projects_provider_check
  check (provider in ('mock','google-gemini','huggingface','modal','cloudflare-workers-ai','magic-hour','replicate','onemin'));

-- Widen the current RPC definitions; fail rather than silently miss a changed contract.
do $$
declare r record; definition text; updated text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('mv_record_video_ai_attempt','mv_reserve_video_ai_budget','mv_set_video_ai_cooldown','mv_advance_video_job')
  loop
    definition := pg_get_functiondef(r.oid);
    updated := replace(definition, $old$'cloudflare-workers-ai','magic-hour','google-gemini','replicate'$old$, $new$'cloudflare-workers-ai','magic-hour','google-gemini','replicate','onemin'$new$);
    if r.proname = 'mv_advance_video_job' and position($map$when 'onemin' then 'onemin'$map$ in updated)=0 then
      updated := replace(updated, $old$when 'replicate' then 'replicate'$old$, $new$when 'replicate' then 'replicate' when 'onemin' then 'onemin'$new$);
    end if;
    if updated <> definition then execute updated;
    elsif position('onemin' in definition)=0 then raise exception 'onemin_provider_migration_contract_changed: %', r.proname;
    end if;
  end loop;
end $$;
