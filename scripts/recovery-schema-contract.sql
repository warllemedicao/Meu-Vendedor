select bool_and(contract_ok) as compatible
from (values
  (to_regclass('public.mv_connections') is not null),
  (to_regclass('public.mv_connection_secrets') is not null),
  (to_regclass('public.mv_products') is not null),
  (to_regclass('public.mv_sync_runs') is not null),
  (to_regclass('public.mv_generated_links') is not null),
  (to_regclass('public.mv_connector_locks') is not null),
  (to_regclass('public.mv_affiliate_links') is not null),
  (to_regclass('public.mv_platforms') is not null),
  (to_regclass('public.mv_youtube_connections') is not null),
  (to_regclass('public.mv_youtube_oauth_states') is not null),
  (to_regprocedure('public.mv_set_updated_at()') is not null),
  (to_regprocedure('public.mv_acquire_connector_lock(uuid,uuid)') is not null),
  (to_regprocedure('public.mv_release_connector_lock(uuid,uuid)') is not null),
  (to_regprocedure('public.mv_publish_shopee_sync(uuid,uuid,jsonb,text,timestamptz)') is not null),
  (to_regprocedure('public.mv_save_generated_link(uuid,uuid,uuid,text)') is not null),
  (to_regprocedure('public.mv_begin_youtube_oauth(uuid,text,text,text)') is not null),
  (to_regprocedure('public.mv_finish_youtube_connection(uuid,text,text,text,text,text,text,text[])') is not null),
  (to_regprocedure('public.mv_disconnect_youtube(uuid)') is not null)
) as contracts(contract_ok);
