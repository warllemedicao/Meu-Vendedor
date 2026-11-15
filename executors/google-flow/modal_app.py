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

    @api.post('/hyperbrowser-navigate')
    async def hyperbrowser_navigate(request: Request):
        expected = os.environ.get('MV_FLOW_EXECUTOR_SECRET', '')
        if len(expected) < 32 or not hmac.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + expected):
            raise HTTPException(401)
        raw = await request.body()
        if len(raw) > 16000: raise HTTPException(413)
        import json
        from urllib.parse import urlsplit
        try:
            payload = json.loads(raw)
            endpoint = payload.get('wsEndpoint')
            inspect_only = payload.get('mode') == 'inspect'
            if not isinstance(endpoint, str): raise ValueError('missing_endpoint')
            parsed = urlsplit(endpoint)
            host = (parsed.hostname or '').lower()
            if parsed.scheme != 'wss' or not (host.endswith('.hyperbrowser.ai') or host == 'hyperbrowser.ai' or host.endswith('.hxproxy.io')):
                raise ValueError('invalid_endpoint')
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(400, 'invalid_endpoint')
        from playwright.async_api import async_playwright
        from urllib.parse import parse_qsl, urlencode, urlunsplit
        # Keep the provider-owned browser alive when this short-lived CDP
        # client disconnects; never log the signed endpoint or its query.
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query['keepAlive'] = 'true'
        persistent_endpoint = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
        try:
            async with async_playwright() as playwright:
                browser = await playwright.chromium.connect_over_cdp(persistent_endpoint, timeout=20000)
                # The Hyperbrowser session owns this Chromium process. Do not call
                # browser.close(): for a CDP-attached browser that can close the
                # remote browser and invalidate its live-view URL.
                # Exiting async_playwright() releases only this Playwright client.
                if not browser.contexts: raise RuntimeError('no_context')
                context = browser.contexts[0]
                pages = [p for p in context.pages if not p.is_closed()]
                page = next((p for p in pages if (p.url or '').startswith('https://flow.google.com/')), None)
                if page is None:
                    page = pages[0] if pages else await context.new_page()
                if inspect_only:
                    # Inspect the already open page without resetting its navigation.
                    # Do not return arbitrary page text or account identifiers.
                    await page.wait_for_timeout(1800)
                    scan = """els => {
                        const visible = el => {
                            const r = el.getBoundingClientRect();
                            const st = getComputedStyle(el);
                            return r.width > 0 && r.height > 0 &&
                                st.visibility !== 'hidden' && st.display !== 'none';
                        };
                        const safeLabel = el => {
                            const value = (el.getAttribute('aria-label') ||
                                el.getAttribute('title') || el.innerText || '').trim();
                            const allowed = /novo projeto|new project|create|criar|projeto|project|flow|video|vídeo|gerar|generate|\+/i;
                            return allowed.test(value) && !/@|conta do google|google account/i.test(value)
                                ? value.slice(0,70) : '';
                        };
                        const candidates = els.filter(visible);
                        return {
                            visibleCount: candidates.length,
                            controls: candidates.map(el => ({
                                role: el.getAttribute('role') || el.tagName.toLowerCase(),
                                label: safeLabel(el)
                            })).filter(item => item.label).slice(0,25)
                        };
                    }"""
                    all_controls = []
                    total_visible = 0
                    for frame in page.frames[:8]:
                        try:
                            found = await frame.locator(
                                'button, [role="button"], a, [tabindex="0"]'
                            ).evaluate_all(scan, timeout=8000)
                            total_visible += found.get('visibleCount', 0)
                            all_controls.extend(found.get('controls', []))
                        except Exception:
                            continue
                    return {
                        'navigationReady': True, 'inspectionReady': True,
                        'controls': all_controls[:30], 'visibleCount': total_visible,
                        'frameCount': len(page.frames),
                        'flowPage': (page.url or '').startswith('https://flow.google.com/')
                    }
                await page.goto('https://flow.google.com/', wait_until='domcontentloaded', timeout=30000)
                return {'navigationReady': True}
        except Exception as exc:
            # Only emit safe diagnostics: no CDP URL, query string, tokens,
            # Google account data or remote live-view URL.
            print('hyperbrowser_navigation_failed', {
                'errorType': type(exc).__name__,
                'endpointHost': host,
                'phase': 'connect_or_navigate',
            })
            raise HTTPException(502, 'navigation_failed')

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
