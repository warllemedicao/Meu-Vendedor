-- Apoia consultas e verificações referenciais sem alterar dados ou políticas.
set lock_timeout = '5s';

create index if not exists mv_affiliate_links_platform_idx on public.mv_affiliate_links (platform_id);
create index if not exists mv_connections_platform_idx on public.mv_connections (platform_id);
create index if not exists mv_generated_links_product_owner_connection_idx on public.mv_generated_links (product_id, user_id, connection_id);
create index if not exists mv_generated_links_saved_link_idx on public.mv_generated_links (saved_link_id);
create index if not exists mv_products_connection_owner_platform_idx on public.mv_products (connection_id, user_id, platform_id);
create index if not exists mv_sync_runs_connection_idx on public.mv_sync_runs (connection_id);
create index if not exists mv_video_jobs_project_owner_idx on public.mv_video_jobs (project_id, user_id);
create index if not exists mv_video_projects_scene_template_idx on public.mv_video_projects (scene_preset_id, template_id);

reset lock_timeout;
