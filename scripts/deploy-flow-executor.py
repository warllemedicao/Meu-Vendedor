"""Run with Modal credentials and MV_FLOW_EXECUTOR_SECRET in a protected environment."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import modal

root = Path(__file__).resolve().parent.parent
secret = os.environ.get('MV_FLOW_EXECUTOR_SECRET', '')
if len(secret) < 32:
    raise SystemExit('Configure MV_FLOW_EXECUTOR_SECRET com pelo menos 32 caracteres em ambiente seguro.')
spec = importlib.util.spec_from_file_location('flow_executor_deploy', root / 'executors/google-flow/modal_app.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
app = modal.App.lookup('meu-vendedor-flow', create_if_missing=True)
image = module.image.build(app)
values = {'MV_FLOW_EXECUTOR_SECRET': secret, 'MV_FLOW_BROWSER_IMAGE': image.object_id}
try:
    modal.Secret.from_name('mv-flow-control').update(values)
except modal.exception.NotFoundError:
    modal.Secret.objects.create('mv-flow-control', values)
raise SystemExit(subprocess.call([sys.executable, '-m', 'modal', 'deploy', 'executors/google-flow/modal_app.py'], cwd=root))
