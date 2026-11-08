"""Bounded MuseTalk adapter for curated static crops. HYBRID_CONFIG supplied by Edge.
No API/admin keys; only short-lived input/output URLs and a per-job callback capability.
"""
import json, os, subprocess, sys, time, urllib.request, hashlib
from pathlib import Path

cfg = HYBRID_CONFIG
started = time.monotonic()
work = Path('/kaggle/working/hybrid')
work.mkdir(parents=True, exist_ok=True)
report_data = {'adapter': 'musetalk-v15-mouth-aligned', 'native_4k': False}

class Cancelled(Exception): pass

def callback(state, **fields):
    report_data.update(fields)
    payload = json.dumps({'action': 'callback', 'id': cfg['id'], 'state': state, 'report': report_data}).encode()
    req = urllib.request.Request(cfg['callback'], data=payload, headers={'content-type':'application/json', 'x-job-token':cfg['gate']})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                accepted=json.loads(response.read(4096))
            break
        except Exception:
            if attempt==2: raise
            time.sleep(2**attempt)
    if accepted.get('cancel'): raise Cancelled('cancelled_by_owner')
    (work/'report.json').write_text(json.dumps({'state':state, **report_data}))

def run(args, timeout=600):
    with (work/'runtime.log').open('ab') as log:
        subprocess.run(args, stdout=log, stderr=log, check=True, timeout=timeout)

def download(url, target, limit):
    with urllib.request.urlopen(url, timeout=120) as src, open(target,'wb') as dst:
        count = 0
        while True:
            block = src.read(1024*1024)
            if not block: break
            count += len(block)
            if count > limit: raise ValueError('input_too_large')
            dst.write(block)

try:
    callback('running', phase='setup')
    # Host CUDA/PyTorch stays intact; install only the inference dependencies.
    run([sys.executable,'-m','pip','install','--quiet','diffusers==0.30.2','transformers==4.57.6','accelerate==0.34.2','huggingface_hub==0.34.4','einops==0.8.1','librosa==0.11.0','soundfile==0.13.1','imageio-ffmpeg==0.6.0','gdown==5.2.0'], 600)
    repo = work/'MuseTalk'
    if not repo.exists():
        run(['git','clone','--quiet','https://github.com/TMElyralab/MuseTalk.git',str(repo)],120)
    run(['git','-C',str(repo),'checkout','--quiet','0a89dec45a0192b824e3cf4daf96c239440c5ed8'],60)
    os.chdir(repo)
    sys.path.insert(0,str(repo))
    import torch, cv2, numpy as np, imageio_ffmpeg
    from huggingface_hub import snapshot_download
    from transformers import WhisperModel
    from musetalk.models.vae import VAE
    from musetalk.models.unet import UNet, PositionalEncoding
    from musetalk.utils.audio_processor import AudioProcessor
    from PIL import Image
    from musetalk.utils.face_parsing import FaceParsing
    from musetalk.utils.blending import get_image_prepare_material, get_image_blending
    assert torch.cuda.is_available(), 'cuda_unavailable'
    torch.set_num_threads(2)
    torch.manual_seed(42)
    device='cuda:0'
    snapshot_download('TMElyralab/MuseTalk',revision='2bcb936e2fddb4d86db4c62fd45b387d0c061571',local_dir='models',allow_patterns=['musetalkV15/*'])
    snapshot_download('stabilityai/sd-vae-ft-mse',revision='31f26fdeee1355a5c34592e401dd41e45d25a493',local_dir='models/sd-vae',allow_patterns=['config.json','diffusion_pytorch_model.bin'])
    snapshot_download('openai/whisper-tiny',revision='169d4a4341b33bc18d8881c4b69c2e104e1cc0af',local_dir='models/whisper',allow_patterns=['config.json','pytorch_model.bin','preprocessor_config.json'])
    parse_dir=Path('models/face-parse-bisent')
    parse_dir.mkdir(parents=True,exist_ok=True)
    if not (parse_dir/'79999_iter.pth').exists():
        run([sys.executable,'-m','gdown','154JgKpzCPW82qINcVieuPH3fZ2e0P812','-O',str(parse_dir/'79999_iter.pth')],180)
    if not (parse_dir/'resnet18-5c106cde.pth').exists():
        # Same ResNet18 architecture, modern weights-only checkpoint (legacy tar is rejected by PyTorch >=2.6).
        download('https://download.pytorch.org/models/resnet18-f37072fd.pth',parse_dir/'resnet18-5c106cde.pth',60*1024*1024)
    if not hashlib.sha256((parse_dir/'resnet18-5c106cde.pth').read_bytes()).hexdigest().startswith('f37072fd'):
        raise ValueError('resnet_weights_checksum_mismatch')
    download(cfg['visual'],work/'input',40*1024*1024)
    download(cfg['audio'],work/'audio.mp3',12*1024*1024)
    product=None
    if cfg.get('product'):
        download(cfg['product'],work/'product',10*1024*1024)
        product=cv2.imread(str(work/'product'))
        if product is None: raise ValueError('product_decode_failed')
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    run([ffmpeg,'-y','-i',str(work/'audio.mp3'),'-ar','16000','-ac','1',str(work/'audio.wav')],60)
    import soundfile as sf
    samples,sr=sf.read(work/'audio.wav')
    duration=len(samples)/sr
    if not 0.2 <= duration <= 15: raise ValueError('audio_duration_out_of_range')
    fps=25
    frames=[]
    if cfg['kind']=='image':
        frames=[cv2.imread(str(work/'input'))]
    else:
        cap=cv2.VideoCapture(str(work/'input'))
        while len(frames)<375:
            ok, frame=cap.read()
            if not ok: break
            frames.append(frame)
        cap.release()
    if not frames or any(f is None for f in frames): raise ValueError('visual_decode_failed')
    height,width=frames[0].shape[:2]
    if any(f.shape[:2]!=(height,width) for f in frames): raise ValueError('inconsistent_frame_dimensions')
    if width>1080 or height>1920: raise ValueError('visual_dimensions_out_of_range')
    render_width,render_height=720,1280
    x1,y1,x2,y2=cfg['crop']
    if not (0<=x1<x2<=width and 0<=y1<y2<=height): raise ValueError('crop_out_of_range')
    callback('running',phase='models',setup_seconds=round(time.monotonic()-started,3),duration_seconds=round(duration,3),width=render_width,height=render_height)
    vae=VAE(model_path='models/sd-vae',use_float16=True)
    unet=UNet(unet_config='models/musetalkV15/musetalk.json',model_path='models/musetalkV15/unet.pth',device=device)
    unet.model.to(device=device,dtype=torch.float16).eval()
    pe=PositionalEncoding(d_model=384).to(device=device,dtype=torch.float16)
    processor=AudioProcessor(feature_extractor_path='models/whisper')
    whisper=WhisperModel.from_pretrained('models/whisper').to(device=device,dtype=torch.float16).eval()
    prepared=time.monotonic()
    callback('running',phase='face_parser')
    parser=FaceParsing()
    def mouth_center(face_bgr):
        rgb=Image.fromarray(cv2.cvtColor(face_bgr,cv2.COLOR_BGR2RGB)).resize((512,512))
        tensor=parser.preprocess(rgb).unsqueeze(0).to(device)
        with torch.inference_mode():
            labels=parser.net(tensor)[0].squeeze(0).argmax(0).cpu().numpy()
        ys,xs=np.where(np.isin(labels,[11,12,13]))
        if len(xs)<12: raise ValueError('mouth_landmark_unavailable')
        return ((float(xs.min()+xs.max())/2)/512,(float(ys.min()+ys.max())/2)/512)
    materials=[]
    centers=[]
    for f in frames:
        cx,cy=mouth_center(f[y1:y2,x1:x2])
        centers.append((cx,cy))
        semantic,box=get_image_prepare_material(f,(x1,y1,x2,y2),fp=parser,mode='raw')
        # Restrict semantic replacement to the mouth; preserve original cheeks/nose texture.
        focus=np.zeros_like(semantic)
        cv2.ellipse(focus,(int(x1+cx*(x2-x1)-box[0]),int(y1+cy*(y2-y1)-box[1])),(int(.27*(x2-x1)),int(.15*(y2-y1))),0,0,360,255,-1)
        blur=max(3,int(.04*(x2-x1))//2*2+1)
        focus=cv2.GaussianBlur(focus,(blur,blur),0)
        materials.append(((semantic.astype(np.float32)*focus/255).astype(np.uint8),box))
    # Keep the small parser for one calibration per source frame; avoid duplicate mouths.
    offsets={}
    torch.cuda.empty_cache()
    with torch.inference_mode():
        features,length=processor.get_audio_feature(str(work/'audio.wav'))
        chunks=processor.get_whisper_chunk(features,device,torch.float16,whisper,length,fps=fps)
        del whisper
        torch.cuda.empty_cache()
        # Curated crop is only valid for stationary faces. Store latent cache on CPU.
        latents=[vae.get_latents_for_unet(cv2.resize(f[y1:y2,x1:x2],(256,256))).cpu() for f in frames]
        callback('running',phase='inference',preprocess_seconds=round(time.monotonic()-prepared,3))
        infer_start=time.monotonic()
        process=subprocess.Popen([ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','bgr24','-s',f'{render_width}x{render_height}','-r',str(fps),'-i','-','-an','-vcodec','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(work/'silent.mp4')],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=(work/'encoder.log').open('wb'))
        # Official semantic parser preserves hair, nose, eyes and the background.
        for i in range(len(chunks)):
            idx=i%len(frames)
            pred=unet.model(latents[idx].to(device=device,dtype=torch.float16),torch.tensor([0],device=device),encoder_hidden_states=pe(chunks[i:i+1].to(device=device,dtype=torch.float16))).sample
            face=vae.decode_latents(pred)[0]
            if idx not in offsets:
                gx,gy=mouth_center(face)
                rx,ry=centers[idx]
                offsets[idx]=((rx-gx)*256,(ry-gy)*256)
            dx,dy=offsets[idx]
            face=cv2.warpAffine(face,np.float32([[1,0,dx],[0,1,dy]]),(256,256),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
            replacement=cv2.resize(face,(x2-x1,y2-y1))
            mask,crop_box=materials[idx]
            frame=get_image_blending(frames[idx],replacement,(x1,y1,x2,y2),mask,crop_box)
            scaled=cv2.resize(frame,(render_width,max(1,int(height*render_width/width))))
            canvas=np.full((render_height,render_width,3),245,dtype=np.uint8)
            shown=min(render_height,scaled.shape[0])
            canvas[:shown]=scaled[:shown]
            frame=canvas
            if product is not None:
                panel=max(64,int(render_height*.3))
                scale=min((render_width-32)/product.shape[1],(panel-32)/product.shape[0])
                pw,ph=max(1,int(product.shape[1]*scale)),max(1,int(product.shape[0]*scale))
                thumb=cv2.resize(product,(pw,ph),interpolation=cv2.INTER_AREA)
                frame[render_height-panel:]=245
                px,py=(render_width-pw)//2,render_height-panel+(panel-ph)//2
                frame[py:py+ph,px:px+pw]=thumb
            process.stdin.write(frame.tobytes())
            if i and i%50==0: callback('running',phase='inference',frames=i)
        process.stdin.close()
        if process.wait(timeout=120)!=0: raise ValueError('encoding_failed')
    inference_seconds=round(time.monotonic()-infer_start,3)
    run([ffmpeg,'-y','-i',str(work/'silent.mp4'),'-i',str(work/'audio.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',str(work/'final.mp4')],120)
    result=work/'final.mp4'
    payload=result.read_bytes()
    req=urllib.request.Request(cfg['upload'],data=payload,method='PUT',headers={'content-type':'video/mp4'})
    with urllib.request.urlopen(req,timeout=120) as response: response.read(4096)
    callback('completed',phase='complete',inference_seconds=inference_seconds,total_seconds=round(time.monotonic()-started,3),frames=len(chunks),fps=fps,bytes=len(payload),sha256=hashlib.sha256(payload).hexdigest(),peak_gpu_bytes=torch.cuda.max_memory_allocated(),gpu=torch.cuda.get_device_name(0))
except Cancelled:
    (work/'report.json').write_text(json.dumps({'state':'cancelled'}))
except Exception as exc:
    # Error details stay private; never send credentials/URLs or raw subprocess output.
    try:
        import re
        details=str(exc)+'\n'+((work/'runtime.log').read_text(errors='replace')[-1800:] if (work/'runtime.log').exists() else '')
        details=re.sub(r'https?://[^\s]+','[url]',details)
        callback('failed',phase='failed',error_type=type(exc).__name__,error_detail=details,total_seconds=round(time.monotonic()-started,3))
    except Exception: pass
    raise
