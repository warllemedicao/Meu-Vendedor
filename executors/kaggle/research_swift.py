"""Research-only video try-on on real generated motion and exact ad pixels.

Never a production adapter: model-weight licensing remains unconfirmed. Source
archive must come from a completed, inspected motion experiment; no static-video
fallback is permitted.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
import time

ROOT = Path('/kaggle/working/mv-research')
repo = ROOT/'swift'
os.chdir(repo)
sys.path.insert(0,str(repo))
from huggingface_hub import HfApi, hf_hub_download
from omegaconf import OmegaConf
import cv2
import numpy as np
import torch
from PIL import Image
import imageio_ffmpeg

base = ROOT/'swift-models'
pins = {}
def download(model, filenames, directory, revision=None):
    revision = revision or HfApi().model_info(model).sha
    pins[model] = revision
    directory.mkdir(parents=True,exist_ok=True)
    for filename in filenames:
        src = hf_hub_download(model, filename, revision=revision)
        target = directory/filename
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():target.symlink_to(src)
        print('downloaded',model,filename,flush=True)

download('NMHung/SwiftTry',['denoising_unet.pth','reference_unet.pth','pose_guider.pth','motion_module.pth'],base/'swift','db30bc98a65851b532b6efde41a2b25761709e40')
download('stable-diffusion-v1-5/stable-diffusion-inpainting',['unet/config.json','unet/diffusion_pytorch_model.bin'],base/'inpaint')
download('stable-diffusion-v1-5/stable-diffusion-v1-5',['unet/config.json','unet/diffusion_pytorch_model.bin'],base/'reference')
download('stabilityai/sd-vae-ft-mse',['config.json','diffusion_pytorch_model.bin'],base/'vae')
download('lambdalabs/sd-image-variations-diffusers',['image_encoder/config.json','image_encoder/pytorch_model.bin'],base/'clip')
(ROOT/'swift-model-pins.json').write_text(json.dumps(pins,indent=2))

frames = sorted((ROOT/'source/stable_output/animated_images').glob('frame_*.png'),key=lambda p:int(p.stem.split('_')[-1]))
if len(frames)!=16:raise RuntimeError('requires_16_real_generated_frames')
product=ROOT/'product.png'
if hashlib.sha256(product.read_bytes()).hexdigest()!='9a7d5a590429c156aaee8ed491c920b523091a3d108aa9f0e0e87515b2a6a1f3':
    raise RuntimeError('product_sha256_mismatch')
width,height=384,640
data=ROOT/'swift-inputs'
for name in ['video','masked','mask','pose']:(data/name).mkdir(parents=True,exist_ok=True)
mask_coverage=[]
for i,path in enumerate(frames):
    rgb=np.array(Image.open(path).convert('RGB').resize((width,height)))
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    # Carla's registered green blouse: deterministic mask keeps face/skin intact.
    mask=cv2.inRange(hsv,np.array([32,35,15],np.uint8),np.array([100,255,255],np.uint8))
    mask[:int(height*.36)]=0
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    mask=cv2.dilate(mask,np.ones((5,5),np.uint8))
    coverage=float((mask>0).mean())
    if not .12<coverage<.65:raise RuntimeError('garment_mask_requires_revision')
    mask_coverage.append(coverage)
    masked=rgb.copy();masked[mask>0]=127
    Image.fromarray(rgb).save(data/'video'/f'{i:03d}.png')
    Image.fromarray(masked).save(data/'masked'/f'{i:03d}.png')
    Image.fromarray(mask).convert('RGB').save(data/'mask'/f'{i:03d}.png')
    pose=Image.open(ROOT/f'source/poses/frame_{i}.png').convert('RGB').resize((width,height))
    pose.save(data/'pose'/f'{i:03d}.png')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
for name in ['video','masked','mask','pose']:
    subprocess.run([ffmpeg,'-y','-framerate','8','-i',str(data/name/'%03d.png'),'-c:v','libx264','-crf','12','-pix_fmt','yuv420p',str(data/(name+'.mp4'))],check=True,timeout=60)
config=OmegaConf.load(repo/'configs/prompts/tryon.yaml')
config.update({'pretrained_base_model_path':str(base/'inpaint'),'pretrained_referencenet_model_path':str(base/'reference'),'pretrained_vae_path':str(base/'vae'),'image_encoder_path':str(base/'clip/image_encoder'),'denoising_unet_path':str(base/'swift/denoising_unet.pth'),'reference_unet_path':str(base/'swift/reference_unet.pth'),'pose_guider_path':str(base/'swift/pose_guider.pth'),'motion_module_path':str(base/'swift/motion_module.pth'),'width':width,'height':height})
OmegaConf.save(config,ROOT/'swift-config.yaml')

# Preserve the published model and pipeline; use explicit safe checkpoint loads.
p=repo/'inference.py'
p.write_text(p.read_text().replace('map_location="cpu")','map_location="cpu", weights_only=True)').replace('save_videos_grid(video_full, video_full_out_path, n_rows=3)','save_videos_grid(video_full, video_full_out_path, n_rows=3, fps=8)').replace('save_videos_grid(video, out_path, n_rows=1)','save_videos_grid(video, out_path, n_rows=1, fps=8)'))
from inference import TryOnController
controller=TryOnController(str(ROOT/'swift-config.yaml'),weight_dtype=torch.float16)
torch.cuda.reset_peak_memory_stats()
started=time.monotonic()
result=controller.tryon_video(str(product),str(data/'video.mp4'),str(data/'masked.mp4'),str(data/'mask.mp4'),str(data/'pose.mp4'),clip_length=16,num_inference_steps=25,cfg=3.5,seed=42,repaint=True,save_dir=str(ROOT/'swift-output'))
(ROOT/'swift-metrics.json').write_text(json.dumps({'engine':'SwiftTry','inference_seconds':round(time.monotonic()-started,3),'peak_gpu_bytes':torch.cuda.max_memory_allocated(),'width':width,'height':height,'frames':16,'input_fps':8,'product_sha256':hashlib.sha256(product.read_bytes()).hexdigest(),'mask_coverage':mask_coverage,'result':str(Path(result).relative_to(ROOT))},indent=2))
print('SWIFT_COMPLETE',flush=True)
