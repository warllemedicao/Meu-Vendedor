-- TikTok OAuth state and encrypted account credentials
create table if not exists public.tiktok_oauth_states (
 state_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 consumed_at timestamptz
);
create table if not exists public.tiktok_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 open_id text not null,
 display_name text,
 avatar_url text,
 scopes text not null,
 access_ciphertext text not null,
 access_iv text not null,
 refresh_ciphertext text not null,
 refresh_iv text not null,
 access_expires_at timestamptz not null,
 refresh_expires_at timestamptz not null,
 connected_at timestamptz not null default now()
);
create index if not exists tiktok_oauth_states_expiry_idx on public.tiktok_oauth_states(expires_at);
alter table public.tiktok_oauth_states enable row level security;
alter table public.tiktok_connections enable row level security;
revoke all on public.tiktok_oauth_states from anon, authenticated;
revoke all on public.tiktok_connections from anon, authenticated;
-- Only the Edge Function service role may access tokens or OAuth states.
