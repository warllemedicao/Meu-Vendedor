create table if not exists public.tiktok_sandbox_connections (like public.tiktok_connections including all);
create table if not exists public.tiktok_sandbox_oauth_states (like public.tiktok_oauth_states including all);
alter table public.tiktok_sandbox_connections enable row level security;
alter table public.tiktok_sandbox_oauth_states enable row level security;
revoke all on public.tiktok_sandbox_connections from anon, authenticated;
revoke all on public.tiktok_sandbox_oauth_states from anon, authenticated;
