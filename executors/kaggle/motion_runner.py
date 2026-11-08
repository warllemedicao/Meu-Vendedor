"""Bounded private GPU executor. HYBRID_CONFIG and graph() injected by coordinator.
No administrative keys. No tunnel, browser server or API-credit provider.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import urllib.error
import re
import traceback

ROOT = Path('/kaggle/working/mv-motion')
COMFY_REVISION = '0decb39ee5b5e17c200334589fc317dbbe98310e'
FASHN_REVISION = '7c0f10af3f91ad4048fe9729c470a13ef905d25a'
REPOS = {
    'wan': ('kijai/ComfyUI-WanVideoWrapper', '088128b224242e110d3906c6750e9a3a348a659b'),
    'gguf': ('city96/ComfyUI-GGUF', '6ea2651e7df66d7585f6ffee804b20e92fb38b8a'),
    'pose': ('Fannovel16/comfyui_controlnet_aux', 'a587a4c1594524c1d2de5cd1a86cd868ff448e1c'),
}
BASE = ('Comfy-Org/Wan_2.1_ComfyUI_repackaged', '123acf1cc74bccbb9bfff8ac1ee72edc08c2341d')


class Cancelled(Exception):
    pass


def include_requirement(line):
    package = re.split(r'[<>=!~\[ ;]', line.strip(), maxsplit=1)[0].lower().replace('-', '_')
    return bool(line.strip()) and not line.startswith(('#', '-')) and package not in ['torch', 'torchaudio', 'torchvision', 'xformers', 'flash_attn', 'triton']


def sampling_progress(log):
    matches = re.findall(r'\b(\d{1,3})%[^\r\n]*?\b(\d{1,3})/(\d{1,3})\b', log)
    if not matches:
        return {}
    _, step, total = map(int, matches[-1])
    return {'steps_completed': step, 'steps_total': total} if 0 <= step <= total <= 100 else {}


def main(cfg):
    ROOT.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    report = {'adapter': cfg['engine'], 'native_4k': False}
    process = None

    def callback(state='running', **fields):
        report.update(fields)
        data = json.dumps({'action': 'callback', 'id': cfg['id'], 'state': state, 'report': report}).encode()
        req = urllib.request.Request(cfg['callback'], data=data, headers={'Content-Type': 'application/json', 'x-job-token': cfg['gate']})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=25) as response:
                    accepted = json.loads(response.read(4096))
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        (ROOT / 'report.json').write_text(json.dumps({'state': state, **report}))
        if accepted.get('cancel'):
            raise Cancelled('cancelled_by_owner')

    def run(args, timeout=600):
        # Never log command arguments: downloads may carry short-lived capabilities.
        log_path = ROOT / 'runtime.log'
        try:
            with log_path.open('ab') as log:
                subprocess.run(args, check=True, timeout=timeout, stdout=log, stderr=log)
        except subprocess.CalledProcessError as exc:
            detail = re.sub(r'https?://[^\s]+', '[url]', log_path.read_text(errors='replace')[-2000:])
            raise RuntimeError(f'subprocess_exit_{exc.returncode}: {detail}') from None

    def clone(repo, revision, target):
        if not target.exists():
            run(['git', 'clone', '--quiet', 'https://github.com/' + repo + '.git', str(target)], 180)
        run(['git', '-C', str(target), 'checkout', '--quiet', revision], 60)

    def download(url, target, limit):
        total = 0
        with urllib.request.urlopen(url, timeout=90) as source, target.open('wb') as out:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise ValueError('input_too_large')
                out.write(chunk)
        if not total:
            raise ValueError('input_empty')

    def model(repo, revision, name, target):
        callback(phase='models')
        from huggingface_hub import hf_hub_download
        target.parent.mkdir(parents=True, exist_ok=True)
        local = Path(hf_hub_download(repo, name, revision=revision))
        if not target.exists():
            target.symlink_to(local)
        callback(phase='models')

    try:
        callback(phase='dependencies')
        run([sys.executable, '-m', 'pip', 'install', '--quiet', 'huggingface-hub==0.34.4', 'imageio-ffmpeg==0.6.0', 'safetensors==0.6.2', 'einops==0.8.1', 'onnxruntime==1.23.2', 'opencv-python-headless==4.12.0.88', 'Pillow==11.3.0'], 600)
        import torch
        import numpy as np
        import imageio_ffmpeg
        from PIL import Image, ImageOps
        if not torch.cuda.is_available():
            raise ValueError('cuda_unavailable')
        torch.set_num_threads(2)
        torch.manual_seed(cfg['seed'])
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        download(cfg['reference'], ROOT / 'reference', 10 * 1024 * 1024)
        if hashlib.sha256((ROOT / 'reference').read_bytes()).hexdigest() != cfg['reviewedReferenceSha256']:
            raise ValueError('input_review_required')
        download(cfg['product'], ROOT / 'product', 10 * 1024 * 1024)
        if hashlib.sha256((ROOT / 'product').read_bytes()).hexdigest() != cfg['reviewedProductSha256']:
            raise ValueError('input_review_required')
        image = Image.open(ROOT / 'reference').convert('RGB')
        if max(image.size) > 4096:
            raise ValueError('image_dimensions_invalid')
        callback(phase='models')
        if cfg['engine'] == 'fashn':
            # Use Apache-2.0 TryOnModel directly. Never import pipeline/preprocessing
            # packages, install fashn-human-parser, or download SegFormer weights.
            repo = ROOT / 'fashn'
            clone('fashn-AI/fashn-vton-1.5', FASHN_REVISION, repo)
            (repo / 'src/fashn_vton/__init__.py').write_text('')
            sys.path.insert(0, str(repo / 'src'))
            from fashn_vton.tryon_mmdit import TryOnModel
            from fashn_vton.dwpose import DWposeDetector, draw_pose
            from fashn_vton.utils import get_dummy_dw_keypoints, get_rf_schedule, load_checkpoint
            weights = ROOT / 'fashn-weights'
            model('fashn-ai/fashn-vton-1.5', '7720683168567eb5a2a4c67f15116c6e29c83ded', 'model.safetensors', weights / 'model.safetensors')
            for name in ['yolox_l.onnx', 'dw-ll_ucoco_384.onnx']:
                model('yzd-v/DWPose', '1a7144101628d69ee7a3768d1ee3a094070dc388', name, weights / 'dwpose' / name)
            garment = Image.open(ROOT / 'product').convert('RGB')
            pose_model = DWposeDetector(checkpoints_dir=str(weights / 'dwpose'), device='cpu')
            person_array = np.array(image)
            pose = pose_model(person_array[..., ::-1])
            pose_image = Image.fromarray(draw_pose(pose, image.height, image.width, grayscale=True))
            dummy = get_dummy_dw_keypoints()
            garment_pose = Image.fromarray(draw_pose(dummy, garment.height, garment.width, grayscale=True))
            net = TryOnModel()
            net.load_state_dict(load_checkpoint(str(weights / 'model.safetensors'), device='cpu'))
            # T4 uses FP32 for this model, matching upstream's non-Ampere path.
            net.to('cuda', dtype=torch.float32).eval()
            h, w = net.input_shape

            def tensor(im):
                padded = ImageOps.pad(im, (w, h), method=Image.Resampling.LANCZOS, color=0 if im.mode == 'L' else (0, 0, 0))
                a = np.array(padded, dtype=np.float32) / 127.5 - 1
                if a.ndim == 2:
                    a = a[..., None]
                return torch.from_numpy(a).permute(2, 0, 1).unsqueeze(0).to('cuda')

            kwargs = {'ca_images': tensor(image), 'garment_images': tensor(garment), 'person_poses': tensor(pose_image), 'garment_poses': tensor(garment_pose), 'garment_categories': torch.tensor([{'tops': 1, 'bottoms': 2, 'one-pieces': 3}[cfg['category']]], device='cuda')}
            samples = torch.randn((1, net.channels_in, h, w), device='cuda')
            schedule = get_rf_schedule(num_steps=30, mu=1.5)
            inference_start = time.monotonic()
            callback(phase='tryon', setup_seconds=round(inference_start - started, 3))
            with torch.inference_mode():
                for step, (current, following) in enumerate(zip(schedule[:-1], schedule[1:])):
                    t = torch.full((1,), current, device='cuda')
                    prediction = net.forward_for_cfg(samples, t, **kwargs)['v_c'] if step == 29 else net.forward_for_cfg(samples, t, **kwargs)
                    velocity = prediction if step == 29 else prediction['v_u'] + 1.5 * (prediction['v_c'] - prediction['v_u'])
                    samples = samples + (following - current) * velocity
                    if step % 5 == 0:
                        callback(phase='tryon', steps_completed=step + 1, steps_total=30)
            array = ((samples[0].clamp(-1, 1).permute(1, 2, 0).cpu().numpy() + 1) * 127.5).round().astype(np.uint8)
            final = ROOT / 'final.png'
            fitted = ImageOps.contain(image, (w, h))
            left, top = (w - fitted.width) // 2, (h - fitted.height) // 2
            output_image = Image.fromarray(array).crop((left, top, left + fitted.width, top + fitted.height))
            output_image.save(final)
            report.update(width=output_image.width, height=output_image.height, inference_seconds=round(time.monotonic() - inference_start, 3), peak_gpu_bytes=torch.cuda.max_memory_allocated())
        else:
            seconds, fps, width, height = cfg['seconds'], 16, 288, 512
            count = seconds * fps + 1
            download(cfg['driver'], ROOT / 'driver', 40 * 1024 * 1024)
            # A bounded ffmpeg decode prevents untrusted media allocating arbitrary frames.
            def frames(path, mask=False):
                target = ROOT / ('mask.rgb' if mask else 'driver.rgb')
                scale = 'neighbor' if mask else 'lanczos'
                run([ffmpeg, '-y', '-i', str(path), '-an', '-vf', f'fps={fps},scale={width}:{height}:flags={scale}', '-frames:v', str(count), '-f', 'rawvideo', '-pix_fmt', 'rgb24', str(target)], 90)
                raw = target.read_bytes()
                actual = len(raw) // (width * height * 3)
                if actual < seconds * fps:
                    raise ValueError('driver_too_short')
                data = np.frombuffer(raw, np.uint8).reshape(actual, height, width, 3)
                if actual < count:
                    data = np.concatenate([data, data[-1:]], axis=0)
                return data[:count]

            driver = frames(ROOT / 'driver')
            ref = np.array(ImageOps.pad(image, (width, height), color='black'))[None]
            inputs = {'reference': ref, 'driver': driver}
            if cfg.get('mask'):
                download(cfg['mask'], ROOT / 'mask', 40 * 1024 * 1024)
                inputs['mask'] = frames(ROOT / 'mask', mask=True)
            np.savez(ROOT / 'inputs.npz', **inputs)
            repo = ROOT / 'ComfyUI'
            clone('Comfy-Org/ComfyUI', COMFY_REVISION, repo)
            # Install runtime dependencies, preserving Kaggle's CUDA-matched torch stack.
            for key in (['wan', 'pose'] if cfg['engine'] == 'wan-animate' else ['gguf'] if cfg['engine'] == 'scail' else []):
                source, revision = REPOS[key]
                target = repo / 'custom_nodes' / key
                clone(source, revision, target)
            requirement_files = [repo / 'requirements.txt'] + [p / 'requirements.txt' for p in (repo / 'custom_nodes').iterdir() if p.is_dir() and (p / 'requirements.txt').exists()]
            requirements = []
            for path in requirement_files:
                for line in path.read_text().splitlines():
                    if include_requirement(line):
                        requirements.append(line)
            (ROOT / 'requirements.txt').write_text('\n'.join(requirements))
            run([sys.executable, '-m', 'pip', 'install', '--quiet', '-r', str(ROOT / 'requirements.txt')], 600)
            models = repo / 'models'
            for source, name in [('text_encoders', 'umt5_xxl_fp16.safetensors'), ('vae', 'wan_2.1_vae.safetensors')]:
                model(*BASE, f'split_files/{source}/{name}', models / source / name)
            if cfg['engine'] == 'wan-animate':
                model('QuantStack/Wan2.2-Animate-14B-GGUF', '33c51bb84d4e70ffc0d088aeb6068d40d9446fa3', 'Wan2.2-Animate-14B-Q3_K_M.gguf', models / 'diffusion_models/Wan2.2-Animate-14B-Q3_K_M.gguf')
            elif cfg['engine'] == 'scail':
                model('realrebelai/SCAIL-2_GGUF', '16e572157fbc2ffa76782dd5134a9262dc1a40cf', 'SCAIL-2-Q3_K_M.gguf', models / 'unet/SCAIL-2-Q3_K_M.gguf')
                model('Comfy-Org/sam3.1', '7bb8374780a725b4353ed31f3a9395c9742b5621', 'checkpoints/sam3.1_multiplex_fp16.safetensors', models / 'checkpoints/sam3.1_multiplex_fp16.safetensors')
            else:
                model(*BASE, 'split_files/diffusion_models/wan2.1_vace_1.3B_fp16.safetensors', models / 'diffusion_models/wan2.1_vace_1.3B_fp16.safetensors')
            if cfg['engine'] in ('scail', 'wan-animate'):
                model(*BASE, 'split_files/clip_vision/clip_vision_h.safetensors', models / 'clip_vision/clip_vision_h.safetensors')
            # Only loopback is exposed; the notebook is never an internet service.
            custom = repo / 'custom_nodes/mv_input.py'
            custom.write_text("import numpy as np\nimport torch\nclass MVInput:\n @classmethod\n def INPUT_TYPES(cls): return {'required':{'kind':(['reference','driver','mask'],)}}\n RETURN_TYPES=('IMAGE','MASK')\n FUNCTION='load'\n CATEGORY='mv'\n def load(self,kind):\n  with np.load('/kaggle/working/mv-motion/inputs.npz',allow_pickle=False) as data: a=data[kind].copy()\n  t=torch.from_numpy(a).float()/255\n  return t,t.mean(dim=-1)\nNODE_CLASS_MAPPINGS={'MVInput':MVInput}\n")
            env = dict(os.environ, PYTORCH_CUDA_ALLOC_CONF='expandable_segments:True')
            log = (ROOT / 'comfy.log').open('wb')
            process = subprocess.Popen([sys.executable, 'main.py', '--listen', '127.0.0.1', '--port', '8188', '--lowvram', '--cache-none', '--force-fp16', '--use-pytorch-cross-attention', '--disable-auto-launch'], cwd=repo, env=env, stdout=log, stderr=log)

            def request(path, data=None):
                encoded = json.dumps(data).encode() if data is not None else None
                req = urllib.request.Request('http://127.0.0.1:8188/' + path, data=encoded, headers={'Content-Type': 'application/json'})
                try:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        return json.loads(response.read(10 * 1024 * 1024))
                except urllib.error.HTTPError as exc:
                    # Local Comfy validation explains which fixed node contract failed.
                    detail = exc.read(2000).decode(errors='replace')
                    raise RuntimeError(f'comfy_http_{exc.code}: {detail}') from None

            for _ in range(90):
                if process.poll() is not None:
                    raise ValueError('runtime_start_failed')
                try:
                    nodes = request('object_info')
                    break
                except urllib.error.URLError:
                    time.sleep(2)
            else:
                raise ValueError('runtime_start_timeout')
            prompt = graph(cfg['engine'], cfg['prompt'], seconds, cfg['seed'], cfg['mode'])
            for n in prompt.values():
                if n['class_type'] not in nodes:
                    raise ValueError('node_unavailable_' + n['class_type'])
                # New required inputs can have a documented default. No arbitrary graph fallback.
                for key, spec in nodes[n['class_type']]['input'].get('required', {}).items():
                    if key not in n['inputs'] and len(spec) > 1 and isinstance(spec[1], dict) and 'default' in spec[1]:
                        n['inputs'][key] = spec[1]['default']
            inference_start = time.monotonic()
            callback(phase='inference', setup_seconds=round(inference_start - started, 3))
            queued = request('prompt', {'prompt': prompt, 'client_id': cfg['id']})
            if queued.get('node_errors') or not queued.get('prompt_id'):
                raise ValueError('workflow_validation_failed')
            prompt_id = queued['prompt_id']
            deadline = started + 3300
            while time.monotonic() < deadline:
                with (ROOT / 'comfy.log').open('rb') as progress_log:
                    progress_log.seek(max(0, progress_log.seek(0, 2) - 6000))
                    progress = sampling_progress(progress_log.read().decode(errors='replace'))
                callback(phase='inference', **progress)
                history = request('history/' + prompt_id).get(prompt_id, {})
                status = history.get('status', {})
                if status.get('status_str') == 'error':
                    raise ValueError('inference_failed')
                if status.get('completed'):
                    break
                if process.poll() is not None:
                    raise ValueError('runtime_exited')
                time.sleep(10)
            else:
                raise ValueError('inference_timeout')
            output = repo / 'output'
            files = sorted(output.glob('motion_*.png'))
            if len(files) < seconds * fps:
                raise ValueError('output_incomplete')
            # Only files reported by this fresh private runtime are used.
            final = ROOT / 'final.mp4'
            if cfg['engine'] == 'vace':
                # Preserve every pixel outside the supplied edit mask after diffusion.
                mask = inputs['mask'].astype(np.float32).mean(axis=-1, keepdims=True) / 255
                for i, path in enumerate(files[:seconds * fps]):
                    generated = np.array(Image.open(path).convert('RGB'))
                    composite = generated * mask[i] + driver[i] * (1 - mask[i])
                    Image.fromarray(composite.round().astype(np.uint8)).save(path)
            run([ffmpeg, '-y', '-framerate', str(fps), '-pattern_type', 'glob', '-i', str(output / 'motion_*.png'), '-t', str(seconds), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(final)], 120)
            report.update(width=width, height=height, fps=fps, frames=seconds * fps, duration_seconds=seconds, inference_seconds=round(time.monotonic() - inference_start, 3))
        callback(phase='upload')
        data = final.read_bytes()
        if len(data) < 1000 or len(data) > 80 * 1024 * 1024:
            raise ValueError('output_size_invalid')
        req = urllib.request.Request(cfg['upload'], data=data, method='PUT', headers={'Content-Type': 'image/png' if cfg['engine'] == 'fashn' else 'video/mp4', 'x-upsert': 'false'})
        with urllib.request.urlopen(req, timeout=120) as response:
            response.read(4096)
        callback('completed', phase='complete', bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), total_seconds=round(time.monotonic() - started, 3))
    except Cancelled:
        pass
    except Exception as exc:
        # No raw subprocess traceback or signed URLs in callbacks.
        code = str(exc) if isinstance(exc, ValueError) and len(str(exc)) < 100 else 'executor_failed'
        if 'out of memory' in str(exc).lower():
            code = 'gpu_memory_exhausted'
        detail = traceback.format_exc()
        if process:
            detail += f'\ncomfy_exit_code={process.poll()}'
            for memory_file in ['/sys/fs/cgroup/memory.events', '/sys/fs/cgroup/memory/memory.failcnt']:
                try:
                    detail += '\nmemory_events=' + Path(memory_file).read_text()[:180]
                except OSError:
                    pass
        if process and (ROOT / 'comfy.log').exists():
            detail += '\n' + (ROOT / 'comfy.log').read_text(errors='replace')[-1700:]
        try:
            callback('failed', phase='failed', error_type=type(exc).__name__, failure_code=code, error_detail=re.sub(r'https?://[^\s]+', '[url]', detail)[-2500:], total_seconds=round(time.monotonic() - started, 3))
        except Exception:
            pass
        raise RuntimeError(code) from None
    finally:
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == '__main__':
    main(HYBRID_CONFIG)
