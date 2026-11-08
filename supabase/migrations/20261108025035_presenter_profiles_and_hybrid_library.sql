-- Persistent identity for tools; visual approval is separate from lip-sync approval.
create table public.mv_presenter_profiles (
 id text primary key check (id in ('ana','lucas','carla','rafael')),
 name text not null,
 body_type text not null check (body_type in ('esguio','plus-size')),
 visual_identity text not null,
 reference_image text not null check (reference_image ~ '^/presenters/[a-z0-9-]+[.]webp$'),
 reference_sha256 text not null check (reference_sha256 ~ '^[a-f0-9]{64}$'),
 google_voice text not null check (google_voice ~ '^pt-BR-Chirp3-HD-[A-Za-z]+$'),
 preferences text not null,
 visual_approved boolean not null default false,
 provenance text not null,
 updated_at timestamptz not null default now()
);
alter table public.mv_presenter_profiles enable row level security;
alter table public.mv_presenter_profiles force row level security;
revoke all on public.mv_presenter_profiles from public,anon,authenticated;
grant select on public.mv_presenter_profiles to authenticated;
grant all on public.mv_presenter_profiles to service_role;
create policy readable_presenter_profiles on public.mv_presenter_profiles for select to authenticated using (visual_approved);
insert into public.mv_presenter_profiles(id,name,body_type,visual_identity,reference_image,reference_sha256,google_voice,preferences,visual_approved,provenance) values ('ana','Ana','esguio','mulher adulta brasileira de biotipo esguio e proporções naturais, pele morena clara, cabelo escuro ondulado na altura dos ombros, blusa coral e blazer claro, aparência realista','/presenters/ana.webp','7fe37f21962a108f8a4dd94d3e4e78f225e9f59e56cd34b36040b600f503208a','pt-BR-Chirp3-HD-Aoede','apresentação próxima, gestos leves e contato visual com a câmera',true,'Existing project fictional presenter reference; lip sync approved separately.');
insert into public.mv_presenter_profiles(id,name,body_type,visual_identity,reference_image,reference_sha256,google_voice,preferences,visual_approved,provenance) values ('lucas','Lucas','esguio','homem adulto brasileiro de biotipo esguio e proporções naturais, pele morena, cabelo preto curto, barba bem aparada, camisa verde-petróleo sobre camiseta clara, aparência realista','/presenters/lucas.webp','2598f190b76b16381d3e34784a79291096ab1ad2e9fc8aa36d87c7144f632abd','pt-BR-Chirp3-HD-Puck','ritmo direto, linguagem atual e demonstrações objetivas',true,'Existing project fictional presenter reference; lip sync approved separately.');
insert into public.mv_presenter_profiles(id,name,body_type,visual_identity,reference_image,reference_sha256,google_voice,preferences,visual_approved,provenance) values ('carla','Carla','plus-size','mulher adulta brasileira plus size, com proporções naturais, pele negra, cabelo cacheado preso de forma elegante, blusa verde-esmeralda e acessórios discretos, aparência realista','/presenters/carla-v2.webp','acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9','pt-BR-Chirp3-HD-Kore','movimentos elegantes, dicção clara e composição visual refinada',true,'Fictional adult generated with built-in image generation on 2026-11-08; visually reviewed for identity, photorealism and plus-size body. Lip sync approved separately.');
insert into public.mv_presenter_profiles(id,name,body_type,visual_identity,reference_image,reference_sha256,google_voice,preferences,visual_approved,provenance) values ('rafael','Rafael','plus-size','homem adulto brasileiro plus size, com proporções naturais, pele morena clara, cabelo curto escuro com fios grisalhos, polo terracota, aparência realista','/presenters/rafael-v2.webp','04bb0440f5ca1b0364e9e19ad0c2cd63fb5c0e555af3dc9a42b1513e3aa5bc61','pt-BR-Chirp3-HD-Charon','gestos comunicativos, sorriso natural e chamadas para ação claras',true,'Fictional adult generated with built-in image generation on 2026-11-08; visually reviewed for identity, photorealism and plus-size body. Lip sync approved separately.');
create index mv_hybrid_jobs_user_created_idx on public.mv_hybrid_jobs(user_id,created_at desc);
