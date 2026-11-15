create table if not exists public.hyperbrowser_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hyperbrowser_profiles enable row level security;

revoke all on public.hyperbrowser_profiles from anon, authenticated;

comment on table public.hyperbrowser_profiles is 'Server-only mapping from authenticated Meu Vendedor users to Hyperbrowser profile IDs. Never store cookies or API keys.';
