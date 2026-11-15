"""Deploy with the official Modal SDK. Control endpoint is private; browsers scale to zero."""
import hmac
import hashlib
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
    import sys
    from fastapi import FastAPI, Request, HTTPException
    # add_local_dir places helpers here in the Modal image.
    sys.path.insert(0, '/opt/flow')
    from flow_diagnostics import FlowDiagnostics, REASONS, wait_for_images, inspect_settings, include_references, editor_state, generate_video
    executor_revision = hashlib.sha256(
        Path('/opt/flow/modal_app.py').read_bytes() + Path('/opt/flow/flow_diagnostics.py').read_bytes()
    ).hexdigest()[:12]
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @api.post('/hyperbrowser-navigate')
    async def hyperbrowser_navigate(request: Request):
        expected = os.environ.get('MV_FLOW_EXECUTOR_SECRET', '')
        if len(expected) < 32 or not hmac.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + expected):
            raise HTTPException(401)
        raw = await request.body()
        if len(raw) > 4100000: raise HTTPException(413)
        import json
        from urllib.parse import urlsplit
        try:
            payload = json.loads(raw)
            endpoint = payload.get('wsEndpoint')
            inspect_only = payload.get('mode') in ('inspect', 'create-project', 'inspect-editor', 'stage-prompt', 'prepare-draft', 'prepare-image', 'inspect-settings', 'generate-video')
            create_project = payload.get('mode') == 'create-project'
            stage_prompt = payload.get('mode') in ('stage-prompt', 'prepare-draft', 'prepare-image')
            if payload.get('mode') == 'generate-video' and payload.get('generationConfirmed') is not True:
                raise ValueError('generation_confirmation_required')
            stage_image = payload.get('mode') == 'prepare-image' or bool(payload.get('images'))
            rights_confirmed = payload.get('imageRightsConfirmed') is True
            if stage_image and not rights_confirmed:
                raise ValueError('image_rights_confirmation_required')
            prompt = payload.get('prompt', '')
            if stage_prompt and (not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 4000):
                raise ValueError('invalid_prompt')
            image_files = []
            upload_tag = secrets.token_hex(4)
            if stage_image:
                import base64
                supplied = payload.get('images') if isinstance(payload.get('images'), list) else [{'mime':payload.get('imageMime'),'data':payload.get('imageBase64')}]
                if not 1 <= len(supplied) <= 3:
                    raise ValueError('invalid_image')
                for item in supplied:
                    mime = item.get('mime') if isinstance(item, dict) else None
                    image_data = item.get('data') if isinstance(item, dict) else None
                    if mime not in ('image/png', 'image/jpeg', 'image/webp') or not isinstance(image_data, str):
                        raise ValueError('invalid_image')
                    try:
                        image_bytes = base64.b64decode(image_data, validate=True)
                    except Exception:
                        raise ValueError('invalid_image')
                    signatures = {'image/png': image_bytes.startswith(bytes.fromhex('89504e470d0a1a0a')), 'image/jpeg': image_bytes.startswith(bytes.fromhex('ffd8ff')), 'image/webp': image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP'}
                    if not image_bytes or not signatures[mime]:
                        raise ValueError('invalid_image')
                    image_files.append({'name': 'produto-' + upload_tag + '-' + str(len(image_files)+1) + '.' + {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime], 'mimeType': mime, 'buffer': image_bytes})
                if sum(len(item['buffer']) for item in image_files) > 2500000:
                    raise ValueError('invalid_image')
            if not isinstance(endpoint, str): raise ValueError('missing_endpoint')
            parsed = urlsplit(endpoint)
            host = (parsed.hostname or '').lower()
            if parsed.scheme != 'wss' or not (host.endswith('.hyperbrowser.ai') or host == 'hyperbrowser.ai' or host.endswith('.hxproxy.io')):
                raise ValueError('invalid_endpoint')
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(400, 'invalid_endpoint')
        trace = FlowDiagnostics(payload.get("traceId"), payload.get("mode", "navigate"), executor_revision)
        trace.event("request", expected=len(image_files))
        from playwright.async_api import async_playwright
        from urllib.parse import parse_qsl, urlencode, urlunsplit
        # Keep the provider-owned browser alive when this short-lived CDP
        # client disconnects; never log the signed endpoint or its query.
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query['keepAlive'] = 'true'
        persistent_endpoint = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
        try:
            trace.event("connect", "started")
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
                trace.event("connect", frames=len(page.frames), flowPage=(page.url or "").startswith("https://flow.google.com/"), projectPage=(page.url or "").startswith("https://flow.google.com/project/"))
                if inspect_only:
                    # Inspect the already open page without resetting its navigation.
                    # Create only a blank project when explicitly requested; never generate media.
                    trace.event("project", "started")
                    project_clicked = False
                    if create_project or (stage_prompt and not (page.url or '').startswith('https://flow.google.com/project/')):
                        if not (page.url or '').startswith('https://flow.google.com/'):
                            raise RuntimeError('flow_page_not_active')
                        for project_frame in page.frames[:8]:
                            button = project_frame.get_by_role('button', name=re.compile(r'novo projeto|new project', re.I))
                            if await button.count() == 1 and await button.is_visible():
                                await button.click(timeout=8000)
                                project_clicked = True
                                break
                        if not project_clicked:
                            raise RuntimeError('new_project_button_not_found')
                        await page.wait_for_timeout(2200)
                    trace.event("project", projectPage=(page.url or "").startswith("https://flow.google.com/project/"))
                    prompt_staged = False
                    if stage_prompt:
                        trace.event("prompt", "started")
                        if not (page.url or '').startswith('https://flow.google.com/project/'):
                            raise RuntimeError('flow_project_not_active')
                        matches = []
                        for prompt_frame in page.frames[:8]:
                            locator = prompt_frame.locator('[role="textbox"][data-placeholder], [role="textbox"][aria-label], [contenteditable="true"][data-placeholder], [contenteditable="true"][aria-label], [contenteditable="true"][placeholder]')
                            for index in range(min(await locator.count(), 30)):
                                field = locator.nth(index)
                                if not await field.is_visible():
                                    continue
                                metadata = await field.evaluate("""el => [el.getAttribute('aria-label'), el.getAttribute('data-placeholder'), el.getAttribute('placeholder'), el.getAttribute('data-testid')].filter(Boolean).join(' ')""")
                                if re.search(r'o que você quer criar|what do you want to create', metadata or '', re.I):
                                    matches.append(field)
                        trace.event("prompt", "waiting", matches=len(matches))
                        if len(matches) != 1:
                            raise RuntimeError('prompt_field_not_unique')
                        await matches[0].fill(prompt.strip(), timeout=8000)
                        prompt_staged = True
                        trace.event("prompt")
                    image_attached = False
                    image_count = 0
                    if stage_image:
                        trace.event("upload", "started", expected=len(image_files))
                        # The Flow editor may create a hidden file input only after opening
                        # the attachment menu. Never click Generate or submit the prompt.
                        # A Flow library menu can open without starting a file upload.
                        # Capture the native chooser while clicking the explicit upload action.
                        async def click_upload_action():
                            # The real upload control is at the lower-left of the
                            # Flow library drawer, not the library search/results.
                            for frame in page.frames[:8]:
                                for locator in (
                                    frame.get_by_text(re.compile(r'^\s*Fazer upload\s*(?:\.\.\.|…)?\s*$', re.I)),
                                    frame.get_by_role('button', name=re.compile(r'fazer upload|upload', re.I)),
                                    frame.get_by_text(re.compile(r'^\s*Upload\s*$', re.I)),
                                ):
                                    matches = await locator.count()
                                    for idx in range(min(matches, 12)):
                                        candidate = locator.nth(idx)
                                        if not await candidate.is_visible():
                                            continue
                                        # A file chooser is a browser event, not a
                                        # normal input shown in the library search.
                                        try:
                                            async with page.expect_file_chooser(timeout=3500) as chooser_info:
                                                await candidate.click(timeout=3500)
                                            chooser = await chooser_info.value
                                            await chooser.set_files(image_files, timeout=12000)
                                            trace.event("upload", expected=len(image_files), fileChooser=True)
                                            return True
                                        except Exception:
                                            for candidate_frame in page.frames[:8]:
                                                files = candidate_frame.locator('input[type="file"]')
                                                if await files.count() == 1:
                                                    await files.set_input_files(image_files, timeout=12000)
                                                    trace.event("upload", expected=len(image_files), fileInput=True)
                                                    return True
                                            raise RuntimeError('flow_file_chooser_unavailable')
                            return False
                        uploaded = await click_upload_action()
                        if not uploaded:
                            # Reveal the library from the attachment control, then retry.
                            for frame in page.frames[:8]:
                                for selector in ('button[aria-label*="Adicionar"]', 'button[aria-label*="Add"]', 'button[title*="Adicionar"]', 'button[title*="Add"]'):
                                    trigger = frame.locator(selector)
                                    if await trigger.count() == 1 and await trigger.is_visible():
                                        await trigger.click(timeout=4000)
                                        trace.event("upload", "waiting", libraryOpened=True)
                                        break
                            await page.wait_for_timeout(500)
                            uploaded = await click_upload_action()
                        if not uploaded:
                            raise RuntimeError('flow_upload_action_not_found')
                        image_attached = True
                        image_count = len(image_files)
                        trace.event("upload", expected=image_count)
                        trace.event("rights", "started")
                        rights_accepted = 0
                        # Accept rights only for this user-authorized upload batch.
                        # The consent modal may appear once per image.
                        for image_index in range(len(image_files)):
                            found = False
                            for attempt in range(12):
                                for frame in page.frames[:8]:
                                    dialog = frame.get_by_text('Direitos de uso desta imagem', exact=False)
                                    if await dialog.count() and await dialog.first.is_visible():
                                        trace.event("rights", "waiting", dialogVisible=True, accepted=rights_accepted)
                                        agree = frame.get_by_role('button', name=re.compile(r'^\s*Concordo\s*$', re.I))
                                        if await agree.count() == 1 and await agree.is_visible():
                                            await agree.click(timeout=5000)
                                            found = True
                                            rights_accepted += 1
                                            trace.event("rights", accepted=rights_accepted)
                                        else:
                                            raise RuntimeError('image_rights_dialog_unresolved')
                                        break
                                if found:
                                    break
                                await page.wait_for_timeout(350)
                            if not found:
                                break
                            await page.wait_for_timeout(350)
                        # Upload completion is asynchronous in Flow. Wait for each
                        # expected asset to become visible and for upload indicators
                        # to disappear. Stable consecutive frame reads prevent
                        # advancing on an intermediate render.
                        trace.event("rights", accepted=rights_accepted)
                        await wait_for_images(page, image_files, trace)
                    if not stage_image:
                        trace.event("upload", "skipped", expected=0)
                    reference_result = {'included': False, 'verified': False, 'errorCode': None}
                    if stage_prompt and image_files:
                        reference_result = await include_references(page, image_files, matches[0], trace)
                    else:
                        trace.event('references', 'skipped', expected=0)
                    settings_result = None
                    if payload.get('mode') in ('inspect-settings', 'prepare-draft', 'generate-video'):
                        # Settings are independent of reference verification.
                        # Always inspect/save them, even if a reference click
                        # could not be confirmed; never start generation.
                        settings_result = await inspect_settings(page, trace)
                        settings_result["referencesVerified"] = reference_result["verified"]
                    generation_result = None
                    if payload.get('mode') == 'generate-video':
                        # A distinct, opt-in operation; never run during prepare-draft.
                        if not settings_result:
                            settings_result = await inspect_settings(page, trace)
                        if not (settings_result['vertical916'] and settings_result['singleOutput']
                                and not settings_result['errorCode']):
                            reason = 'flow_settings_read_failed'
                            generation_result = {'generationStarted': False, 'confirmationAccepted': False,
                                                 'errorCode': reason}
                        else:
                            generation_result = await generate_video(page, trace)
                    await editor_state(page, trace)
                    if generation_result is not None:
                        reason = generation_result['errorCode'] or 'flow_generation_started'
                    elif reference_result['errorCode']:
                        reason = reference_result['errorCode']
                    elif (settings_result or {}).get('errorCode'):
                        reason = settings_result['errorCode']
                        trace.next_action = 'inspect_settings'
                    elif stage_prompt:
                        reason = 'flow_draft_ready'
                        trace.next_action = 'generate_video' if settings_result and settings_result['vertical916'] and settings_result['singleOutput'] else 'inspect_settings'
                    else:
                        reason = 'inspection_only'
                    trace.event("inspection", "started")
                    # Do not return arbitrary page text or account identifiers.
                    await page.wait_for_timeout(1800)
                    scan = r"""els => {
                        const visible = el => {
                            const r = el.getBoundingClientRect();
                            const st = getComputedStyle(el);
                            return r.width > 0 && r.height > 0 &&
                                st.visibility !== 'hidden' && st.display !== 'none';
                        };
                        const safeLabel = el => {
                            const value = (el.getAttribute('aria-label') ||
                                el.getAttribute('title') || el.innerText || '').trim();
                            const known = [
                                [/^(novo projeto|new project)$/i, 'Novo projeto'],
                                [/^(incluir no comando|add to prompt|include in prompt)$/i, 'Incluir no comando'],
                                [/^(enviar(?: comando)?|gerar(?: vídeo| video)?|send|submit|generate(?: video)?|arrow_forward)$/i, 'Enviar / Gerar vídeo'],
                                [/^(configurações(?: do (?:agente|vídeo|video))?|(?:agent |video )?settings)$/i, 'Configurações'],
                                [/^fazer upload(?:\.\.\.|…)?$/i, 'Fazer upload'],
                                [/^concordo$/i, 'Concordo'],
                                [/^(selecionar projeto|select project)$/i, 'Selecionar projeto']
                            ];
                            return known.find(([pattern]) => pattern.test(value))?.[1] || '';
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
                    # Read only metadata of editor inputs, never values or account data.
                    editor_items = []
                    editor_frames = 0
                    editor_errors = 0
                    if payload.get('mode') in ('inspect-editor', 'prepare-draft'):
                        editor_scan = r"""els => {
                            const safe = v => {
                                const t=(v||'').trim();
                                return t.length<=70 && !/@|https?:|token|password|senha/i.test(t) ? t : '';
                            };
                            return els.filter(el => {
                                const r=el.getBoundingClientRect(), st=getComputedStyle(el);
                                return el.type==='file' || (r.width>0 && r.height>0 && st.display!=='none' && st.visibility!=='hidden');
                            }).slice(0,60).map(el => ({
                                role:el.getAttribute('role')||el.tagName.toLowerCase(),
                                label:safe(el.getAttribute('aria-label'))||safe(el.getAttribute('placeholder'))||safe(el.getAttribute('title'))||'',
                                kind:el.type==='file'?'file':el.isContentEditable?'editable':el.tagName.toLowerCase(),
                                accept:el.type==='file'?safe(el.getAttribute('accept')):''
                            }));
                        }"""
                        for editor_frame in page.frames[:8]:
                            try:
                                found = await editor_frame.locator(
                                    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="radio"], [role="switch"]'
                                ).evaluate_all(editor_scan)
                                editor_frames += 1
                                editor_items.extend(found)
                            except Exception:
                                editor_errors += 1
                    all_controls = []
                    total_visible = 0
                    inspected_frames = 0
                    scan_errors = 0
                    for frame in page.frames[:8]:
                        try:
                            found = await frame.locator(
                                'button, [role="button"], a, [tabindex="0"]'
                            ).evaluate_all(scan)
                            inspected_frames += 1
                            total_visible += found.get('visibleCount', 0)
                            all_controls.extend(found.get('controls', []))
                        except Exception:
                            scan_errors += 1
                            continue
                    trace.event("inspection", frames=inspected_frames, frameErrors=scan_errors)
                    trace.event("finished")
                    return {
                        'diagnostics': trace.report(reason),
                        'navigationReady': True, 'inspectionReady': True,
                        'controls': all_controls[:30], 'visibleCount': total_visible,
                        'frameCount': len(page.frames), 'inspectedFrames': inspected_frames,
                        'scanErrors': scan_errors,
                        'flowPage': (page.url or '').startswith('https://flow.google.com/'),
                        'projectClicked': project_clicked, 'promptStaged': prompt_staged, 'imageAttached': image_attached, 'imageCount': image_count, 'settingsInspection': settings_result, 'referencesIncluded': reference_result['included'], 'referencesVerified': reference_result['verified'],
                        'generationStarted': bool(generation_result and generation_result['generationStarted']),
                        'confirmationAccepted': bool(generation_result and generation_result['confirmationAccepted']),
                        'editorControls': editor_items[:80],
                        'editorFrames': editor_frames, 'editorErrors': editor_errors
                    }
                await page.goto('https://flow.google.com/', wait_until='domcontentloaded', timeout=30000)
                return {'navigationReady': True}
        except Exception as exc:
            reason = str(exc) if str(exc) in REASONS else 'navigation_failed'
            trace.event(trace.stage, "error")
            raise HTTPException(502, {'code': reason, 'diagnostics': trace.report(reason)})

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
