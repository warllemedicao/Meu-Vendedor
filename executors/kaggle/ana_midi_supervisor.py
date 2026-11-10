"""Bounded comparison of fixed, previously preserved Ana/midi inputs.

TEST_CONFIG and TEST_SOURCE are injected. No administrative keys reach Kaggle.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.request
import zipfile

cfg = TEST_CONFIG
root = Path('/kaggle/working/ana-midi-test')
root.mkdir(parents=True, exist_ok=True)
started = time.monotonic()
proc = None


def callback(**report):
    report['supervisor_seconds'] = round(time.monotonic() - started, 3)
    req = urllib.request.Request(cfg['callback'], data=json.dumps({
        'action': 'callback', 'id': cfg['id'], 'report': report,
    }).encode(), headers={'Content-Type': 'application/json', 'x-job-token': cfg['gate']})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def download(url, target, expected):
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(40 * 1024 * 1024 + 1)
    if len(data) > 40 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError('input_hash_mismatch')
    target.write_bytes(data)


def stop():
    if proc and proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=10)


state = 'failed'
error = None
try:
    callback(state='running', phase='verify_inputs')
    for kind in ['reference', 'product', 'driver']:
        download(cfg[kind], root / kind, cfg[kind + '_sha256'])
    if cfg['engine'] == 'hunyuan':
        child_cfg = {'image_url': cfg['reference'], 'offloading': 'model',
                     'id': cfg['id'], 'report_url': cfg['callback'], 'report_gate': cfg['gate']}
        prefix = 'BENCHMARK_CONFIG = ' + repr(child_cfg) + '\n'
    else:
        child_cfg = {**cfg, 'engine': 'wan-animate', 'seed': 42, 'seconds': 2,
                     'mode': 'animate', 'reviewedReferenceSha256': cfg['reference_sha256'],
                     'reviewedProductSha256': cfg['product_sha256'],
                     'prompt': 'The adult woman in the reference wears the same orange midi wrap dress. '
                               'Preserve her face, short sleeves, V neckline, waist folds and metal detail. '
                               'One small natural presentation gesture, fixed camera, no scene cuts.'}
        prefix = 'HYBRID_CONFIG = ' + repr(child_cfg) + '\n'
    source = root / 'stage.py'
    source.write_text(prefix + TEST_SOURCE)
    with (root / 'runtime.log').open('wb') as log:
        proc = subprocess.Popen([sys.executable, str(source)], stdout=log,
                                stderr=subprocess.STDOUT, start_new_session=True)
        while proc.poll() is None:
            time.sleep(15)
            if time.monotonic() - started > cfg['budget_seconds']:
                raise TimeoutError('bounded_session_timeout')
            if callback(phase='supervising').get('cancel'):
                state = 'cancelled'
                raise RuntimeError('cancelled_by_owner')
    final = Path('/kaggle/working/short_generation.mp4') if cfg['engine'] == 'hunyuan' else Path('/kaggle/working/mv-motion/final.mp4')
    if proc.returncode != 0 or not final.exists():
        raise RuntimeError('child_failed_exit_' + str(proc.returncode))
    data = final.read_bytes()
    # Hunyuan uploads here; the Wan executor has already uploaded to the same fixed path.
    if cfg['engine'] == 'hunyuan':
        req = urllib.request.Request(cfg['video_upload'], data=data, method='PUT',
                                     headers={'Content-Type': 'video/mp4', 'x-upsert': 'false'})
        with urllib.request.urlopen(req, timeout=90) as response:
            response.read()
    state = 'completed'
    callback(phase='video_uploaded', video_bytes=len(data), video_sha256=hashlib.sha256(data).hexdigest())
except Exception as exc:
    error = re.sub(r'https?://\S+', '[url]', str(exc))[:1200]
finally:
    stop()
    try:
        archive = root / 'diagnostics.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
            candidates = [root / 'runtime.log', Path('/kaggle/working/benchmark-report.json'),
                          Path('/kaggle/working/mv-motion/report.json'), Path('/kaggle/working/mv-motion/comfy.log'),
                          Path('/kaggle/working/mv-motion/runtime.log')]
            for i, path in enumerate(candidates):
                if path.exists():
                    content = re.sub(r'https?://\S+', '[url]', path.read_text(errors='replace'))[-60000:]
                    output.writestr(str(i) + '-' + path.name, content)
        data = archive.read_bytes()
        req = urllib.request.Request(cfg['archive_upload'], data=data, method='PUT',
                                     headers={'Content-Type': 'application/zip', 'x-upsert': 'false'})
        with urllib.request.urlopen(req, timeout=90) as response:
            response.read()
        callback(state=state, phase='finished', error=error, archive_bytes=len(data),
                 archive_sha256=hashlib.sha256(data).hexdigest())
    except Exception:
        callback(state=state, phase='finished_without_archive', error=error)
