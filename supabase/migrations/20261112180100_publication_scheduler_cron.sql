begin;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job integer;
begin
  select jobid into existing_job from cron.job where jobname = 'mv-publication-scheduler';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('mv-publication-scheduler', '* * * * *',
    'select public.mv_process_due_publications();');
end;
$$;

commit;
