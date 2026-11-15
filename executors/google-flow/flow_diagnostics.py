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
                     'fileChooser', 'fileInput', 'libraryOpened', 'dialogVisible'))
REASONS = frozenset(('flow_page_not_active', 'flow_project_not_active',
    'prompt_field_not_unique', 'new_project_button_not_found', 'image_input_not_found',
    'flow_upload_action_not_found', 'flow_file_chooser_unavailable',
    'flow_images_not_ready', 'image_rights_dialog_unresolved',
    'image_rights_confirmation_required', 'no_context', 'navigation_failed',
    'references_not_implemented', 'inspection_only'))


class FlowDiagnostics:
    def __init__(self, trace_id, action, revision, clock=time.monotonic, emit=print):
        self.trace_id = trace_id if isinstance(trace_id, str) and re.fullmatch(r'[0-9a-f-]{36}', trace_id) else str(uuid.uuid4())
        self.action = action if action in ('navigate', 'inspect', 'create-project', 'inspect-editor', 'stage-prompt', 'prepare-draft', 'prepare-image', 'inspect-settings') else 'inspect'
        self.revision = revision
        self.clock, self.emit, self.started = clock, emit, clock()
        self.events, self.stage = [], 'request'

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
                'referencesVerified': False, 'events': list(self.events)}


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
