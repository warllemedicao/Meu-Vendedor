"""Build the fixed comparison endpoint locally; never prints capabilities.

The temporary control.json is generated separately and must remain outside Git.
This script neither deploys nor submits GPU work.
"""
from pathlib import Path
import ast
import hashlib
import json

repo = Path(__file__).resolve().parents[1]
target = Path('/tmp/mv-ana-midi')
config = json.loads((target / 'control.json').read_text())
hunyuan = (repo / 'executors/kaggle/distilled_benchmark.py').read_text()
revision = '854c04a4c8a53d990b418c7478f0802c0fc8c726'
hunyuan = hunyuan.replace('revision=REPORT["model_revision"]', 'revision="' + revision + '"')
hunyuan = hunyuan.replace('report("model_catalog_checked", model_revision=model.get("sha")',
                          'report("model_catalog_checked", model_revision="' + revision + '"')
hunyuan = hunyuan.replace('{"action": "report", "report": REPORT}',
                          '{"action": "callback", "id": CONFIG["id"], "report": REPORT}')
hunyuan = hunyuan.replace('"x-benchmark-gate": CONFIG["report_gate"]',
                          '"x-job-token": CONFIG["report_gate"]')
wan = (repo / 'executors/kaggle/motion_graphs.py').read_text() + '\n' + (repo / 'executors/kaggle/motion_runner.py').read_text()
supervisor = (repo / 'executors/kaggle/ana_midi_supervisor.py').read_text()
for name, source in [('hunyuan', hunyuan), ('wan', wan), ('supervisor', supervisor)]:
    ast.parse(source)
    print(name, 'syntax OK')
controller = (repo / 'executors/kaggle/ana_midi_controller.ts').read_text()
controller = controller.replace('__CONTROL_HASH__', hashlib.sha256(config['gate'].encode()).hexdigest())
controller = controller.replace('__DEADLINE__', '2026-11-10T00:00:00Z')
controller = controller.replace('__SOURCES__', json.dumps({'hunyuan': hunyuan, 'wan': wan}))
controller = controller.replace('__SUPERVISOR__', json.dumps(supervisor))
(target / 'controller.ts').write_text(controller)
print('Comparison endpoint built; no deployment or inference performed.')
