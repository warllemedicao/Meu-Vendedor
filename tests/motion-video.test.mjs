import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {assertReviewedInput,validateInput,importableVideoUrl,limitedBytes,engines,videoSignature} from '../supabase/functions/motion-generation/_shared/contracts.ts';
import {validateMotionFile} from '../src/lib/motion-video.ts';
import {motionRunner} from '../supabase/functions/motion-generation/_shared/runner.ts';
import {createVideoDatabase} from './helpers/video-db.mjs';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const input={engine:'wan-animate',assetId:a,productPath:`${a}/inputs/product.jpg`,driverPath:`${a}/inputs/driver.mp4`,mode:'animate',category:'tops',prompt:'Preserve the character and clothing',seconds:2,seed:42};
test('motion input is typed and owned; masks and product inputs cannot be omitted',()=>{
 assert.equal(validateInput(a,input).engine,'wan-animate');
 for(const patch of [{engine:'omnishow'},{seconds:30},{seed:NaN},{driverPath:`${b}/inputs/driver.mp4`,productPath:`${b}/inputs/product.jpg`},{referencePath:`${a}/inputs/../x.png`},{engine:'vace'},{engine:'fashn',productPath:undefined}]) assert.throws(()=>validateInput(a,{...input,...patch}));
 assert.equal(validateInput(a,{...input,referencePath:`${a}/motion/${b}.png`}).referencePath,`${a}/motion/${b}.png`);
 assert.throws(()=>validateInput(a,{...input,referencePath:`${b}/motion/${a}.png`}));
 assert.deepEqual(engines.filter(e=>e.supported).map(e=>e.id),['wan-animate','scail','vace','fashn']);
});
test('video imports refuse private hosts, URL credentials, redirects and social pages',async()=>{
 assert.equal(importableVideoUrl('https://videos.pexels.com/a/video.mp4').hostname,'videos.pexels.com');
 for(const url of ['http://videos.pexels.com/a.mp4','https://localhost/a.mp4','https://169.254.169.254/a.mp4','https://videos.pexels.com.evil.example/a.mp4','https://videos.pexels.com:8443/a.mp4','https://user@videos.pexels.com/a.mp4','https://youtube.com/watch?v=x','file:///video.mp4'])assert.throws(()=>importableVideoUrl(url));
 await assert.rejects(limitedBytes(new Response('abc',{status:302}),10));
 await assert.rejects(limitedBytes(new Response('123456789'),5),/media_too_large/);
 assert.equal((await limitedBytes(new Response('1234'),5)).length,4);
});
test('motion uploads check file bytes instead of trusting MIME or extension',async()=>{
 assert.equal(videoSignature(new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109])),true);
 assert.equal(await validateMotionFile(new File([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109])],'fake.txt',{type:'text/plain'}),'video'),'mp4');
 await assert.rejects(validateMotionFile(new File(['<html>bad</html>'],'video.mp4',{type:'video/mp4'}),'video'));
});
test('motion notebook bundle is reproducible and graph inputs remain data',async()=>{
 const graphs=await readFile(new URL('../executors/kaggle/motion_graphs.py',import.meta.url),'utf8');
 const runner=await readFile(new URL('../executors/kaggle/motion_runner.py',import.meta.url),'utf8');
 assert.equal(motionRunner,graphs+'\n'+runner);
 const result=spawnSync('python',['-c',`import sys;sys.path.insert(0,'executors/kaggle');from motion_graphs import graph
from motion_runner import include_requirement, sampling_progress
assert sampling_progress(" 15%|###| 3/20 [00:50]")=={'steps_completed':3,'steps_total':20}
assert sampling_progress("100%|####| 1427/1427")=={}
assert include_requirement('torchsde')
assert include_requirement('torchdiffeq>=0.2')
assert not include_requirement('torch>=2.9')
assert not include_requirement('torchvision')
assert not include_requirement('# comment')
for engine in ['wan-animate','scail','vace']:
 g=graph(engine,'test __import__("os")',2)
 assert g['5']['inputs']['text']=='test __import__("os")'
 assert g['99']['class_type']=='SaveImage'
 assert g['18']['inputs'].get('num_frames',g['18']['inputs'].get('length',33))==33
 for node in g.values():
  for value in node['inputs'].values():
   if isinstance(value,list): assert value[0] in g
assert 'reference_image' in graph('vace','test')['18']['inputs']
assert graph('vace','test')['23']['inputs']['trim_amount']==['18',3]
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('new and MuseTalk GPU claims coordinate, preserve identity and reject cross-account media',async()=>{
 const db=await createVideoDatabase();
 try{
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.exec("insert into mv_presenter_assets(id,presenter_id,name,object_path,face_crop,kind,approved,license_note) values('"+a+"','ana','Reference','operator/hybrid-assets/ana.webp','[1,2,30,40]','image',true,'project reference')");
  const claim=async(user,fingerprint,patch={})=>(await db.query('select mv_claim_motion($1,$2,$3,$4,$5,$6) result',[user,a,'wan-animate',{...input,...patch},fingerprint.repeat(64),'a'.repeat(64)])).rows[0].result;
  const one=await claim(a,'a');assert.equal(one.claimed,true);
  assert.equal((await claim(a,'a')).job.id,one.job.id);assert.equal((await claim(a,'a')).claimed,false);
  await assert.rejects(claim(b,'b'),/input_invalid/);
  await assert.rejects(claim(b,'b',{driverPath:`${b}/inputs/driver.mp4`,productPath:`${b}/inputs/product.jpg`}),/motion_busy/);
  await db.exec("update mv_motion_jobs set cancel_requested=true");
  await assert.rejects(claim(b,'b',{driverPath:`${b}/inputs/driver.mp4`,productPath:`${b}/inputs/product.jpg`}),/motion_busy/);
  await db.exec("update mv_motion_jobs set status='cancelled'");
  assert.equal((await claim(b,'b',{driverPath:`${b}/inputs/driver.mp4`,productPath:`${b}/inputs/product.jpg`})).claimed,true);
  const definition=(await db.query("select pg_get_functiondef('mv_claim_hybrid(uuid,uuid,uuid,text,text)'::regprocedure) as body")).rows[0].body;
  assert.match(definition,/public.mv_motion_jobs/);
  await db.exec('set role authenticated;');
  await assert.rejects(db.query('select * from mv_motion_jobs'),/permission denied/);
  await assert.rejects(claim(a,'c'),/permission denied/);
 }finally{await db.close();}
});

test('review binds exact product and character bytes and rejects another garment or presenter',()=>{
 const productHash='a'.repeat(64), referenceHash='b'.repeat(64);
 const reviewed={...input,reviewedProductSha256:productHash,reviewedReferenceSha256:referenceHash};
 assert.throws(()=>assertReviewedInput(input,productHash,referenceHash),/input_review_required/);
 assert.throws(()=>assertReviewedInput(reviewed,'c'.repeat(64),referenceHash),/input_review_required/);
 assert.doesNotThrow(()=>assertReviewedInput(reviewed,productHash,referenceHash));
 const dressed={...reviewed,referencePath:`${a}/motion/${b}.png`,preparedJobId:b};
 const prepared={asset_id:a,status:'completed',engine:'fashn',result_path:dressed.referencePath,input:reviewed};
 assert.doesNotThrow(()=>assertReviewedInput(dressed,productHash,referenceHash,prepared));
 for(const patch of [{asset_id:b},{status:'failed'},{input:{...reviewed,reviewedProductSha256:'c'.repeat(64)}}]) assert.throws(()=>assertReviewedInput(dressed,productHash,referenceHash,{...prepared,...patch}),/prepared_reference_mismatch/);
 assert.throws(()=>assertReviewedInput(dressed,productHash,referenceHash,null),/prepared_reference_mismatch/);
});
