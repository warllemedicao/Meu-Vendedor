begin;
create table public.mv_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 platform_id text not null references public.mv_platforms(id),
 status text not null default 'disconnected' check(status in ('connected','error','disconnected')),
 last_sync_at timestamptz,
 last_error_code text,
 sync_scope text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,platform_id),unique(id,user_id,platform_id)
);
create table public.mv_connection_secrets (
 connection_id uuid primary key references public.mv_connections(id) on delete cascade,
 encrypted_value text not null,
 key_version int not null default 1 check(key_version=1)
);
create table public.mv_products (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null,
 user_id uuid not null,
 platform_id text not null,
 external_id text not null,
 shop_id text not null,
 item_id text not null,
 title text not null check(char_length(title) between 1 and 500),
 shop_name text,
 image_url text,
 product_url text not null check(product_url ~ '^https://'),
 price_min numeric(18,2),price_max numeric(18,2),
 commission_rate numeric(12,8),commission_estimate numeric(18,2),
 sales bigint check(sales>=0),rating numeric(4,2),discount_percent int,
 offer_ends_at timestamptz,
 in_latest_sync boolean not null default true,
 synced_at timestamptz not null default now(),
 foreign key(connection_id,user_id,platform_id) references public.mv_connections(id,user_id,platform_id) on delete cascade,
 unique(connection_id,external_id),unique(id,user_id,connection_id)
);
create index mv_products_user_latest on public.mv_products(user_id,in_latest_sync,sales desc);
create table public.mv_sync_runs (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.mv_connections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('success','failed')),
 products_count int not null default 0,
 error_code text,
 started_at timestamptz not null,
 finished_at timestamptz not null default now()
);
create index mv_sync_runs_user on public.mv_sync_runs(user_id,finished_at desc);
create table public.mv_generated_links (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 connection_id uuid not null,
 product_id uuid not null,
 affiliate_url text not null check(affiliate_url ~ '^https://'),
 created_at timestamptz not null default now(),
 foreign key(product_id,user_id,connection_id) references public.mv_products(id,user_id,connection_id) on delete cascade,
 unique(product_id,user_id)
);
create table public.mv_connector_locks (
 user_id uuid primary key references auth.users(id) on delete cascade,
 lock_id uuid not null,
 locked_until timestamptz not null,
 last_attempt_at timestamptz not null
);

alter table public.mv_connections enable row level security;
alter table public.mv_connections force row level security;
alter table public.mv_connection_secrets enable row level security;
alter table public.mv_connection_secrets force row level security;
alter table public.mv_products enable row level security;
alter table public.mv_products force row level security;
alter table public.mv_sync_runs enable row level security;
alter table public.mv_sync_runs force row level security;
alter table public.mv_generated_links enable row level security;
alter table public.mv_generated_links force row level security;
alter table public.mv_connector_locks enable row level security;
alter table public.mv_connector_locks force row level security;
create policy mv_connections_read on public.mv_connections for select to authenticated using((select auth.uid())=user_id);
create policy mv_products_read on public.mv_products for select to authenticated using((select auth.uid())=user_id);
create policy mv_sync_runs_read on public.mv_sync_runs for select to authenticated using((select auth.uid())=user_id);
create policy mv_generated_links_read on public.mv_generated_links for select to authenticated using((select auth.uid())=user_id);
revoke all on public.mv_connections,public.mv_connection_secrets,public.mv_products,public.mv_sync_runs,public.mv_generated_links,public.mv_connector_locks from public,anon,authenticated;
grant select on public.mv_connections,public.mv_products,public.mv_sync_runs,public.mv_generated_links to authenticated;
grant all on public.mv_connections,public.mv_connection_secrets,public.mv_products,public.mv_sync_runs,public.mv_generated_links,public.mv_connector_locks to service_role;
create trigger mv_connections_updated before update on public.mv_connections for each row execute function public.mv_set_updated_at();

create function public.mv_acquire_connector_lock(p_user_id uuid,p_lock_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected int;
begin
 insert into public.mv_connector_locks(user_id,lock_id,locked_until,last_attempt_at)
 values(p_user_id,p_lock_id,now()+interval '120 seconds',now())
 on conflict(user_id) do update set lock_id=excluded.lock_id,locked_until=excluded.locked_until,last_attempt_at=excluded.last_attempt_at
 where public.mv_connector_locks.locked_until<now() and public.mv_connector_locks.last_attempt_at<now()-interval '5 seconds';
 get diagnostics affected=row_count; return affected=1;
end;$$;
create function public.mv_release_connector_lock(p_user_id uuid,p_lock_id uuid) returns void
language sql security definer set search_path='' as $$
 update public.mv_connector_locks set locked_until=now() where user_id=p_user_id and lock_id=p_lock_id;
$$;

create function public.mv_publish_shopee_sync(p_user_id uuid,p_lock_id uuid,p_products jsonb,p_credentials text default null,p_started_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid; p jsonb;
begin
 if not exists(select 1 from public.mv_connector_locks where user_id=p_user_id and lock_id=p_lock_id and locked_until>now()) then raise exception 'connector_lock_expired';end if;
 if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>60 then raise exception 'invalid_products';end if;
 insert into public.mv_connections(user_id,platform_id,status,last_sync_at,last_error_code,sync_scope)
 values(p_user_id,'shopee','connected',now(),null,'Até 60 ofertas disponíveis; ordenação por vendas informadas pela API')
 on conflict(user_id,platform_id) do update set status='connected',last_sync_at=now(),last_error_code=null,sync_scope=excluded.sync_scope returning id into cid;
 if p_credentials is not null then
  insert into public.mv_connection_secrets(connection_id,encrypted_value) values(cid,p_credentials)
  on conflict(connection_id) do update set encrypted_value=excluded.encrypted_value;
 elsif not exists(select 1 from public.mv_connection_secrets where connection_id=cid) then raise exception 'credentials_missing';end if;
 update public.mv_products set in_latest_sync=false where connection_id=cid and user_id=p_user_id;
 for p in select value from jsonb_array_elements(p_products) loop
  insert into public.mv_products(connection_id,user_id,platform_id,external_id,shop_id,item_id,title,shop_name,image_url,product_url,price_min,price_max,commission_rate,commission_estimate,sales,rating,discount_percent,offer_ends_at)
  values(cid,p_user_id,'shopee',p->>'external_id',p->>'shop_id',p->>'item_id',p->>'title',p->>'shop_name',p->>'image_url',p->>'product_url',(p->>'price_min')::numeric,(p->>'price_max')::numeric,(p->>'commission_rate')::numeric,(p->>'commission_estimate')::numeric,(p->>'sales')::bigint,(p->>'rating')::numeric,(p->>'discount_percent')::int,(p->>'offer_ends_at')::timestamptz)
  on conflict(connection_id,external_id) do update set title=excluded.title,shop_name=excluded.shop_name,image_url=excluded.image_url,product_url=excluded.product_url,price_min=excluded.price_min,price_max=excluded.price_max,commission_rate=excluded.commission_rate,commission_estimate=excluded.commission_estimate,sales=excluded.sales,rating=excluded.rating,discount_percent=excluded.discount_percent,offer_ends_at=excluded.offer_ends_at,in_latest_sync=true,synced_at=now();
 end loop;
 insert into public.mv_sync_runs(connection_id,user_id,status,products_count,started_at) values(cid,p_user_id,'success',jsonb_array_length(p_products),p_started_at);
 return cid;
end;$$;
revoke all on function public.mv_acquire_connector_lock(uuid,uuid),public.mv_release_connector_lock(uuid,uuid),public.mv_publish_shopee_sync(uuid,uuid,jsonb,text,timestamptz) from public,anon,authenticated;
grant execute on function public.mv_acquire_connector_lock(uuid,uuid),public.mv_release_connector_lock(uuid,uuid),public.mv_publish_shopee_sync(uuid,uuid,jsonb,text,timestamptz) to service_role;

alter table public.mv_generated_links add column saved_link_id uuid references public.mv_affiliate_links(id) on delete set null;
grant all on public.mv_affiliate_links to service_role;
create function public.mv_save_generated_link(p_user_id uuid,p_lock_id uuid,p_product_id uuid,p_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare product public.mv_products%rowtype; sid uuid; gid uuid;
begin
 if not exists(select 1 from public.mv_connector_locks where user_id=p_user_id and lock_id=p_lock_id and locked_until>now()) then raise exception 'connector_lock_expired';end if;
 select * into product from public.mv_products where id=p_product_id and user_id=p_user_id;
 if not found then raise exception 'product_not_found';end if;
 select saved_link_id into sid from public.mv_generated_links where product_id=p_product_id and user_id=p_user_id;
 if sid is null then
  insert into public.mv_affiliate_links(user_id,platform_id,title,url,campaign,notes)
  values(p_user_id,'shopee',left(product.title,160),p_url,'Produtos sincronizados','Link gerado pela Open API Shopee para esta conta.') returning id into sid;
 else
  update public.mv_affiliate_links set url=p_url where id=sid and user_id=p_user_id;
 end if;
 insert into public.mv_generated_links(user_id,connection_id,product_id,affiliate_url,saved_link_id)
 values(p_user_id,product.connection_id,p_product_id,p_url,sid)
 on conflict(product_id,user_id) do update set affiliate_url=excluded.affiliate_url,saved_link_id=excluded.saved_link_id,created_at=now() returning id into gid;
 return jsonb_build_object('id',gid,'url',p_url,'savedLinkId',sid);
end;$$;
revoke all on function public.mv_save_generated_link(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mv_save_generated_link(uuid,uuid,uuid,text) to service_role;
commit;
