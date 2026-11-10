"""Bounded experimental notebook supervisor; injected RESEARCH_CONFIG only.

Uploads a private archive even on failure. Never prints URLs or credentials.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import zipfile
import shutil

ROOT = Path('/kaggle/working/mv-research')
ROOT.mkdir(parents=True, exist_ok=True)
started = time.monotonic()
cfg = RESEARCH_CONFIG
report = {'state':'running','phase':'starting','experiments':[]}

class Cancelled(Exception): pass

def callback(**fields):
    report.update(fields, total_seconds=round(time.monotonic()-started,3))
    (ROOT / 'report.json').write_text(json.dumps(report,indent=2))
    req=urllib.request.Request(cfg['callback'],data=json.dumps({'action':'callback','report':report}).encode(),headers={'Content-Type':'application/json','x-job-token':cfg['gate']})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=20) as r: response=json.load(r)
            if response.get('cancel'):raise Cancelled()
            return
        except Cancelled:raise
        except Exception:
            if attempt==2:raise
            time.sleep(2)

def run(args, phase, timeout=600, cwd=None):
    callback(phase=phase)
    log=ROOT / (phase+'.log')
    with log.open('wb') as out:
        proc=subprocess.Popen(args,stdout=out,stderr=subprocess.STDOUT,cwd=cwd,start_new_session=True)
        end=time.monotonic()+timeout
        try:
            while proc.poll() is None:
                if time.monotonic()>end:raise TimeoutError(phase+'_timeout')
                if time.monotonic()-started>3300:raise TimeoutError('session_budget_exhausted')
                time.sleep(15)
                callback(phase=phase)
            if proc.returncode:
                detail=re.sub(r'https?://\S+','[url]',log.read_text(errors='replace')[-1600:])
                raise RuntimeError(phase+': '+detail)
        finally:
            if proc.poll() is None:
                import signal
                os.killpg(proc.pid,signal.SIGTERM)
                try:proc.wait(timeout=10)
                except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)

def clone(name,repo,revision):
    dest=ROOT/name
    run(['git','clone','--quiet','https://github.com/'+repo+'.git',str(dest)],'clone_'+name,180)
    run(['git','-C',str(dest),'checkout','--quiet',revision],'pin_'+name,60)

def finish(state):
    archive=ROOT/'artifacts.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in ROOT.rglob('*'):
            if not p.is_file() or any(x in p.parts for x in ['stable','swift','swift-models','source','venv-stable','venv-swift','uv-tool','python','.git']):continue
            if p.suffix in ['.mp4','.png','.json','.log'] and p.stat().st_size<15*1024*1024:
                # Logs are scrubbed before export; temporary URLs never persist.
                if p.suffix=='.log':z.writestr(str(p.relative_to(ROOT)),re.sub(r'https?://\S+','[url]',p.read_text(errors='replace'))[-30000:])
                else:z.write(p,str(p.relative_to(ROOT)))
    data=archive.read_bytes()
    req=urllib.request.Request(cfg['upload'],data=data,method='PUT',headers={'Content-Type':'application/zip','x-upsert':'false'})
    with urllib.request.urlopen(req,timeout=60) as r:r.read()
    callback(state=state,phase='finished',bytes=len(data),sha256=hashlib.sha256(data).hexdigest())

try:
    callback()
    gpu=subprocess.check_output(['nvidia-smi','--query-gpu=name,memory.total','--format=csv,noheader'],text=True).strip()
    callback(gpu=gpu)
    with urllib.request.urlopen(cfg['reference'],timeout=30) as r:data=r.read(10*1024*1024)
    if hashlib.sha256(data).hexdigest()!=cfg['reference_sha256']:raise RuntimeError('reference_sha256_mismatch')
    (ROOT/'carla.webp').write_bytes(data)
    is_swift=bool(cfg.get('source_archive'))
    if is_swift:
        callback(phase='verified_motion_source')
        with urllib.request.urlopen(cfg['source_archive'],timeout=60) as r:archive_data=r.read(50*1024*1024)
        if hashlib.sha256(archive_data).hexdigest()!=cfg['source_sha256']:raise RuntimeError('source_archive_sha256_mismatch')
        import io
        with zipfile.ZipFile(io.BytesIO(archive_data)) as archive:
            if sum(i.file_size for i in archive.infolist())>80*1024*1024:raise RuntimeError('source_archive_too_large')
            for entry in archive.infolist():
                name=Path(entry.filename)
                if name.is_absolute() or '..' in name.parts:raise RuntimeError('source_archive_path_invalid')
                if entry.file_size>15*1024*1024:raise RuntimeError('source_archive_file_too_large')
                if name.suffix not in ['.png','.mp4','.json','.log']:continue
                target=ROOT/'source'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(entry))
        with urllib.request.urlopen(cfg['product'],timeout=30) as r:product=r.read(10*1024*1024)
        if hashlib.sha256(product).hexdigest()!=cfg['product_sha256']:raise RuntimeError('product_sha256_mismatch')
        (ROOT/'product.png').write_bytes(product)
        clone('swift','VinAIResearch/SwiftTry','57d3f0b8b25509d4b650db68391c1ad11b86e833')
    else:
        clone('stable','Francis-Rings/StableAnimator','020e7f23a768410e0183ce943397d96a609f4ec1')
    # r1 ensurepip failed; r5 did not have wheels for the notebook's Python.
    # Pin Python itself, without inheriting the notebook's incompatible packages.
    run([sys.executable,'-m','pip','install','--quiet','--target',str(ROOT/'uv-tool'),'uv==0.6.10'],'install_uv',180)
    uv=str(ROOT/'uv-tool/bin/uv')
    os.environ['UV_PYTHON_INSTALL_DIR']=str(ROOT/'python')
    run([uv,'python','install','3.11.11'],'install_python311',300)
    run([uv,'venv','--python','3.11.11','--seed',str(ROOT/'venv-stable')],'venv_stable',180)
    python=str(ROOT/'venv-stable/bin/python')
    run([python,'-m','pip','install','--quiet','torch==2.5.1','torchvision==0.20.1','xformers==0.0.28.post3','--index-url','https://download.pytorch.org/whl/cu124'],'install_torch',600)
    run([python,'-m','pip','install','--quiet','setuptools==75.3.0','wheel==0.44.0','Cython==3.0.11','numpy==1.26.4'],'install_build',180)
    common=['huggingface-hub==0.25.2','opencv-python-headless==4.10.0.84','einops==0.8.0','imageio-ffmpeg==0.5.1','safetensors==0.4.5','scipy==1.14.1']
    deps=common+(['diffusers==0.24.0','transformers==4.30.2','accelerate==0.21.0','av==12.3.0','omegaconf==2.3.0','imageio==2.36.0','decord==0.6.0'] if is_swift else ['diffusers==0.30.3','transformers==4.44.2','accelerate==0.34.2','insightface==0.7.3','onnxruntime==1.20.1','matplotlib==3.9.2'])
    run([python,'-m','pip','install','--quiet','--no-build-isolation',*deps],'install_swift' if is_swift else 'install_stable',600)
    (ROOT/'stage.py').write_text(SWIFT_STAGE if is_swift else STABLE_STAGE)
    t=time.monotonic()
    try:
        run([python,str(ROOT/'stage.py')],'swift_stage' if is_swift else 'stable_stage',1800)
        metrics=json.loads((ROOT/('swift-metrics.json' if is_swift else 'stable_metrics.json')).read_text())
        if is_swift:shutil.copyfile(ROOT/metrics['result'],ROOT/'carla-product.mp4')
        report['experiments'].append({'engine':'SwiftTry' if is_swift else 'StableAnimator','state':'completed','elapsed_seconds':round(time.monotonic()-t,3),**metrics})
    except Exception as e:
        report['experiments'].append({'engine':'SwiftTry' if is_swift else 'StableAnimator','state':'failed','elapsed_seconds':round(time.monotonic()-t,3),'error':str(e)[-1800:]})
    callback(phase='stage_finished')
    finish('completed' if (ROOT/('carla-product.mp4' if is_swift else 'carla-motion.mp4')).exists() else 'failed')
except Cancelled:
    # Cancellation must still terminate the child; the supervisor handles it.
    try:finish('cancelled')
    except Exception:pass
except Exception as e:
    report['error']=re.sub(r'https?://\S+','[url]',str(e))[-1800:]
    try:finish('failed')
    except Exception:
        try:callback(state='failed',phase='failed')
        except Exception:pass
