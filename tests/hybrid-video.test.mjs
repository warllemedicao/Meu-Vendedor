import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {approvedCrop,kernelSource,validId} from '../supabase/functions/hybrid-video/_shared/contracts.ts';
import {runner} from '../supabase/functions/hybrid-video/_shared/runner.ts';
test('hybrid crop bounds and notebook configuration cannot become executable Python',async()=>{
 assert.equal(approvedCrop([0,2,50,80]),true);for(const value of [[0,0,0,5],[-1,0,4,5],[0,0,4097,5],null])assert.equal(approvedCrop(value),false);
 assert.equal(validId('not-an-id'),false);
 const source=kernelSource('print(HYBRID_CONFIG)',{url:'\"\n__import__("os").system("oops")'});
 assert.equal(source.split('\n').length,3);
 assert.equal(runner,await readFile(new URL('../executors/kaggle/hybrid_runner.py',import.meta.url),'utf8'));
});
test('hybrid queue enforces ownership, curated assets, shared GPU admission and durable idempotency',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.mv_audio_generations(id uuid primary key,user_id uuid,status text,tier text);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261107235204_hybrid_video_pipeline.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261108030234_hybrid_cooperative_cancellation.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261108030712_hybrid_product_reference.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.query("insert into mv_audio_generations values($1,$1,'completed','google-chirp3-hd'),($2,$2,'completed','google-chirp3-hd')",[a,b]);
  const asset=(await db.query("insert into mv_presenter_assets(presenter_id,name,object_path,face_crop,kind,approved,license_note) values('ana','Approved','operator/hybrid-assets/ana.webp','[1,2,30,40]','image',false,'project reference') returning id")).rows[0].id;
  const claim=async(user,audio)=>(await db.query('select mv_claim_hybrid($1,$2,$3,$4) result',[user,asset,audio,'a'.repeat(64)])).rows[0].result;
  await assert.rejects(claim(a,a),/hybrid_input_unavailable/);
  await db.exec('update mv_presenter_assets set approved=true');
  await assert.rejects(claim(b,a),/hybrid_input_unavailable/);
  const one=await claim(a,a);assert.equal(one.claimed,true);assert.equal((await claim(a,a)).claimed,false);
  await assert.rejects(claim(b,b),/hybrid_busy/);
  await db.exec("update mv_hybrid_jobs set cancel_requested=true");
  await assert.rejects(claim(b,b),/hybrid_busy/);
  await db.exec("update mv_hybrid_jobs set status='cancelled'");assert.equal((await claim(b,b)).claimed,true);
  assert.equal((await claim(a,a)).claimed,false);
  await db.exec("update mv_hybrid_jobs set status='failed'");
  const productClaim=async(path)=>(await db.query('select mv_claim_hybrid($1,$2,$3,$4,$5) result',[a,asset,a,'a'.repeat(64),path])).rows[0].result;
  await assert.rejects(productClaim(`${b}/inputs/product.webp`),/hybrid_input_unavailable/);
  await assert.rejects(productClaim(`${a}/inputs/../product.webp`),/hybrid_input_unavailable/);
  const withProduct=await productClaim(`${a}/inputs/product.webp`);
  assert.equal(withProduct.claimed,true);assert.notEqual(withProduct.job.id,one.job.id);
  assert.equal((await productClaim(`${a}/inputs/product.webp`)).claimed,false);
  await db.exec(`set role authenticated;`);
  assert.equal((await db.query('select * from mv_presenter_assets')).rows.length,1);
  await assert.rejects(db.query('select * from mv_hybrid_jobs'),/permission denied/);
  await assert.rejects(db.query('select mv_claim_hybrid($1,$2,$3,$4)',[a,asset,a,'b'.repeat(64)]),/permission denied/);
 }finally{await db.close();}
});
test('presenter identity catalog matches shipped references and keeps validation reports private', async () => {
 const {createHash}=await import('node:crypto');
 const {virtualPresenters}=await import('../src/lib/video-studio.ts');
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table mv_hybrid_jobs(user_id uuid,created_at timestamptz);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261108025035_presenter_profiles_and_hybrid_library.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261108025651_presenter_validation_reports.sql',import.meta.url),'utf8'));
  const profiles=(await db.query('select * from mv_presenter_profiles order by id')).rows;
  assert.equal(profiles.length,4);
  for (const profile of profiles) {
   const presenter=virtualPresenters.find(p=>p.id===profile.id);
   assert.equal(profile.reference_image,presenter.image);
   assert.equal(profile.reference_sha256,createHash('sha256').update(await readFile(new URL('../public'+presenter.image,import.meta.url))).digest('hex'));
   assert.equal(profile.visual_identity,presenter.visualIdentity);
  }
  await db.exec('set role authenticated;');
  assert.equal((await db.query('select * from mv_presenter_profiles')).rows.length,4);
  await assert.rejects(db.query("update mv_presenter_profiles set visual_approved=false"),/permission denied/);
  await assert.rejects(db.query('select * from mv_presenter_validations'),/permission denied/);
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from mv_presenter_profiles'),/permission denied/);
 } finally {await db.close();}
});
