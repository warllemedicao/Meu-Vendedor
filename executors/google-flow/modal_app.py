"""Deploy with the official Modal SDK. Control endpoint is private; browsers scale to zero."""
import hmac
import os
import re
import secrets
import time
from pathlib import Path
import modal

app = modal.App('meu-vendedor-flow')
image = (modal.Image.debian_slim(python_version='3.12')
         .apt_install('xvfb')
         .pip_install('playwright==1.56.0', 'fastapi==0.115.12', 'uvicorn==0.34.2', 'httpx==0.28.1')
         .run_commands('playwright install --with-deps chromium')
         .add_local_dir(Path(__file__).parent, remote_path='/opt/flow', copy=True))
sessions = modal.Dict.from_name('mv-flow-browser-sessions', create_if_missing=True)

@app.function(image=image, secrets=[modal.Secret.from_name('mv-flow-control')], timeout=120,
              min_containers=0, max_containers=2, scaledown_window=30)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def gateway():
    # Configuration v2: the browser image is explicitly resolved before deployment.
    import asyncio
    import httpx
    from fastapi import FastAPI, Request, HTTPException
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.post('/control')
    async def control(request: Request):
        expected = os.environ.get('MV_FLOW_EXECUTOR_SECRET','')
        if len(expected)<32 or not hmac.compare_digest(request.headers.get('authorization',''), 'Bearer '+expected):
            raise HTTPException(401)
        raw=await request.body()
        if len(raw)>140000: raise HTTPException(413)
        import json
        body=json.loads(raw)
        action=body.get('action')
        if action=='health': return {'ready':True,'executor':'modal','generationReady':False}
        if action not in ['start','status','verify','save','disconnect']: raise HTTPException(400)
        user_key=body.get('userKey','')
        if not isinstance(user_key,str) or not re.fullmatch('[a-f0-9]{64}',user_key): raise HTTPException(400)
        # No Google identity, cookies or provider credentials enter this dictionary; only scoped session references.
        row=await sessions.get.aio(user_key, None)
        sandbox=None
        if row:
            try:
                sandbox=await modal.Sandbox.from_id.aio(row['id'])
                if row['expires']<=time.time() or await sandbox.poll.aio() is not None:
                    await sandbox.terminate.aio()
                    await sessions.pop.aio(user_key,None)
                    row=None; sandbox=None
            except Exception:
                # Preserve references on transient provider failure; do not launch duplicates.
                raise HTTPException(503,'executor_session_check_failed')
        if action=='disconnect':
            if sandbox:
                await sandbox.terminate.aio()
                await sessions.pop.aio(user_key,None)
            return {'active':False}
        if not row and action!='start': return {'active':False}
        async with httpx.AsyncClient(timeout=65, follow_redirects=False) as client:
            if not row:
                view_token=secrets.token_urlsafe(32); control_token=secrets.token_urlsafe(32)
                try:
                    sandbox=await modal.Sandbox.create.aio(
                        'uvicorn','browser:app','--host','0.0.0.0','--port','8000','--no-access-log',
                        app=app, image=modal.Image.from_id(os.environ['MV_FLOW_BROWSER_IMAGE']), workdir='/opt/flow', timeout=600, idle_timeout=120,
                        cpu=1, memory=2048, encrypted_ports=[8000],
                        secrets=[modal.Secret.from_dict({'VIEW_TOKEN':view_token,'CONTROL_TOKEN':control_token})])
                    tunnels=await sandbox.tunnels.aio()
                    base=tunnels[8000].url.rstrip('/')
                    row={'id':sandbox.object_id,'url':base,'view':view_token,'control':control_token,'expires':time.time()+600}
                    # Health wait is bounded; a failed boot always closes its sandbox.
                    for attempt in range(35):
                        if await sandbox.poll.aio() is not None: raise RuntimeError('browser_process_stopped')
                        try:
                            response=await client.post(base+'/rpc',headers={'Authorization':'Bearer '+control_token},json={'action':'health'},timeout=2)
                            if response.status_code==200: break
                        except httpx.HTTPError: pass
                        await asyncio.sleep(1)
                    else: raise RuntimeError('browser_start_timeout')
                    cookies=body.get('cookies')
                    if cookies:
                        response=await client.post(base+'/rpc',headers={'Authorization':'Bearer '+control_token},json={'action':'restore','cookies':cookies})
                        if response.status_code!=200: raise RuntimeError('browser_restore_failed')
                    await sessions.put.aio(user_key,row)
                except Exception:
                    if sandbox: await sandbox.terminate.aio()
                    raise HTTPException(503,'browser_start_failed')
            result={'active':True,'sessionId':row['id'],'expires':int(row['expires']*1000)}
            if action=='start': result['liveViewUrl']=row['url']+'/view#'+row['view']
            if action in ['verify','save']:
                response=await client.post(row['url']+'/rpc',headers={'Authorization':'Bearer '+row['control']},json={'action':action})
                if response.status_code!=200 or len(response.content)>140000: raise HTTPException(503,'browser_inspection_failed')
                result.update(response.json())
            return result
    return api
