begin;

create table public.mv_platforms (
  id text primary key check (id in ('shopee','tiktok','mercado-livre','amazon','magazine-luiza')),
  name text not null,
  portal_url text not null check (portal_url ~ '^https://'),
  created_at timestamptz not null default now()
);
insert into public.mv_platforms (id,name,portal_url) values
 ('shopee','Shopee','https://affiliate.shopee.com.br/'),
 ('tiktok','TikTok','https://www.tiktok.com/'),
 ('mercado-livre','Mercado Livre','https://www.mercadolivre.com.br/l/afiliados-home'),
 ('amazon','Amazon','https://associados.amazon.com.br/'),
 ('magazine-luiza','Magazine Luiza','https://www.magazinevoce.com.br/');

create table public.mv_profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mv_affiliate_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform_id text not null references public.mv_platforms(id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  url text not null check (char_length(url) between 10 and 2048 and url ~ '^https://[^[:space:]@]+$'),
  campaign text not null default '' check (char_length(campaign) <= 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mv_affiliate_links_user_created_idx on public.mv_affiliate_links(user_id,created_at desc);

create function public.mv_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger mv_profile_updated before update on public.mv_profiles for each row execute function public.mv_set_updated_at();
create trigger mv_link_updated before update on public.mv_affiliate_links for each row execute function public.mv_set_updated_at();

create function public.mv_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into public.mv_profiles(id) values(new.id) on conflict(id) do nothing; return new; end;
$$;
create trigger mv_auth_user_created after insert on auth.users for each row execute function public.mv_create_profile();
-- Usuários já existentes também recebem perfil, sem alterar dados de auth.users.
insert into public.mv_profiles(id) select id from auth.users on conflict(id) do nothing;

alter table public.mv_platforms enable row level security;
alter table public.mv_profiles enable row level security;
alter table public.mv_affiliate_links enable row level security;
alter table public.mv_platforms force row level security;
alter table public.mv_profiles force row level security;
alter table public.mv_affiliate_links force row level security;

create policy mv_platforms_read on public.mv_platforms for select to anon,authenticated using(true);
create policy mv_profiles_read on public.mv_profiles for select to authenticated using((select auth.uid()) = id);
create policy mv_profiles_insert on public.mv_profiles for insert to authenticated with check((select auth.uid()) = id);
create policy mv_profiles_update on public.mv_profiles for update to authenticated using((select auth.uid()) = id) with check((select auth.uid()) = id);
create policy mv_links_read on public.mv_affiliate_links for select to authenticated using((select auth.uid()) = user_id);
create policy mv_links_insert on public.mv_affiliate_links for insert to authenticated with check((select auth.uid()) = user_id);
create policy mv_links_update on public.mv_affiliate_links for update to authenticated using((select auth.uid()) = user_id) with check((select auth.uid()) = user_id);
create policy mv_links_delete on public.mv_affiliate_links for delete to authenticated using((select auth.uid()) = user_id);

revoke all on public.mv_platforms,public.mv_profiles,public.mv_affiliate_links from public,anon,authenticated;
grant select on public.mv_platforms to anon,authenticated;
grant select on public.mv_profiles to authenticated;
grant insert(display_name),update(display_name) on public.mv_profiles to authenticated;
grant select,delete on public.mv_affiliate_links to authenticated;
grant insert(platform_id,title,url,campaign,notes),update(platform_id,title,url,campaign,notes) on public.mv_affiliate_links to authenticated;
revoke all on function public.mv_set_updated_at() from public,anon,authenticated;
revoke all on function public.mv_create_profile() from public,anon,authenticated;

commit;
