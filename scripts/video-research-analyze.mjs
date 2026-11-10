// Full-file decode plus inspectable frame evidence; never claims visual approval.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
const root=path.resolve(process.argv[2]||'artifacts/research/2026-11-09/motion-first-r6');
const video=path.join(root,'carla-motion.mp4');
const decoder='/tmp/mv-video-research/ffmpeg';
const check=spawnSync(decoder,['-v','error','-i',video,'-f','null','-'],{encoding:'utf8',timeout:60000});
if(check.error||check.status!==0)throw new Error('Full MP4 decode failed: '+(check.error?.message||check.stderr));
const frameDir=path.join(root,'decoded');await mkdir(frameDir,{recursive:true});
const extract=spawnSync(decoder,['-v','error','-i',video,path.join(frameDir,'%03d.png')],{encoding:'utf8',timeout:60000});
if(extract.error||extract.status!==0)throw new Error('Frame extraction failed');
const frames=(await readdir(frameDir)).filter(n=>n.endsWith('.png')).sort();
if(frames.length!==16)throw new Error('Expected 16 encoded frames, got '+frames.length);
const samples=[];let previous;let sum=0;
for(const [index,name] of frames.entries()){
 const file=path.join(frameDir,name);
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==384||info.height!==640)throw new Error('Unexpected dimensions');
 if(previous){let d=0;for(let i=0;i<data.length;i++)d+=Math.abs(data[i]-previous[i]);sum+=d/data.length;}
 previous=data;
 if([0,4,8,12,15].includes(index))samples.push({input:await sharp(file).resize(230,384).png().toBuffer(),left:samples.length*230,top:0});
}
await sharp({create:{width:230*5,height:384,channels:3,background:'#ffffff'}}).composite(samples).png().toFile(path.join(root,'contact-sheet.png'));
const bytes=await readFile(video);
const report={fullDecode:true,frames:frames.length,width:384,height:640,fps:8,durationSeconds:frames.length/8,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),meanAdjacentFrameRgbDifference:sum/(frames.length-1),visualApproval:false,note:'Pixel difference does not establish identity, natural motion or garment fidelity.'};
await writeFile(path.join(root,'local-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
