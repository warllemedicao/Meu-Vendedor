"""Bounded telemetry: only fixed codes, counters and booleans leave the executor."""
import json
import asyncio
import re
import time
import uuid

STAGES = frozenset(('request', 'connect', 'project', 'prompt', 'upload', 'rights',
                    'images_wait', 'settings', 'references', 'inspection', 'finished'))
METRICS = frozenset(('expected', 'visible', 'busy', 'stable', 'required', 'polls',
                     'frames', 'frameErrors', 'accepted', 'matches', 'elapsedMs',
                     'limitMs', 'includeVisible', 'includeEnabled', 'selected',
                     'vertical916', 'singleOutput', 'opened', 'flowPage', 'projectPage',
                     'fileChooser', 'fileInput', 'libraryOpened', 'dialogVisible',
                     'disabled', 'trial', 'clickTimedOut', 'assetIndex', 'selectable',
                     'selectedExpected', 'referencesIncluded', 'referencesVerified',
                     'submitVisible', 'submitEnabled', 'settingsCandidates',
                     'composerForms', 'composerFields', 'attachmentMatches',
                     'assetTextMatches', 'assetOptionParents', 'assetButtonParents',
                     'assetCheckboxParents', 'libraryOptions', 'libraryCheckboxes'))
REASONS = frozenset(('flow_page_not_active', 'flow_project_not_active',
    'prompt_field_not_unique', 'new_project_button_not_found', 'image_input_not_found',
    'flow_upload_action_not_found', 'flow_file_chooser_unavailable',
    'flow_images_not_ready', 'image_rights_dialog_unresolved',
    'image_rights_confirmation_required', 'no_context', 'navigation_failed',
    'references_not_implemented', 'inspection_only', 'flow_settings_not_found',
    'flow_settings_ambiguous', 'flow_settings_blocked', 'flow_settings_read_failed',
    'flow_reference_selection_unavailable', 'flow_reference_selection_unconfirmed',
    'flow_reference_include_unavailable', 'flow_reference_include_uncertain',
    'flow_references_unverified', 'flow_draft_ready'))


class FlowDiagnostics:
    def __init__(self, trace_id, action, revision, clock=time.monotonic, emit=print):
        self.trace_id = trace_id if isinstance(trace_id, str) and re.fullmatch(r'[0-9a-f-]{36}', trace_id) else str(uuid.uuid4())
        self.action = action if action in ('navigate', 'inspect', 'create-project', 'inspect-editor', 'stage-prompt', 'prepare-draft', 'prepare-image', 'inspect-settings') else 'inspect'
        self.revision = revision
        self.clock, self.emit, self.started = clock, emit, clock()
        self.events, self.stage = [], 'request'
        self.references_included, self.references_verified = False, False
        self.next_action = 'inspect_controls'

    def event(self, stage, status='ok', **metrics):
        if stage not in STAGES or status not in ('started', 'ok', 'waiting', 'skipped', 'blocked', 'error'):
            raise ValueError('invalid_diagnostic_event')
        self.stage = stage
        item = {'stage': stage, 'status': status, 'atMs': int((self.clock() - self.started) * 1000)}
        item['metrics'] = {key: value for key, value in metrics.items()
                           if key in METRICS and (type(value) is bool or type(value) is int and 0 <= value <= 1000000)}
        if len(self.events) == 80:
            self.events.pop(1)  # Preserve the start and the most recent evidence.
        self.events.append(item)
        self.emit('flow_step ' + json.dumps({'traceId': self.trace_id, 'revision': self.revision, **item}), flush=True)

    def report(self, reason):
        return {'schemaVersion': 1, 'traceId': self.trace_id, 'action': self.action,
                'executorRevision': self.revision, 'elapsedMs': int((self.clock() - self.started) * 1000),
                'stopReason': reason if reason in REASONS else 'navigation_failed',
                'lastStage': self.stage, 'generationStarted': False,
                'referencesIncluded': self.references_included,
                'referencesVerified': self.references_verified,
                'nextAction': self.next_action, 'events': list(self.events)}


async def wait_for_images(page, image_files, trace, clock=time.monotonic, timeout=45):
    expected_names = {item['name'] for item in image_files}
    stable_reads = 0
    wait_started = clock()
    upload_deadline = wait_started + timeout
    trace.event("images_wait", "started", expected=len(expected_names), limitMs=int(timeout*1000), required=3)
    polls = 0
    last_sample = None
    last_logged = wait_started
    while clock() < upload_deadline:
        visible_names = set()
        busy = False
        polls += 1
        frames_read = frame_errors = 0
        for asset_frame in page.frames[:8]:
            try:
                remaining_ms = int((upload_deadline-clock())*1000)
                if remaining_ms <= 0:
                    busy, frame_errors = True, frame_errors + 1
                    break
                state = await asyncio.wait_for(asset_frame.locator('body').evaluate("""(body) => {
                    const visible = el => {
                        const r = el.getBoundingClientRect();
                        const s = getComputedStyle(el);
                        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
                    };
                    const text = Array.from(body.querySelectorAll('*'))
                        .filter(el => visible(el) && el.children.length === 0)
                        .map(el => (el.textContent || '').trim()).filter(Boolean);
                    const busy = Array.from(body.querySelectorAll('[role="progressbar"], [aria-busy="true"]'))
                        .some(visible);
                    return { text: text.slice(0, 600), busy };
                }""", timeout=min(1500, remaining_ms)), timeout=min(1.5, remaining_ms/1000))
                frames_read += 1
                busy = busy or state['busy']
                for name in expected_names:
                    if any(name.lower() in label.lower() for label in state['text']):
                        visible_names.add(name)
            except Exception:
                busy = True
                frame_errors += 1
        if expected_names.issubset(visible_names) and not busy:
            stable_reads += 1
        else:
            stable_reads = 0
        sample = (len(visible_names), busy, stable_reads, frame_errors)
        if sample != last_sample or clock() - last_logged >= 5 or clock() >= upload_deadline:
            trace.event("images_wait", "ok" if stable_reads >= 3 else "waiting", expected=len(expected_names), visible=len(visible_names), busy=busy, stable=stable_reads, required=3, polls=polls, frames=frames_read, frameErrors=frame_errors, elapsedMs=int((clock()-wait_started)*1000), limitMs=int(timeout*1000))
            last_sample, last_logged = sample, clock()
        if stable_reads >= 3:
            break
        await page.wait_for_timeout(750)
    if stable_reads < 3:
        trace.event("images_wait", "error", expected=len(expected_names), visible=len(visible_names),
                    busy=busy, stable=stable_reads, required=3, polls=polls,
                    frames=frames_read, frameErrors=frame_errors,
                    elapsedMs=int((clock()-wait_started)*1000), limitMs=int(timeout*1000))
        raise RuntimeError('flow_images_not_ready')


async def inspect_settings(page, trace):
    """Best effort inspection. A drawer failure must not discard a completed upload."""
    result = {'opened': False, 'vertical916': False, 'singleOutput': False,
              'settingsText': [], 'readyToGenerate': False,
              'referencesVerified': False, 'generationStarted': False, 'errorCode': None}
    trace.event('settings', 'started')
    phase, disabled, candidates, frames_read = 'find', False, [], 0
    try:
        async with asyncio.timeout(7):
            # Match the settings action itself, not project menus containing the word.
            name = re.compile(r'^\s*(?:configurações(?: do (?:agente|vídeo|video))?|(?:agent |video )?settings)\s*$', re.I)
            for frame in page.frames[:8]:
                controls = frame.get_by_role('button', name=name)
                for index in range(min(await controls.count(), 8)):
                    control = controls.nth(index)
                    if await control.is_visible():
                        if await control.is_enabled():
                            candidates.append(control)
                        else:
                            disabled = True
                frames_read += 1
            trace.event('settings', 'waiting', matches=len(candidates), frames=frames_read, disabled=disabled)
            if len(candidates) != 1:
                result['errorCode'] = ('flow_settings_ambiguous' if len(candidates) > 1 else
                                       'flow_settings_blocked' if disabled else 'flow_settings_not_found')
            else:
                phase = 'trial'
                trace.event('settings', 'waiting', trial=True, matches=1)
                # A blocked library overlay is evidence to report, not to force through.
                await candidates[0].click(trial=True, timeout=1200)
                phase = 'click'
                trace.event('settings', 'waiting', trial=False, matches=1)
                await candidates[0].click(timeout=1200)
                result['opened'] = True
                trace.event('settings', 'waiting', opened=True)
                phase = 'read'
                await page.wait_for_timeout(300)
                read_errors = 0
                for frame in page.frames[:8]:
                    try:
                        labels = await asyncio.wait_for(frame.locator('button, [role="radio"], [role="option"], [aria-checked], [aria-selected]').evaluate_all("""els => els.filter(e => { const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }).map(e=>({label:(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,65),selected:e.getAttribute('aria-checked')||e.getAttribute('aria-selected')||''})).filter(x=>/9:16|16:9|x1|x2|veo|modelo|model/i.test(x.label)).slice(0,25)"""), timeout=1.2)
                        result['settingsText'].extend(labels)
                    except Exception:
                        read_errors += 1
                result['vertical916'] = any('9:16' in x['label'] and x['selected'] == 'true' for x in result['settingsText'])
                result['singleOutput'] = any('x1' in x['label'].lower() and x['selected'] == 'true' for x in result['settingsText'])
                if not result['settingsText']:
                    result['errorCode'] = 'flow_settings_read_failed'
                trace.event('settings', 'error' if result['errorCode'] else 'ok', opened=True,
                            vertical916=result['vertical916'], singleOutput=result['singleOutput'], frameErrors=read_errors)
            if result['errorCode'] and phase == 'find':
                trace.event('settings', 'error', matches=len(candidates), disabled=disabled)
    except Exception as exc:
        result['errorCode'] = 'flow_settings_blocked' if phase in ('trial', 'click') else 'flow_settings_read_failed'
        trace.event('settings', 'error', opened=result['opened'], matches=len(candidates),
                    trial=phase == 'trial', clickTimedOut=type(exc).__name__ == 'TimeoutError')
    return result


async def editor_state(page, trace, prompt_field=None, names=None):
    """Current actionable controls, not arbitrary DOM text or input values."""
    totals = dict(includeVisible=0, includeEnabled=0, submitVisible=0, submitEnabled=0,
                  settingsCandidates=0, composerForms=0, composerFields=0, frameErrors=0)
    for frame in page.frames[:8]:
        try:
            state = await asyncio.wait_for(frame.locator('body').evaluate(r"""body => {
                const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
                const buttons=Array.from(body.querySelectorAll('button,[role="button"]')).filter(visible);
                const name=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||'').trim();
                const enabled=e=>!e.disabled&&e.getAttribute('aria-disabled')!=='true';
                const includes=buttons.filter(e=>/^(incluir no comando|add to prompt|include in prompt)$/i.test(name(e)));
                const submits=buttons.filter(e=>/^(enviar(?: comando)?|gerar(?: vídeo| video)?|send|submit|generate(?: video)?|arrow_forward)$/i.test(name(e)));
                const settings=buttons.filter(e=>/^(configurações(?: do (agente|vídeo|video))?|(?:agent |video )?settings)$/i.test(name(e)));
                const prompts=Array.from(body.querySelectorAll('[role="textbox"],[contenteditable="true"]')).filter(visible).filter(e=>/o que você quer criar|what do you want to create/i.test([e.getAttribute('aria-label'),e.getAttribute('data-placeholder'),e.getAttribute('placeholder')].join(' ')));
                return {includeVisible:includes.length,includeEnabled:includes.filter(enabled).length,submitVisible:submits.length,submitEnabled:submits.filter(enabled).length,settingsCandidates:settings.length,composerFields:prompts.length,composerForms:new Set(prompts.map(e=>e.closest('form,[role="form"]')).filter(Boolean)).size};
            }""", timeout=1200), timeout=1.4)
            for key, value in state.items():
                if key in totals and type(value) is int:
                    totals[key] += value
        except Exception:
            totals['frameErrors'] += 1
    trace.event('inspection', **totals)
    return totals


async def include_references(page, image_files, prompt_field, trace):
    """Include expected Flow library previews one at a time, without generating."""
    result = {'included': False, 'verified': False, 'errorCode': None}
    trace.next_action = 'select_images'
    trace.event('references', 'started', expected=len(image_files))
    phase = 'select'
    included = 0

    async def editor_evidence():
        # The composer is a div in Flow, not necessarily a form.
        return await prompt_field.evaluate(r"""(textbox,names) => {
            const form=textbox.closest('form,[role="form"]');
            const root=form || textbox.parentElement?.parentElement?.parentElement;
            if(!root)return {attachmentMatches:0,composerFound:false};
            const nodes=Array.from(root.querySelectorAll('img,[data-attachment],[aria-label],[title]'))
                .filter(el=>!el.closest('[role="dialog"],[role="listbox"]'));
            const labels=nodes.map(el=>[el.getAttribute('alt'),el.getAttribute('title'),
                el.getAttribute('aria-label')].filter(Boolean).join(' ').toLowerCase());
            return {composerFound:true,attachmentMatches:names.filter(n=>
                labels.some(label=>label.includes(n.toLowerCase()))).length};
        }""", [item['name'] for item in image_files], timeout=1800)

    async def find_include():
        found = []
        for frame in page.frames[:8]:
            controls = frame.get_by_role('button', name=re.compile(
                r'^\\s*(incluir no comando|add to prompt|include in prompt)\\s*$', re.I))
            for index in range(min(await controls.count(), 6)):
                control = controls.nth(index)
                if await control.is_visible() and await control.is_enabled():
                    found.append(control)
        return found

    try:
        # The upload wait has already confirmed all filenames are stable.
        # Flow shows one selected preview and one Include button, not
        # necessarily a multi-select checkbox or aria-selected option.
        async with asyncio.timeout(75):
            for asset_index, item in enumerate(image_files, 1):
                phase = 'select'
                trace.next_action = 'select_images'
                # After Include, the library may close. Open it using the
                # existing attachment affordance if no resource list is visible.
                libraries = []
                for frame in page.frames[:8]:
                    locator = frame.get_by_role('listbox', name=re.compile(
                        r'^(lista de recursos|asset list|assets)$', re.I))
                    for index in range(min(await locator.count(), 3)):
                        library = locator.nth(index)
                        if await library.is_visible():
                            libraries.append(library)
                if not libraries:
                    for frame in page.frames[:8]:
                        for selector in ('button[aria-label*="Adicionar"]',
                                         'button[aria-label*="Add"]',
                                         'button[title*="Adicionar"]',
                                         'button[title*="Add"]'):
                            trigger = frame.locator(selector)
                            if await trigger.count() == 1 and await trigger.is_visible():
                                await trigger.click(timeout=2500)
                                break
                    await page.wait_for_timeout(500)
                    for frame in page.frames[:8]:
                        locator = frame.get_by_role('listbox', name=re.compile(
                            r'^(lista de recursos|asset list|assets)$', re.I))
                        for index in range(min(await locator.count(), 3)):
                            library = locator.nth(index)
                            if await library.is_visible():
                                libraries.append(library)
                if len(libraries) != 1:
                    result['errorCode'] = 'flow_reference_selection_unavailable'
                    return result

                # Resolve the exact filename using text, alt or title inside
                # the listbox, then its nearest option/button. This handles
                # image thumbnails whose accessible name is not the filename.
                library = libraries[0]
                shape = await library.evaluate(r"""(root,name) => {
                    const leaves=Array.from(root.querySelectorAll('*')).filter(el=>
                        el.children.length===0 && [el.textContent?.trim(),
                        el.getAttribute('alt'),el.getAttribute('title')].includes(name));
                    const targets=[...new Set(leaves.map(el=>
                        el.closest('[role="option"]') || el.closest('button,[role="button"]'))
                        .filter(Boolean))];
                    return {matches:leaves.length,targets:targets.length,
                        options:root.querySelectorAll('[role="option"]').length};
                }""", item['name'], timeout=1800)
                trace.event('references', 'waiting', assetIndex=asset_index, **shape)
                if shape['targets'] != 1:
                    result['errorCode'] = 'flow_reference_selection_unavailable'
                    return result
                # The element may be an option containing an image with alt
                # but no text. Identify it by the same exact DOM predicate.
                # Use a temporary DOM marker scoped to this one library;
                # it never leaves the browser or touches other assets.
                marker = 'data-mv-reference-target'
                await library.evaluate(r"""(root,args) => {
                    const [name,marker]=args;
                    const leaves=Array.from(root.querySelectorAll('*')).filter(el=>
                        el.children.length===0 && [el.textContent?.trim(),
                        el.getAttribute('alt'),el.getAttribute('title')].includes(name));
                    const target=leaves[0]?.closest('[role="option"]') ||
                        leaves[0]?.closest('button,[role="button"]');
                    if(target)target.setAttribute(marker,'yes');
                }""", [item['name'], marker], timeout=1800)
                target = library.locator('[data-mv-reference-target="yes"]')
                if await target.count() != 1:
                    result['errorCode'] = 'flow_reference_selection_unavailable'
                    return result
                try:
                    await target.click(trial=True, timeout=2500)
                    await target.click(timeout=2500)
                finally:
                    await library.evaluate("(root,marker) => root.querySelectorAll('['+marker+']').forEach(el=>el.removeAttribute(marker))", marker, timeout=1800)

                # A preview with the matching image and an enabled Include
                # control is the Flow-specific evidence of readiness.
                phase = 'include_find'
                includes = await find_include()
                trace.event('references', 'waiting', assetIndex=asset_index,
                            includeEnabled=len(includes))
                if len(includes) != 1:
                    result['errorCode'] = 'flow_reference_include_unavailable'
                    return result
                phase = 'include_click'
                await includes[0].click(trial=True, timeout=2500)
                # Never retry an uncertain click; duplication is worse than
                # returning an explicit uncertain state.
                await includes[0].click(timeout=3500)
                included += 1
                result['included'] = trace.references_included = True
                trace.event('references', 'waiting', assetIndex=asset_index,
                            referencesIncluded=True, includedCount=included)
                phase = 'verify'
                trace.next_action = 'verify_references'
                # Filename evidence may be absent in Flow's chips; never
                # claim verification based only on library visibility.
                for _ in range(5):
                    evidence = await editor_evidence()
                    trace.event('references', 'waiting', assetIndex=asset_index, **evidence)
                    if evidence['attachmentMatches'] >= included:
                        break
                    await page.wait_for_timeout(400)
                else:
                    result['errorCode'] = 'flow_references_unverified'
                    return result

            evidence = await editor_evidence()
            if evidence['attachmentMatches'] == len(image_files):
                result['verified'] = trace.references_verified = True
                trace.next_action = 'inspect_settings'
                trace.event('references', referencesIncluded=True, referencesVerified=True)
            else:
                result['errorCode'] = 'flow_references_unverified'
    except Exception:
        result['errorCode'] = ('flow_reference_include_uncertain' if phase == 'include_click'
                               else 'flow_references_unverified' if phase == 'verify'
                               else 'flow_reference_include_unavailable' if phase == 'include_find'
                               else 'flow_reference_selection_unavailable')
    finally:
        if result['errorCode']:
            trace.event('references', 'error', referencesIncluded=result['included'],
                        referencesVerified=result['verified'])
    return result
