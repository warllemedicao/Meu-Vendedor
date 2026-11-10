"""Use the expiring research gate in /tmp without printing capabilities."""
from pathlib import Path
import json
import hashlib
import sys
import urllib.request
import urllib.error

ROOT = Path('/tmp/mv-video-research')
cfg = json.loads((ROOT / 'control.json').read_text())
action = sys.argv[1] if len(sys.argv) > 1 else 'status'
req = urllib.request.Request(cfg['url'], data=json.dumps({'action': action}).encode(), headers={'Content-Type': 'application/json', 'x-research-token': cfg['gate']})
try:
    with urllib.request.urlopen(req, timeout=90) as response:
        result = json.load(response)
except urllib.error.HTTPError as exc:
    print('HTTP', exc.code, exc.read(1000).decode())
    raise SystemExit(1)
if action == 'upload-product':
    data = (ROOT / 'garment-flamengo.png').read_bytes()
    if hashlib.sha256(data).hexdigest() != result['sha256']:
        raise RuntimeError('product_sha256_mismatch')
    upload = urllib.request.Request(result['url'], data=data, method='PUT', headers={'Content-Type':'image/png','x-upsert':'false'})
    with urllib.request.urlopen(upload, timeout=30) as response:
        response.read()
    print('Exact prepared garment uploaded privately; SHA-256 matched.')
elif action == 'inputs':
    for name, url in result.items():
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        (ROOT / (name + '.webp')).write_bytes(data)
        print(name, len(data), 'bytes saved privately')
elif action == 'download':
    with urllib.request.urlopen(result['url'], timeout=90) as response:
        data = response.read()
    (ROOT / 'research-artifacts.zip').write_bytes(data)
    print('archive', len(data), 'bytes saved privately')
else:
    print(json.dumps(result, indent=2))
    (ROOT / (action + '.json')).write_text(json.dumps(result, indent=2))
