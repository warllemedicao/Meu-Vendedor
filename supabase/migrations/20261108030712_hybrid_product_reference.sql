alter table public.mv_hybrid_jobs add column product_path text;
alter table public.mv_hybrid_jobs drop constraint mv_hybrid_jobs_user_id_asset_id_audio_id_key;
alter table public.mv_hybrid_jobs add constraint mv_hybrid_jobs_input_key unique nulls not distinct(user_id,asset_id,audio_id,product_path);
drop function public.mv_claim_hybrid(uuid,uuid,uuid,text);
create function public.mv_claim_hybrid(p_user uuid,p_asset uuid,p_audio uuid,p_hash text,p_product text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.mv_hybrid_jobs; a public.mv_presenter_assets;
begin
 if p_product is not null and (p_product not like p_user::text||'/inputs/%' or p_product like '%..%' or p_product !~ '/inputs/[A-Za-z0-9_-]+[.](jpg|png|webp)$') then raise exception 'hybrid_input_unavailable'; end if;
 perform pg_advisory_xact_lock(784234);
 select * into j from public.mv_hybrid_jobs where user_id=p_user and asset_id=p_asset and audio_id=p_audio and product_path is not distinct from p_product;
 if found then return jsonb_build_object('claimed',false,'job',to_jsonb(j)); end if;
 select * into a from public.mv_presenter_assets where id=p_asset and approved;
 if not found or not exists(select 1 from public.mv_audio_generations where id=p_audio and user_id=p_user and status='completed' and tier='google-chirp3-hd') then
   raise exception 'hybrid_input_unavailable';
 end if;
 if exists(select 1 from public.mv_hybrid_jobs where status in ('submitting','running','uncertain') and expires_at>now()) then raise exception 'hybrid_busy'; end if;
 if (select count(*) from public.mv_hybrid_jobs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'hybrid_daily_limit'; end if;
 insert into public.mv_hybrid_jobs(user_id,asset_id,audio_id,callback_hash,product_path) values(p_user,p_asset,p_audio,p_hash,p_product) returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end $$;
revoke all on function public.mv_claim_hybrid(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mv_claim_hybrid(uuid,uuid,uuid,text,text) to service_role;
