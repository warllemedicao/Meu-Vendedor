"""Fetch public research sources into /tmp; never reads credentials."""
from pathlib import Path
import json
import hashlib
import io
import subprocess
import urllib.request
import zipfile

ROOT = Path('/tmp/mv-video-research')
ROOT.mkdir(exist_ok=True)
repositories = {
    'stable': 'Francis-Rings/StableAnimator',
    'swift': 'VinAIResearch/SwiftTry',
    'cat': 'Zheng-Chong/CatV2TON',
    '3dv': '2y7c3/3DV-TON',
    'homie': 'YIYANGCAI/HOMIE',
    'mimic': 'Tencent/MimicMotion',
    'leffa': 'franciszzj/Leffa',
    'unianimate': 'ali-vilab/UniAnimate-DiT',
    'vivid': 'alibaba-yuanjing-aigclab/ViViD',
    'bernini': 'bytedance/Bernini',
    'magic': 'vivoCameraResearch/Magic-TryOn',
    'controlnext': 'dvlab-research/ControlNeXt',
}
manifest = {}
for name, repo in repositories.items():
    dest = ROOT / name
    if not dest.exists():
        subprocess.run(['git', 'clone', '--depth', '1', '--quiet', 'https://github.com/' + repo + '.git', str(dest)], check=True, timeout=120)
    revision = subprocess.check_output(['git', '-C', str(dest), 'rev-parse', 'HEAD'], text=True).strip()
    manifest[name] = {'repository': repo, 'revision': revision}
    print(name, revision, flush=True)
for name, repo in [('stable', 'FrancisRing/StableAnimator'), ('swift', 'NMHung/SwiftTry')]:
    with urllib.request.urlopen('https://huggingface.co/api/models/' + repo, timeout=30) as response:
        data = json.load(response)
    manifest[name]['model'] = {'repository': repo, 'revision': data.get('sha'), 'card': data.get('cardData', {}), 'files': [x['rfilename'] for x in data.get('siblings', [])]}
(ROOT / 'sources.json').write_text(json.dumps(manifest, indent=2))
for name, url in {
    'dress-envelope.jpg': 'https://cf.shopee.com.br/file/br-11134207-820ll-msikdto0swlg62',
    'dress-regata.jpg': 'https://cf.shopee.com.br/file/br-11134207-820me-mu3uwis6jx1c1d',
    'flamengo.jpg': 'https://cf.shopee.com.br/file/br-11134207-820lk-mv387fqpgs8zac',
}.items():
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read(10 * 1024 * 1024)
        (ROOT / name).write_bytes(data)
        print(name, len(data), flush=True)
    except Exception as exc:
        print(name, type(exc).__name__, flush=True)

# A pinned decoder for local verification of the complete generated MP4.
if not (ROOT / 'ffmpeg').exists():
    with urllib.request.urlopen('https://pypi.org/pypi/imageio-ffmpeg/0.6.0/json', timeout=30) as response:
        package = json.load(response)
    wheel = next(f for f in package['urls'] if 'manylinux2014_x86_64' in f['filename'])
    with urllib.request.urlopen(wheel['url'], timeout=60) as response:
        payload = response.read()
    if hashlib.sha256(payload).hexdigest() != wheel['digests']['sha256']:
        raise RuntimeError('decoder_wheel_sha256_mismatch')
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        name = next(n for n in archive.namelist() if '/binaries/ffmpeg-' in n)
        (ROOT / 'ffmpeg').write_bytes(archive.read(name))
    (ROOT / 'ffmpeg').chmod(0o700)
    print('decoder_ready', flush=True)
