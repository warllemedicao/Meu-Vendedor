"""Research-only StableAnimator adapter: real diffusion, controlled pose sequence.

Uses synthetic Carla reference, not a real person's biometric identity. The
Antelope/SVD dependencies are not approved here for commercial deployment.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import os
import subprocess
import sys

ROOT = Path('/kaggle/working/mv-research')
repo = ROOT / 'stable'
os.chdir(repo)
sys.path.insert(0, str(repo))
sys.path.insert(0, str(repo / 'DWPose'))

from huggingface_hub import hf_hub_download
MODEL = 'FrancisRing/StableAnimator'
REV = '172658c01f49905d09f33c8872cc701e3f6d9ec5'
base_files = ['feature_extractor/preprocessor_config.json', 'image_encoder/config.json', 'image_encoder/model.fp16.safetensors', 'scheduler/scheduler_config.json', 'unet/config.json', 'unet/diffusion_pytorch_model.fp16.safetensors', 'vae/config.json', 'vae/diffusion_pytorch_model.fp16.safetensors', 'model_index.json']
files = ['Animation/pose_net.pth', 'Animation/face_encoder.pth', 'Animation/unet.pth', 'DWPose/yolox_l.onnx', 'DWPose/dw-ll_ucoco_384.onnx']
files += ['models/antelopev2/' + f for f in ['1k3d68.onnx','2d106det.onnx','genderage.onnx','glintr100.onnx','scrfd_10g_bnkps.onnx']]
files += ['stable-video-diffusion-img2vid-xt/' + f for f in base_files]
for name in files:
    target = repo / ('checkpoints/' + name if name.startswith(('DWPose/', 'Animation/')) else name)
    target.parent.mkdir(parents=True, exist_ok=True)
    cached = hf_hub_download(MODEL, name, revision=REV)
    if not target.exists():
        target.symlink_to(cached)
    print('downloaded', name, flush=True)

# Avoid unrelated face restoration/parser downloads. No zero-embedding fallback:
# a failed face detector must fail the experiment, not silently change identity.
(repo / 'animation/modules/face_model.py').write_text('''from torch import nn
from insightface.app import FaceAnalysis
class FaceModel(nn.Module):
 def __init__(self):
  super().__init__()
  self.app=FaceAnalysis(name='antelopev2',root='.',providers=['CPUExecutionProvider'])
  self.app.prepare(ctx_id=-1,det_size=(640,640))
  class Helper:
   def clean_all(self): pass
   def read_image(self,*args): raise RuntimeError('reference_face_not_detected')
  self.face_helper=Helper()
''')
wholebody = repo / 'DWPose/dwpose_utils/wholebody.py'
wholebody.write_text(wholebody.read_text().replace("device = 'cuda:0'", "device = 'cpu'"))

import cv2
import numpy as np
from PIL import Image, ImageOps
from dwpose_utils.dwpose_detector import dwpose_detector_aligned
from skeleton_extraction import draw_pose

width, height, count = 384, 640, 16
source = ROOT / 'carla.webp'
expected = 'acf2757d16f9f3c724dc731250a83390eeab2901c2884455ecbf94ed0dbb40f9'
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise RuntimeError('reference_sha256_mismatch')
image = ImageOps.pad(Image.open(source).convert('RGB'), (width, height), color=(230,230,230))
image.save(ROOT / 'reference.png')
pose = dwpose_detector_aligned(np.array(image)[:,:,::-1])
if len(pose['bodies']['subset']) != 1:
    raise RuntimeError('expected_one_person')
poses = ROOT / 'poses'
poses.mkdir(exist_ok=True)
for i in range(count):
    p = copy.deepcopy(pose)
    amount = math.sin(i / (count-1) * math.pi)
    # Controlled shoulder/forearm gesture; no invented walking or invisible legs.
    body = p['bodies']['candidate']
    body[:8,0] += .012 * amount
    body[3,0] -= .025 * amount
    body[4,0] -= .055 * amount
    body[4,1] -= .045 * amount
    body[6,0] += .018 * amount
    body[7,0] += .035 * amount
    for hand_idx, dx, dy in [(0,-.055,-.045),(1,.035,0)]:
        p['hands'][hand_idx,:,0] += dx * amount
        p['hands'][hand_idx,:,1] += dy * amount
    p['faces'][:,:,0] += .012 * amount
    # Official draw_pose returns CHW, whereas Pillow requires HWC.
    canvas = draw_pose(p, height, width, ref_w=width).transpose(1,2,0)
    if canvas.shape != (height,width,3):
        raise RuntimeError('pose_layout_invalid')
    Image.fromarray(canvas).save(poses / f'frame_{i}.png')

# Keep official attention implementations and use their xFormers path on T4.
script = repo / 'inference_basic.py'
text = script.read_text()
text = text.replace('subfolder="image_encoder", revision=args.revision', 'subfolder="image_encoder", revision=args.revision, variant="fp16", torch_dtype=torch.float16')
text = text.replace('subfolder="vae", revision=args.revision', 'subfolder="vae", revision=args.revision, variant="fp16", torch_dtype=torch.float16')
text = text.replace('low_cpu_mem_usage=True,', 'low_cpu_mem_usage=True, variant="fp16", torch_dtype=torch.float16,')
text = text.replace('map_location="cpu")', 'map_location="cpu", weights_only=True)')
# Record actual peak of this process, not the separate supervisor.
text = text.replace('video_frames = pipeline(', 'torch.cuda.reset_peak_memory_stats()\n    video_frames = pipeline(')
text += '\n' + "open('/kaggle/working/mv-research/stable_metrics.json','w').write(__import__('json').dumps({'peak_gpu_bytes':torch.cuda.max_memory_allocated(),'width':args.width,'height':args.height,'frames':num_frames,'fps':8}))\n"
script.write_text(text)
args = [sys.executable, str(script), '--pretrained_model_name_or_path', str(repo / 'stable-video-diffusion-img2vid-xt'), '--validation_image', str(ROOT / 'reference.png'), '--validation_control_folder', str(poses), '--output_dir', str(ROOT / 'stable_output'), '--height', str(height), '--width', str(width), '--posenet_model_name_or_path', str(repo / 'checkpoints/Animation/pose_net.pth'), '--face_encoder_model_name_or_path', str(repo / 'checkpoints/Animation/face_encoder.pth'), '--unet_model_name_or_path', str(repo / 'checkpoints/Animation/unet.pth'), '--tile_size', '16', '--frames_overlap', '4', '--decode_chunk_size', '2', '--num_inference_steps', '25']
subprocess.run(args, check=True, timeout=1400)
import imageio_ffmpeg
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-framerate', '8', '-i', str(ROOT / 'stable_output/animated_images/frame_%d.png'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', str(ROOT / 'carla-motion.mp4')], check=True, timeout=60)
print('STABLE_COMPLETE', flush=True)
