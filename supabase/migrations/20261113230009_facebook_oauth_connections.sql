-- Facebook OAuth: tables are not exposed to application roles.
create table if not exists public.facebook_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table if not exists public.facebook_page_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  page_id text not null,
  page_name text not null,
  token_ciphertext text not null,
  token_iv text not null,
  connected_at timestamptz not null default now()
);
alter table public.facebook_oauth_states enable row level security;
alter table public.facebook_page_connections enable row level security;
revoke all on public.facebook_oauth_states from anon, authenticated;
revoke all on public.facebook_page_connections from anon, authenticated;
create index if not exists facebook_oauth_states_expires_idx on public.facebook_oauth_states(expires_at);
