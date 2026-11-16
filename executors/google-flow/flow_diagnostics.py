"""Bounded telemetry: only fixed codes, counters and booleans leave the executor."""
import json
import asyncio
import re
import time
import uuid

STAGES = frozenset(('request', 'connect', 'project', 'prompt', 'upload', 'rights',
                    'images_wait', 'settings', 'references', 'generation', 'inspection', 'confirmation', 'finished'))
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
                     'assetCheckboxParents', 'libraryOptions', 'libraryCheckboxes', 'arrowCandidates', 'submitClicked',
                     'assetTargets', 'assetMatches', 'prefixLength', 'selectionClickFailed',
                      'errorVisible', 'retryVisible', 'errorObservedMs', 'errorFramesRead',
                      'creditDialogVisible', 'responseObservedMs', 'responseFramesRead', 'responseUnconfirmed', 'dialogVisible', 'checkboxVisible', 'checkboxChecked', 'confirmButtonVisible', 'confirmButtonEnabled', 'creditMentioned', 'framesRead', 'approvalVisible', 'approveButtonVisible', 'alwaysApproveVisible', 'rejectButtonVisible', 'creditCostMentioned'))
REASONS = frozenset(('flow_page_not_active', 'flow_project_not_active',
    'prompt_field_not_unique', 'new_project_button_not_found', 'image_input_not_found',
    'flow_upload_action_not_found', 'flow_file_chooser_unavailable',
    'flow_images_not_ready', 'image_rights_dialog_unresolved',
    'image_rights_confirmation_required', 'no_context', 'navigation_failed',
    'references_not_implemented', 'inspection_only', 'flow_settings_not_found',
    'flow_settings_ambiguous', 'flow_settings_blocked', 'flow_settings_read_failed',
    'flow_reference_selection_unavailable', 'flow_reference_selection_unconfirmed',
    'flow_reference_include_unavailable', 'flow_reference_include_uncertain',
    'flow_references_unverified', 'flow_draft_ready',
    'flow_generate_button_unavailable', 'flow_generation_click_uncertain',
    'flow_generation_rejected', 'flow_generate_clicked',
    'flow_credit_confirmation_pending', 'flow_generation_response_unconfirmed'))


class FlowDiagnostics:
    def __init__(self, trace_id, action, revision, clock=time.monotonic, emit=print):
        self.trace_id = trace_id if isinstance(trace_id, str) and re.fullmatch(r'[0-9a-f-]{36}', trace_id) else str(uuid.uuid4())
        self.action = action if action in ('navigate', 'inspect', 'create-project', 'inspect-editor', 'stage-prompt', 'prepare-draft', 'prepare-image', 'inspect-settings', 'click-generate') else 'inspect'
        self.revision = revision
        self.clock, self.emit, self.started = clock, emit, clock()
        self.events, self.stage = [], 'request'
        self.references_included, self.references_verified = False, False
        self.generate_clicked = False
        self.next_action = 'inspect_controls'
        self.git_commit = 'unknown'
        self.container_tag = 'unknown'
        self.session_tag = 'unknown'

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
                'executorRevision': self.revision, 'gitCommit': self.git_commit,
                'containerTag': self.container_tag, 'sessionTag': self.session_tag, 'elapsedMs': int((self.clock() - self.started) * 1000),
                'stopReason': reason if reason in REASONS else 'navigation_failed',
                'lastStage': self.stage, 'generationStarted': self.generate_clicked,
                'referencesIncluded': self.references_included,
                'referencesVerified': self.references_verified,
                'nextAction': self.next_action, 'events': list(self.events)}


async def wait_for_images(page, image_files, trace, clock=time.monotonic, timeout=15):
    """Observe library readiness briefly; never treat an unreadable frame as upload failure.

    The selection routine is the authoritative next interaction, and must run
    even if DOM inspection is unavailable through the remote browser.
    """
    expected_names = {item['name'] for item in image_files}
    stable_reads = 0
    started = clock()
    trace.event("images_wait", "started", expected=len(expected_names),
                limitMs=int(timeout * 1000), required=2)
    polls = 0
    while clock() - started < timeout:
        polls += 1
        visible_names = set()
        busy = False
        frames_read = frame_errors = indicator_count = 0
        # Read the main page first. Remote CDP can stall on every iframe;
        # bound the total observation rather than waiting 1.5s per frame.
        for frame in [page.main_frame] + [f for f in page.frames if f != page.main_frame][:2]:
            try:
                state = await asyncio.wait_for(frame.locator('body').evaluate("""(body) => {
                    const visible = el => {
                        const r=el.getBoundingClientRect(), s=getComputedStyle(el);
                        return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none';
                    };
                    const text=Array.from(body.querySelectorAll('*'))
                        .filter(el=>visible(el) && el.children.length===0)
                        .map(el=>(el.textContent||'').trim()).filter(Boolean);
                    const indicators=Array.from(body.querySelectorAll('[role="progressbar"],[aria-busy="true"]')).filter(visible);
                    return {text:text.slice(0,600), busy:indicators.length>0, indicatorCount:indicators.length};
                }""", timeout=1100), timeout=1.2)
                frames_read += 1
                busy = busy or state['busy']
                indicator_count += state['indicatorCount']
                for name in expected_names:
                    if any(name.lower() in label.lower() for label in state['text']):
                        visible_names.add(name)
            except Exception:
                frame_errors += 1
        stable_reads = stable_reads + 1 if expected_names.issubset(visible_names) and not busy else 0
        trace.event("images_wait", "ok" if stable_reads >= 2 else "waiting",
                    expected=len(expected_names), visible=len(visible_names),
                    busy=busy, indicatorCount=indicator_count, stable=stable_reads,
                    required=2, polls=polls, frames=frames_read,
                    frameErrors=frame_errors, elapsedMs=int((clock()-started)*1000),
                    limitMs=int(timeout*1000))
        if stable_reads >= 2:
            return
        if frames_read == 0 and polls >= 2:
            trace.event("images_wait", "skipped", reason="remote_frames_unreadable",
                        nextAction="select_images")
            return
        await page.wait_for_timeout(450)
    trace.event("images_wait", "skipped", reason="visual_readiness_unconfirmed",
                nextAction="select_images")


async def inspect_settings(page, trace):
    """Configure Flow agent defaults without starting media generation."""
    result = {'opened': False, 'vertical916': False, 'singleOutput': False,
              'settingsText': [], 'readyToGenerate': False,
              'referencesVerified': False, 'generationStarted': False, 'errorCode': None}
    trace.event('settings', 'started')
    phase = 'find'
    try:
        async with asyncio.timeout(24):
            candidates = []
            for frame in page.frames[:8]:
                buttons = frame.get_by_role('button', name=re.compile(
                    r'^\s*(?:configurações(?: do (?:agente|vídeo|video))?|(?:agent |video )?settings)\s*$', re.I))
                for i in range(min(await buttons.count(), 6)):
                    button = buttons.nth(i)
                    if await button.is_visible() and await button.is_enabled():
                        candidates.append(button)
            trace.event('settings', 'waiting', matches=len(candidates))
            if len(candidates) != 1:
                # The page has both a global gear and a composer settings
                # button. Prefer the one next to the prompt/send controls.
                nearby = []
                for candidate in candidates:
                    try:
                        distance = await candidate.evaluate(r"""el => {
                            const textbox=Array.from(el.ownerDocument.querySelectorAll('[role="textbox"]'))
                                .find(e=>/O que você quer criar|What do you want to create/i.test(e.getAttribute('aria-label')||''));
                            if(!textbox)return 1e9;
                            const a=el.getBoundingClientRect(),b=textbox.getBoundingClientRect();
                            // Compare the gear against the editor's lower-right
                            // controls, not the textbox's upper-left corner.
                            return Math.hypot(a.right-b.right,a.bottom-b.bottom);
                        }""", timeout=1000)
                        nearby.append((distance,candidate))
                    except Exception:
                        pass
                nearby.sort(key=lambda entry: entry[0])
                if len(nearby) >= 2 and nearby[0][0] + 80 < nearby[1][0]:
                    candidates = [nearby[0][1]]
                else:
                    result['errorCode'] = 'flow_settings_ambiguous' if candidates else 'flow_settings_not_found'
                    return result
            phase = 'open'
            await candidates[0].click(trial=True, timeout=1800)
            await candidates[0].click(timeout=1800)
            result['opened'] = True
            trace.event('settings', 'waiting', opened=True)
            phase = 'configure'
            panels = []
            for frame in page.frames[:8]:
                for heading in (frame.get_by_text('Configurações do agente', exact=True),
                                frame.get_by_text('Agent settings', exact=True)):
                    for i in range(min(await heading.count(), 3)):
                        if await heading.nth(i).is_visible():
                            panels.append((frame, heading.nth(i)))
            if len(panels) != 1:
                result['errorCode'] = 'flow_settings_read_failed'
                return result
            frame, heading = panels[0]
            # All controls are restricted to the settings panel and its
            # surrounding container. The video aspect ratio is separate
            # from the image aspect ratio.
            panel = heading.locator('xpath=ancestor::*[.//button[normalize-space()="Salvar"]][1]')
            if await panel.count() != 1:
                result['errorCode'] = 'flow_settings_read_failed'
                return result
            # Inspect headings and choices to avoid confusing the two 9:16
            # buttons. Use DOM positions only inside this panel.
            evidence = await panel.evaluate(r"""root => {
                const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
                const elements=Array.from(root.querySelectorAll('button,[role="radio"],[role="button"]')).filter(visible);
                const names=elements.map(e=>(e.getAttribute('aria-label')||e.textContent||'').trim());
                const groups=Array.from(root.querySelectorAll('*')).filter(e=>e.children.length===0&&
                    /padrão da geração de imagens|padrão para geração de vídeo|confirmar antes de gerar/i.test(e.textContent||''));
                return {buttons:names.slice(0,35),sections:groups.map(e=>(e.textContent||'').trim()).slice(0,8)};
            }""", timeout=1800)
            trace.event('settings', 'waiting', buttons=len(evidence['buttons']),
                        sections=len(evidence['sections']))
            if len(evidence['sections']) < 3:
                result['errorCode'] = 'flow_settings_read_failed'
                return result
            # Set each option using the section label as its scope.
            for section_pattern, choice, occurrence in (
                (r'confirmar antes de gerar', 'Sempre', 0),
                (r'padrão da geração de imagens', '9:16', 0),
                (r'padrão da geração de imagens', 'x1', 0),
                (r'padrão para geração de vídeo', '9:16', 0),
            ):
                section = panel.get_by_text(re.compile(section_pattern, re.I))
                if await section.count() != 1:
                    result['errorCode'] = 'flow_settings_read_failed'
                    return result
                # A heading and its option buttons share a settings group.
                group = section.locator('xpath=..')
                target = group.get_by_text(choice, exact=True)
                if await target.count() != 1:
                    group = section.locator('xpath=../..')
                    target = group.get_by_text(choice, exact=True)
                if await target.count() != 1:
                    result['errorCode'] = 'flow_settings_read_failed'
                    return result
                await target.click(trial=True, timeout=1500)
                await target.click(timeout=1500)
            # Keep the displayed model unchanged (Nano Banana 2.1).
            phase = 'save'
            save = panel.get_by_role('button', name=re.compile(r'^\s*(salvar|save)\s*$', re.I))
            if await save.count() != 1 or not await save.is_enabled():
                result['errorCode'] = 'flow_settings_read_failed'
                return result
            await save.click(trial=True, timeout=1800)
            await save.click(timeout=1800)
            result['vertical916'] = True
            result['singleOutput'] = True
            result['settingsText'] = evidence['buttons']
            trace.event('settings', 'ok', opened=True, saved=True,
                        vertical916=True, singleOutput=True)
    except Exception as exc:
        result['errorCode'] = 'flow_settings_save_uncertain' if phase == 'save' else 'flow_settings_read_failed'
        trace.event('settings', 'error', opened=result['opened'], phase=phase,
                    errorType=type(exc).__name__)
    return result



async def click_generate_arrow(page, trace):
    """Click one verified composer send arrow, using the editor's own geometry."""
    trace.event('generation', 'started')
    candidates = []
    for frame in page.frames[:8]:
        try:
            buttons = frame.locator('button,[role="button"]')
            evidence = await frame.locator('body').evaluate(r"""body => {
                const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
                const label=e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.textContent].filter(Boolean).join(' ').trim();
                const buttons=Array.from(body.querySelectorAll('button,[role="button"]'));
                const prompts=Array.from(body.querySelectorAll('[role="textbox"],[contenteditable="true"]')).filter(visible).filter(e=>/o que você quer criar|what do you want to create/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' ')));
                if(prompts.length!==1)return {indices:[],reason:'prompt_not_unique',prompts:prompts.length};
                const p=prompts[0].getBoundingClientRect();
                const gears=buttons.filter(e=>visible(e)&&/^(configurações(?: do (?:agente|vídeo|video))?|(?:agent |video )?settings)$/i.test(label(e)));
                const nearbyGears=gears.map(e=>{const r=e.getBoundingClientRect();return {e,d:Math.hypot(r.right-p.right,r.bottom-p.bottom)}}).sort((a,b)=>a.d-b.d);
                const gear=nearbyGears[0]?.e;
                const g=gear?.getBoundingClientRect();
                const indices=buttons.map((e,i)=>({e,i})).filter(({e})=>{
                    if(e===gear||!visible(e)||e.disabled||e.getAttribute('aria-disabled')==='true')return false;
                    const r=e.getBoundingClientRect();
                    const hint=[label(e),e.getAttribute('data-testid'),e.querySelector('mat-icon')?.textContent,e.querySelector('svg')?.getAttribute('data-testid'),e.querySelector('svg')?.getAttribute('class')].filter(Boolean).join(' ');
                    const named=/send|submit|generate|gerar|enviar|arrow_forward|north|upward/i.test(hint);
                    const nearPrompt=Math.abs(r.bottom-p.bottom)<180&&Math.abs(r.right-p.right)<280;
                    const besideGear=!!g&&Math.abs((r.top+r.height/2)-(g.top+g.height/2))<=22&&r.left>=g.right-3&&r.left-g.right<=115;
                    const compact=r.width>=20&&r.width<=76&&r.height>=20&&r.height<=76;
                    return compact&&((named&&nearPrompt)||(besideGear&&(!label(e)||named)));
                }).map(({i})=>i);
                return {indices,reason:'ok',prompts:prompts.length,gears:gears.length};
            }""", timeout=4500)
            trace.event('generation', 'waiting', arrowCandidates=len(evidence['indices']),
                        settingsCandidates=evidence.get('gears', 0),
                        promptCandidates=evidence.get('prompts', 0))
            for index in evidence['indices']:
                candidates.append(buttons.nth(index))
        except Exception as exc:
            trace.event('generation', 'waiting', frameErrors=1,
                        errorType=type(exc).__name__)
    if len(candidates) != 1:
        trace.event('generation', 'blocked', arrowCandidates=len(candidates))
        return {'clicked': False, 'errorCode': 'flow_generate_button_unavailable'}
    try:
        await candidates[0].click(trial=True, timeout=2500)
        await candidates[0].click(timeout=3500)
        trace.generate_clicked = True
        trace.event('generation', 'ok', submitClicked=True)
        # Observe delayed non-ARIA Flow error cards without clicking Retry.
        observed_at = time.monotonic()
        for poll in range(5):
            if poll:
                await page.wait_for_timeout(950)
            readable = 0
            for frame in page.frames[:8]:
                try:
                    status = await frame.locator('body').evaluate(r"""root => {
                        const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
                        const text=e=>(e.innerText||e.textContent||'').trim();
                        const buttons=Array.from(root.querySelectorAll('button,[role="button"]')).filter(visible);
                        const retry=buttons.some(e=>/^(tentar de novo|tente novamente|try again|retry)$/i.test(text(e)));
                        const alerts=Array.from(root.querySelectorAll('[role="alert"],[role="alertdialog"],[aria-live],div,p,span')).filter(visible);
                        const error=alerts.some(e=>{const t=text(e);return t.length<180&&/algo deu errado|something went wrong|não foi possível gerar|failed to generate|generation failed/i.test(t)});
                        const dialogs=Array.from(root.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog')).filter(visible);
                        const creditWords=/créditos|créditos de ia|credits|aprovar|approve|confirmar|confirm|custo|cost/i;
                        const creditButtons=buttons.filter(e=>/^(aprovar|approve|confirmar|confirm|continuar|continue)$/i.test(text(e)));
                        const creditDialog=dialogs.some(e=>creditWords.test(text(e).slice(0,800))) ||
                          creditButtons.some(e=>{const panel=e.closest('[role="dialog"],[role="alertdialog"],dialog,section,article')||e.parentElement?.parentElement;return panel&&creditWords.test(text(panel).slice(0,1000))});
                        const processing=Array.from(root.querySelectorAll('[role="progressbar"],[aria-busy="true"]')).some(visible);
                        return {errorVisible:error,retryVisible:retry,creditDialog,processing};
                    }""", timeout=1500)
                    readable += 1
                    if status['creditDialog']:
                        trace.event('generation', 'ok', submitClicked=True,
                                    creditDialogVisible=True,
                                    responseObservedMs=int((time.monotonic()-observed_at)*1000),
                                    responseFramesRead=readable)
                        return {'clicked': True, 'errorCode': 'flow_credit_confirmation_pending'}
                    if status['errorVisible'] or status['retryVisible']:
                        trace.event('generation', 'error', submitClicked=True,
                                    errorVisible=status['errorVisible'],
                                    retryVisible=status['retryVisible'],
                                    errorObservedMs=int((time.monotonic()-observed_at)*1000),
                                    errorFramesRead=readable)
                        return {'clicked': True, 'errorCode': 'flow_generation_rejected'}
                except Exception:
                    trace.event('generation', 'waiting', frameErrors=1)
            trace.event('generation', 'waiting', errorVisible=False,
                        retryVisible=False, errorFramesRead=readable)
        trace.event('generation', 'waiting', responseUnconfirmed=True)
        return {'clicked': True, 'errorCode': 'flow_generation_response_unconfirmed'}
    except Exception as exc:
        trace.event('generation', 'error', errorType=type(exc).__name__)
        return {'clicked': False, 'errorCode': 'flow_generation_click_uncertain'}



async def observe_generation_confirmation(page, trace):
    """Read-only Flow chat approval/error observation; never capture page text or secrets."""
    summary = {'approvalVisible': False, 'approveButtonVisible': False,
               'alwaysApproveVisible': False, 'rejectButtonVisible': False,
               'creditCostMentioned': False, 'errorVisible': False,
               'retryButtonVisible': False, 'framesRead': 0, 'frameErrors': 0}
    # The Flow agent shows approval as a chat card, not necessarily a dialog.
    for frame in page.frames[:8]:
        try:
            state = await asyncio.wait_for(frame.locator('body').evaluate(r"""root => {
                const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
                const text=e=>(e.innerText||e.textContent||'').trim();
                const buttons=Array.from(root.querySelectorAll('button,[role="button"]')).filter(visible);
                const named=pattern=>buttons.some(e=>pattern.test(text(e).slice(0,90)));
                const approve=named(/^aprovar$|^approve$/i);
                const always=named(/^sempre aprovar no projeto$|^always approve (?:in|for) (?:this )?project$/i);
                const reject=named(/^rejeitar$|^reject$/i);
                const retry=named(/^tentar de novo$|^try again$|^retry$/i);
                const leaves=Array.from(root.querySelectorAll('p,span,div')).filter(e=>visible(e)&&e.children.length===0);
                const short=leaves.map(e=>text(e).slice(0,180));
                const credit=short.some(t=>/custa\s*\d+\s*créditos|costs?\s*\d+\s*credits/i.test(t));
                const error=short.some(t=>/algo deu errado|something went wrong|não foi possível gerar|generation failed/i.test(t));
                return {approvalVisible:approve&&(always||reject||credit),
                    approveButtonVisible:approve,alwaysApproveVisible:always,
                    rejectButtonVisible:reject,creditCostMentioned:credit,
                    errorVisible:error,retryButtonVisible:retry};
            }""", timeout=1800), timeout=2.5)
            summary['framesRead'] += 1
            for key in ('approvalVisible','approveButtonVisible','alwaysApproveVisible',
                        'rejectButtonVisible','creditCostMentioned','errorVisible','retryButtonVisible'):
                summary[key] = summary[key] or bool(state.get(key))
        except Exception:
            summary['frameErrors'] += 1
    trace.event('confirmation', 'ok', **summary)
    return summary


async def editor_state(page, trace, prompt_field=None, names=None):
    """Current actionable controls, not arbitrary DOM text or input values."""
    totals = dict(includeVisible=0, includeEnabled=0, submitVisible=0, submitEnabled=0,
                  settingsCandidates=0, composerForms=0, composerFields=0, nearbyButtons=0, nearbyEnabled=0,
                  iconOnlyButtons=0, arrowCandidates=0, arrowEnabled=0, frameErrors=0)
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
                // Icon-only send arrows have no accessible text; count nearby buttons
                // separately, without treating proximity as proof or clicking them.
                const nearby=buttons.filter(e=>prompts.some(p=>{
                    const a=e.getBoundingClientRect(),b=p.getBoundingClientRect();
                    return Math.abs(a.bottom-b.bottom)<180 && Math.abs(a.right-b.right)<280;
                }));
                const iconOnly=nearby.filter(e=>!name(e) && !!e.querySelector('svg,mat-icon,[class*="icon"]'));
                const arrows=nearby.filter(e=>/send|arrow_forward|north|upward|generate|gerar|enviar/i.test(
                    [name(e),e.getAttribute('data-testid'),e.querySelector('svg')?.getAttribute('data-testid'),
                     e.querySelector('svg')?.getAttribute('class'),e.querySelector('mat-icon')?.textContent].join(' ')));
                return {includeVisible:includes.length,includeEnabled:includes.filter(enabled).length,submitVisible:submits.length,submitEnabled:submits.filter(enabled).length,settingsCandidates:settings.length,composerFields:prompts.length,composerForms:new Set(prompts.map(e=>e.closest('form,[role="form"]')).filter(Boolean)).size,nearbyButtons:nearby.length,nearbyEnabled:nearby.filter(enabled).length,iconOnlyButtons:iconOnly.length,arrowCandidates:arrows.length,arrowEnabled:arrows.filter(enabled).length};
            }""", timeout=1200), timeout=1.4)
            for key, value in state.items():
                if key in totals and type(value) is int:
                    totals[key] += value
        except Exception:
            totals['frameErrors'] += 1
    trace.event('inspection', **totals)
    return totals


async def include_references(page, image_files, prompt_field, trace):
    """Multi-select the uploaded batch and verify attachment count without generating."""
    result = {'included': False, 'verified': False, 'errorCode': None}
    trace.next_action = 'select_images'
    trace.event('references', 'started', expected=len(image_files))
    phase = 'select'
    included = 0

    async def editor_evidence():
        # Flow renders thumbnail chips without the original filename.
        # Count only removable images in the local composer, not gallery media.
        return await prompt_field.evaluate(r"""textbox => {
            const form=textbox.closest('form,[role="form"]');
            const root=form || textbox.parentElement?.parentElement?.parentElement;
            if(!root)return {attachmentMatches:0,attachmentCount:0,composerFound:false};
            const imgs=Array.from(root.querySelectorAll('img')).filter(el=>
                !el.closest('[role="dialog"],[role="listbox"]') &&
                el.getBoundingClientRect().width>0);
            const removable=imgs.filter(img=>{
                let el=img;
                for(let i=0;i<4 && el && el!==root;i++,el=el.parentElement){
                    if(el.querySelector('button[aria-label*="emover"],button[aria-label*="emove"],button[title*="emover"],button[title*="emove"]'))return true;
                }
                return false;
            });
            return {composerFound:true,attachmentMatches:removable.length,
                    attachmentCount:removable.length,visibleImages:imgs.length};
        }""", timeout=1800)

    async def find_include():
        # The Flow button changes its accessible name with the selection:
        # "Adicionar 3 itens ao comando" instead of "Incluir no comando".
        expected = len(image_files)
        found = []
        seen = []
        for frame in page.frames[:8]:
            controls = frame.get_by_role('button', name=re.compile(
                r'(?:incluir|adicionar|add|include).*?(?:comando|prompt)', re.I))
            for index in range(min(await controls.count(), 12)):
                control = controls.nth(index)
                if not await control.is_visible():
                    continue
                label = (await control.inner_text(timeout=1000)).strip()
                if not label:
                    label = (await control.get_attribute('aria-label') or '').strip()
                seen.append(label[:100])
                quantity = re.search(r'\b(\d+)\s+(?:itens?|items?)\b', label, re.I)
                if quantity:
                    if int(quantity.group(1)) != expected:
                        continue
                    if not re.search(r'(?:ao comando|to (?:the )?prompt)', label, re.I):
                        continue
                elif expected != 1:
                    # With multiple assets, only the explicit matching
                    # quantity is safe to click.
                    continue
                elif not re.fullmatch(
                    r'\s*(?:incluir no comando|adicionar ao comando|add to prompt|include in prompt)\s*',
                    label, re.I):
                    continue
                if await control.is_enabled():
                    found.append(control)
        trace.event('references', 'waiting', includeLabels=seen[:8],
                    expectedIncludeCount=expected, includeEnabled=len(found))
        return found

    try:
        # The upload wait already confirmed that all uploaded images are ready.
        # Flow supports long-press to enter multi-selection. Select the entire
        # batch before pressing Include exactly once.
        async with asyncio.timeout(75):
            libraries = []
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
            library = libraries[0]
            marker = 'data-mv-reference-target'
            selected = []
            for asset_index, item in enumerate(image_files, 1):
                phase = 'select'
                trace.next_action = 'select_images'
                shape = await library.evaluate(r"""(root,args) => {
                    const [name,marker]=args;
                    root.querySelectorAll('['+marker+']').forEach(el=>el.removeAttribute(marker));
                    // Flow sometimes truncates filenames in the rendered
                    // library while retaining their unique product prefix.
                    const values=el=>[el.textContent?.trim(),el.getAttribute('alt'),
                        el.getAttribute('title'),el.getAttribute('aria-label')]
                        .filter(Boolean);
                    const prefix=name.replace(/\.[^.]+$/,'').slice(0,18);
                    const options=Array.from(root.querySelectorAll('[role="option"]'));
                    const visible=el=>{const r=el.getBoundingClientRect(),st=getComputedStyle(el);return r.width>0&&r.height>0&&st.display!=='none'&&st.visibility!=='hidden'};
                    const normalized=v=>(v||'').trim().toLocaleLowerCase();
                    const exact=el=>[el,...el.querySelectorAll('*')].some(n=>values(n).some(v=>normalized(v)===normalized(name)));
                    const uniquelyNamed=el=>[el,...el.querySelectorAll('*')].some(n=>values(n).some(v=>normalized(v).includes(normalized(name))));
                    const exactOptions=options.filter(el=>visible(el)&&exact(el));
                    const fullNameOptions=options.filter(el=>visible(el)&&uniquelyNamed(el));
                    const nodes=[...new Set([...options,...root.querySelectorAll('button,[role="button"],img,[role="img"]')])];
                    const matching=nodes.filter(option=>{
                        const all=[option,...option.querySelectorAll('*')];
                        return all.some(el=>values(el).some(value=>
                            value===name || value.includes(name) ||
                            (prefix.length>=12 && value.includes(prefix))));
                    });
                    // A unique image can also be represented by a button inside
                    // an option. Resolve it to the enclosing selectable option.
                    const targets=[...new Set(matching.map(el=>el.closest('[role="option"]')||el.closest('button,[role="button"]')||el))];
                    // Distinct nested matches often describe the SAME asset.
                    // Prefer a unique matching option; otherwise a unique
                    // clickable button, rather than an image inside its button.
                    const optionTargets=targets.filter(el=>el.matches('[role="option"]'));
                    const buttonTargets=targets.filter(el=>el.matches('button,[role="button"]'));
                    // Prefer exact/full filename within a visible option before
                    // using truncated prefixes that can collide across uploads.
                    // When the visible gallery consists exactly of the uploaded
                    // batch, use its visual order as a last-resort disambiguator.
                    // This is the same option-click/long-press/Ctrl-click path for
                    // one, two and three images, not a special two-image flow.
                    const visibleOptions=options.filter(visible);
                    const batchIndex=args[2],batchSize=args[3];
                    const galleryOrder=visibleOptions.length===batchSize &&
                        batchIndex>=0 && batchIndex<batchSize ? visibleOptions[batchIndex] : null;
                    const chosen=exactOptions.length===1?exactOptions[0]:
                        fullNameOptions.length===1?fullNameOptions[0]:
                        optionTargets.length===1?optionTargets[0]:
                        buttonTargets.length===1?buttonTargets[0]:
                        targets.length===1?targets[0]:galleryOrder;
                    if(chosen)chosen.setAttribute(marker,'yes');
                    return {matches:matching.length,targets:chosen?1:targets.length,
                        libraryOptions:options.length, visibleOptions:visibleOptions.length, selectionMethod:chosen===galleryOrder?'gallery_order':chosen?'filename':'ambiguous', exactOptions:exactOptions.length, fullNameOptions:fullNameOptions.length, prefixLength:prefix.length,
                        assetMatches:matching.length, assetTargets:targets.length};
                }""", [item['name'],marker,asset_index-1,len(image_files)], timeout=1800)
                trace.event('references', 'waiting', assetIndex=asset_index, **shape)
                if shape['targets'] != 1:
                    result['errorCode'] = 'flow_reference_selection_unavailable'
                    return result
                target = library.locator('[data-mv-reference-target="yes"]')
                if await target.count() != 1:
                    result['errorCode'] = 'flow_reference_selection_unavailable'
                    return result
                await target.click(trial=True, timeout=2500)
                if asset_index == 1 and len(image_files) > 1:
                    # Playwright's click delay holds the pointer down before
                    # releasing it, matching the tested Flow gesture.
                    await target.click(delay=950, timeout=4000)
                else:
                    # Keep the multi-selection active while adding items.
                    await target.click(modifiers=['Control'], timeout=2500)
                selected.append(item['name'])
                trace.event('references', 'waiting', assetIndex=asset_index,
                            longPress=(asset_index == 1 and len(image_files) > 1),
                            ctrlClick=(asset_index > 1), selectedAttempts=len(selected))
                await library.evaluate("(root,marker) => root.querySelectorAll('['+marker+']').forEach(el=>el.removeAttribute(marker))", marker, timeout=1800)
            # A selection attempt is not proof of multi-selection. Inspect
            # the options for semantic selection and stop if fewer are marked.
            evidence = await library.evaluate(r"""(root,names) => {
                const selected=Array.from(root.querySelectorAll('[role="option"]')).filter(el=>
                    el.getAttribute('aria-selected')==='true' ||
                    el.getAttribute('aria-checked')==='true' ||
                    el.getAttribute('data-state')==='selected' ||
                    el.classList.contains('selected') ||
                    el.querySelector('[aria-checked="true"],[aria-selected="true"],[data-state="selected"]'));
                const matched=names.filter(name=>selected.some(el=>
                    (el.textContent||'').includes(name) ||
                    Array.from(el.querySelectorAll('[alt],[title]')).some(child=>
                        child.getAttribute('alt')===name || child.getAttribute('title')===name)));
                return {semanticSelected:selected.length,expectedSelected:matched.length};
            }""", [item['name'] for item in image_files], timeout=1800)
            trace.event('references', 'waiting', **evidence)
            if evidence['expectedSelected'] != len(image_files):
                # Flow may expose selection only visually. An unconfirmed
                # semantic state is not proof of failure. Click Include once
                # and verify the *actual* number of composer attachments.
                trace.event('references', 'waiting', selectionSemanticsUnavailable=True,
                            expected=len(image_files))
            phase = 'include_find'
            includes = await find_include()
            trace.event('references', 'waiting', includeEnabled=len(includes))
            if len(includes) != 1:
                result['errorCode'] = 'flow_reference_include_unavailable'
                return result
            phase = 'include_click'
            await includes[0].click(trial=True, timeout=2500)
            await includes[0].click(timeout=3500)
            result['included'] = trace.references_included = True
            trace.event('references', 'waiting', referencesIncluded=True,
                        selectedExpected=len(image_files))
            phase = 'verify'
            trace.next_action = 'verify_references'
            # Keep the synchronous RPC short; the client may time out before
            # settings and Generate if attachment verification takes too long.
            for _ in range(3):
                evidence = await editor_evidence()
                trace.event('references', 'waiting', **evidence)
                if evidence['attachmentMatches'] >= len(image_files):
                    result['verified'] = trace.references_verified = True
                    trace.next_action = 'inspect_settings'
                    trace.event('references', referencesIncluded=True,
                                referencesVerified=True)
                    return result
                await page.wait_for_timeout(400)
            result['errorCode'] = 'flow_references_unverified'
    except Exception:
        trace.event('references', 'waiting', selectionClickFailed=(phase == 'select'))
        result['errorCode'] = ('flow_reference_include_uncertain' if phase == 'include_click'
                               else 'flow_references_unverified' if phase == 'verify'
                               else 'flow_reference_include_unavailable' if phase == 'include_find'
                               else 'flow_reference_selection_unavailable')
    finally:
        if result['errorCode']:
            trace.event('references', 'error', referencesIncluded=result['included'],
                        referencesVerified=result['verified'])
    return result
