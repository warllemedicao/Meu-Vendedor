begin;

alter table public.mv_publications
  drop constraint if exists mv_publications_destination_check;

alter table public.mv_publications
  add constraint mv_publications_destination_check
  check (destination in ('shopee_video', 'pinterest', 'tiktok_video', 'other_app'));

commit;
