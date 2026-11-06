-- Add the official Google video adapter without changing ownership or RLS.
alter table public.mv_video_jobs drop constraint if exists mv_video_jobs_provider_check;
alter table public.mv_video_jobs add constraint mv_video_jobs_provider_check
  check (provider in ('pending','gemini','google-gemini','huggingface','modal','cloudflare-workers-ai','magic-hour','replicate'));

alter table public.mv_video_ai_attempts drop constraint if exists mv_video_ai_attempts_provider_id_check;
alter table public.mv_video_ai_attempts add constraint mv_video_ai_attempts_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate'));
alter table public.mv_video_ai_budget_reservations drop constraint if exists mv_video_ai_budget_reservations_provider_id_check;
alter table public.mv_video_ai_budget_reservations add constraint mv_video_ai_budget_reservations_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate'));
alter table public.mv_video_ai_provider_cooldowns drop constraint if exists mv_video_ai_provider_cooldowns_provider_id_check;
alter table public.mv_video_ai_provider_cooldowns add constraint mv_video_ai_provider_cooldowns_provider_id_check
  check (provider_id in ('cloudflare-workers-ai','magic-hour','google-gemini','replicate'));

-- Preserve the latest deployed function bodies, security attributes and ACLs.
-- Only widen the existing provider whitelist and project-provider mapping.
do $$
declare r record; definition text; updated text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('mv_record_video_ai_attempt','mv_reserve_video_ai_budget','mv_set_video_ai_cooldown','mv_advance_video_job')
  loop
    definition := pg_get_functiondef(r.oid);
    updated := replace(definition, '''cloudflare-workers-ai'',''magic-hour'',''replicate''', '''cloudflare-workers-ai'',''magic-hour'',''google-gemini'',''replicate''');
    if position('when ''google-gemini'' then ''google-gemini''' in updated)=0 then
      updated := replace(updated, 'when ''replicate'' then ''replicate''', 'when ''replicate'' then ''replicate'' when ''google-gemini'' then ''google-gemini''');
    end if;
    if updated <> definition then execute updated;
    elsif position('google-gemini' in definition)=0 then raise exception 'google_provider_migration_contract_changed: %', r.proname;
    end if;
  end loop;
end $$;
