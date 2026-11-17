"""Private browser control prototype. Never expose raw VNC or CDP to the Internet."""
import asyncio
import base64
import re
import subprocess
import hmac
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlsplit
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from playwright.async_api import async_playwright

SECRET = os.getenv("MV_BROWSER_CONTROL_SECRET", "")
PROFILE = os.getenv("MV_BROWSER_PROFILE_DIR", "/data/browser/chrome-official")
lock = asyncio.Lock()
view_tickets = {}
active_viewers = 0
chrome_process = None
context = None

# Fixed-code diagnostic ring. No prompts, URLs, cookies, secrets or exception text.
DIAGNOSTIC_CODES = frozenset(("chrome_started", "chrome_already_running", "chrome_stopped",
    "chrome_exited", "chrome_start_failed", "chrome_not_running", "viewer_ticket_issued",
    "viewer_rejected", "viewer_connected", "viewer_disconnected", "viewer_proxy_failed",
    "stage_started", "stage_completed", "stage_failed", "stage_prompt_filled", "stage_upload_failed",
    "click_new_project", "click_prompt", "click_add_elements", "click_upload", "click_settings", "click_generate", "click_rights", "click_reference", "click_include",
    "add_elements_not_found", "upload_not_found", "upload_incomplete", "reference_wait_started",
    "reference_click_confirmed", "reference_selection_finished", "include_button_ready",
    "service_started", "service_stopped"))
diagnostic_events = []

def record_event(code):
    if code not in DIAGNOSTIC_CODES:
        return
    event = {"code": code, "at": int(time.time())}
    diagnostic_events.append(event)
    del diagnostic_events[:-40]
    print("mv_browser_event " + __import__("json").dumps(event), flush=True)

def diagnostic_snapshot():
    return {"running": chrome_running(),
            "processExited": chrome_process is not None and chrome_process.poll() is not None,
            "events": list(diagnostic_events[-20:])}

def authorize(request: Request):
    if len(SECRET) < 32 or not hmac.compare_digest(
        request.headers.get("authorization", ""), "Bearer " + SECRET
    ):
        raise HTTPException(401, "unauthorized")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if len(SECRET) < 32:
        raise RuntimeError("MV_BROWSER_CONTROL_SECRET must contain at least 32 characters")
    origin = os.getenv("MV_BROWSER_PUBLIC_ORIGIN", "")
    parsed = urlsplit(origin)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise RuntimeError("MV_BROWSER_PUBLIC_ORIGIN must be an exact HTTPS origin")
    record_event("service_started")
    yield
    record_event("service_stopped")
    await stop_browser()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount('/novnc', StaticFiles(directory='/usr/share/novnc', check_dir=False), name='novnc')

def chrome_running():
    return chrome_process is not None and chrome_process.poll() is None

async def stop_browser():
    global chrome_process
    view_tickets.clear()
    if chrome_process is not None:
        if chrome_running():
            chrome_process.terminate()
            try:
                await asyncio.wait_for(asyncio.to_thread(chrome_process.wait), timeout=12)
            except asyncio.TimeoutError:
                chrome_process.kill()
                await asyncio.to_thread(chrome_process.wait)
        chrome_process = None

@app.get("/health")
async def health(request: Request):
    authorize(request)
    return {"service": "chrome", "ready": chrome_running(), "configured": len(SECRET) >= 32}

@app.post("/session/start")
async def start(request: Request):
    global chrome_process
    authorize(request)
    async with lock:
        if chrome_running():
            record_event("chrome_already_running")
            return {"status": "already_running"}
        if chrome_process is not None:
            await stop_browser()
        try:
            os.makedirs(PROFILE, mode=0o700, exist_ok=True)
            # Open a regular Chrome GUI independently of Playwright.
            # Never enable an unauthenticated remote-debugging port.
            chrome_process = subprocess.Popen([
                "/opt/google/chrome/chrome", "--no-sandbox",
                "--user-data-dir=" + PROFILE,
                "--no-first-run", "--no-default-browser-check",
                "--window-size=1280,800",
                "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9222",
                "https://flow.google.com/"
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            await asyncio.sleep(2)
            if not chrome_running():
                record_event("chrome_exited")
                raise RuntimeError("chrome_exited")
        except Exception:
            record_event("chrome_start_failed")
            await stop_browser()
            raise HTTPException(503, "browser_start_failed")
        record_event("chrome_started")
        return {"status": "running"}

@app.post("/session/stop")
async def stop(request: Request):
    authorize(request)
    async with lock:
        await stop_browser()
    return {"status": "stopped"}

@app.get("/session/status")
async def status(request: Request):
    authorize(request)
    return {"running": chrome_running(), "pages": None, "diagnostics": diagnostic_snapshot()}

@app.get("/session/inspect")
async def inspect(request: Request):
    """Inspect Flow controls, not page contents or account information."""
    authorize(request)
    if not chrome_running():
        record_event("chrome_not_running")
        raise HTTPException(409, "browser_not_running")
    async with lock:
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                pages = [p for ctx in browser.contexts for p in ctx.pages
                         if not p.is_closed() and p.url.startswith("https://flow.google.com/")]
                if not pages:
                    raise HTTPException(409, "flow_page_not_active")
                page = pages[0]
                controls = []
                for frame in page.frames[:8]:
                    found = await frame.locator('button, [role="button"], [role="dialog"], [role="menuitem"], input[type="file"], [role="textbox"], textarea').evaluate_all("""elements => elements.slice(0, 120).map(el => {
                      const r = el.getBoundingClientRect();
                      const style = getComputedStyle(el);
                      const visible = r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                      const role = el.getAttribute('role') || el.tagName.toLowerCase();
                      const type = el.getAttribute('type') || '';
                      const label = (el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || '').slice(0, 100);
                      return {role, type, label, visible, enabled: !el.disabled && el.getAttribute('aria-disabled') !== 'true'};
                    })""")
                    # Only allow structural data. Labels may contain private content,
                    # so do not send them outside the Modal container.
                    for item in found:
                        controls.append({key: len(controls), role: item["role"][:32],
                                         type: item["type"][:24],
                                         visible: bool(item["visible"]),
                                         enabled: bool(item["enabled"])})
                return {"running": True, "inspectionAvailable": True,
                        "flowProjectOpen": page.url.startswith("https://flow.google.com/project/"),
                        "frameCount": min(len(page.frames), 8), "controls": controls[:120]}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(502, "inspection_failed") from None


# Per-process semantic locator cache. Never persist page text or coordinates.
# Revalidate on every use; discard stale locators and rescan when UI changes.
FLOW_LOCATORS = {
    "new_project": [
        ("role", "button", r"novo projeto|new project"),
        ("text", None, r"^\\s*(novo projeto|new project)\\s*$"),
    ],
    "prompt": [
        ("css", '[role="textbox"][data-placeholder], [role="textbox"][aria-label], [contenteditable="true"][data-placeholder], [contenteditable="true"][aria-label], [contenteditable="true"][placeholder]', r"o que você quer criar|what do you want to create"),
        ("css", 'textarea[placeholder], textarea[aria-label]', r"o que você quer criar|what do you want to create"),
    ],
    "upload": [
        ("css", 'input[type="file"]', None),
        ("role", "button", r"fazer upload|upload|adicionar mídia|add media"),
    ],
}
locator_cache = {}

async def resolve_flow_control(page, purpose):
    """Prefer cached semantic strategy; rediscover visible, unique controls if stale."""
    strategies = FLOW_LOCATORS[purpose]
    preferred = locator_cache.get(purpose)
    order = ([preferred] if preferred in strategies else []) + [s for s in strategies if s != preferred]
    for strategy in order:
        kind, selector, pattern = strategy
        found = []
        for frame in page.frames[:8]:
            if kind == "role":
                locator = frame.get_by_role(selector, name=re.compile(pattern, re.I))
            elif kind == "text":
                locator = frame.get_by_text(re.compile(pattern, re.I), exact=True)
            else:
                locator = frame.locator(selector)
            for idx in range(min(await locator.count(), 35)):
                item = locator.nth(idx)
                try:
                    # File inputs are commonly hidden; Playwright can still set files.
                    if purpose != "upload" or kind != "css":
                        if not await item.is_visible() or not await item.is_enabled():
                            continue
                    if purpose == "prompt":
                        label = await item.evaluate("""el => [el.getAttribute('aria-label'), el.getAttribute('data-placeholder'), el.getAttribute('placeholder')].filter(Boolean).join(' ')""")
                        if not re.search(pattern, label or "", re.I):
                            continue
                    found.append(item)
                except Exception:
                    continue
        if len(found) == 1:
            locator_cache[purpose] = strategy
            return found[0], kind
    locator_cache.pop(purpose, None)
    return None, None


# Manual teaching mode: metadata only, bounded in memory, no page text or inputs.
LEARNING_DIR = Path.home() / "Imagens-Treinamento"
learning_state = {"active": False, "events": []}

def clear_learning_images():
    if LEARNING_DIR.exists():
        for file in LEARNING_DIR.iterdir():
            if file.is_file() and re.fullmatch(r"imagem-[1-3]\\.(png|jpg|webp)", file.name):
                file.unlink()

LEARNING_SCRIPT = r"""(() => {
  if (window.__mvLearningListener) return;
  window.__mvLearningListener = e => {
    const el = e.target?.closest?.('button,[role="button"],[role="menuitem"],[role="tab"],[role="option"],input[type="file"]');
    if (!el || el.closest('input[type="password"]')) return;
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const label = (el.getAttribute('aria-label') || '').slice(0,80);
    const type = (el.getAttribute('type') || '').slice(0,30);
    window.__mvLearningEvents ||= [];
    if (window.__mvLearningEvents.length < 80) window.__mvLearningEvents.push({role,type,label});
  };
  document.addEventListener('click',window.__mvLearningListener,true);
})()"""

async def learning_browser_page(pw):
    browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
    pages = [p for ctx in browser.contexts for p in ctx.pages
             if not p.is_closed() and p.url.startswith("https://flow.google.com/")]
    if not pages:
        raise HTTPException(409, "flow_page_not_active")
    return pages[0]

@app.post("/session/learning/start")
async def learning_start(request: Request):
    authorize(request)
    if not chrome_running():
        raise HTTPException(409, "browser_not_running")
    raw = await request.body()
    if len(raw) > 3_800_000:
        raise HTTPException(413, "payload_too_large")
    try:
        import json
        payload = json.loads(raw or b"{}")
        supplied = payload.get("images", [])
        if not isinstance(supplied, list) or len(supplied) > 3 or (supplied and payload.get("imageRightsConfirmed") is not True):
            raise ValueError("invalid_images")
        prepared = []
        for idx, item in enumerate(supplied):
            mime, encoded = item.get("mime"), item.get("data")
            extensions = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
            if mime not in extensions or not isinstance(encoded, str):
                raise ValueError("invalid_image")
            data = base64.b64decode(encoded, validate=True)
            valid = (mime == "image/png" and data.startswith(bytes.fromhex("89504e470d0a1a0a"))) or (mime == "image/jpeg" and data.startswith(bytes.fromhex("ffd8ff"))) or (mime == "image/webp" and data.startswith(b"RIFF") and data[8:12] == b"WEBP")
            if not valid:
                raise ValueError("invalid_image")
            prepared.append((f"imagem-{idx+1}.{extensions[mime]}", data))
        if sum(len(data) for _, data in prepared) > 2_500_000:
            raise ValueError("images_too_large")
    except (ValueError, TypeError, AttributeError, KeyError):
        raise HTTPException(400, "invalid_draft")
    async with lock:
        async with async_playwright() as pw:
            page = await learning_browser_page(pw)
            clear_learning_images()
            LEARNING_DIR.mkdir(parents=True, exist_ok=True)
            for filename, data in prepared:
                (LEARNING_DIR / filename).write_bytes(data)
            learning_state["events"] = []
            learning_state["active"] = True
            for frame in page.frames[:8]:
                try:
                    await frame.evaluate("delete window.__mvLearningEvents; if(window.__mvLearningListener) {document.removeEventListener('click',window.__mvLearningListener,true); delete window.__mvLearningListener}")
                    await frame.evaluate(LEARNING_SCRIPT)
                except Exception:
                    continue
    return {"active": True, "recorded": 0, "imageDirectory": str(LEARNING_DIR), "imagesAvailable": len(prepared)}

@app.get("/session/learning/status")
async def learning_status(request: Request):
    authorize(request)
    return {"active": learning_state["active"], "recorded": len(learning_state["events"])}

@app.post("/session/learning/stop")
async def learning_stop(request: Request):
    authorize(request)
    async with lock:
        if learning_state["active"] and chrome_running():
            async with async_playwright() as pw:
                page = await learning_browser_page(pw)
                for frame in page.frames[:8]:
                    try:
                        events = await frame.evaluate("""() => {
                          if(window.__mvLearningListener) document.removeEventListener('click',window.__mvLearningListener,true);
                          delete window.__mvLearningListener;
                          const events = window.__mvLearningEvents || [];
                          delete window.__mvLearningEvents;
                          return events;
                        }""")
                        for event in events[:80]:
                            if len(learning_state["events"]) >= 80: break
                            # Labels can contain private information; keep only role/type.
                            learning_state["events"].append({"role": str(event.get("role",""))[:32],
                                                             "type": str(event.get("type",""))[:24]})
                    except Exception:
                        continue
        learning_state["active"] = False
        clear_learning_images()
    return {"active": False, "recorded": len(learning_state["events"]),
            "events": learning_state["events"][-80:]}


@app.get("/session/diagnose")
async def diagnose_flow(request: Request):
    """Read-only inspection of Flow controls; never return text, URLs or credentials."""
    authorize(request)
    if not chrome_running():
        raise HTTPException(409, "browser_not_running")
    async with lock:
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                pages = [p for ctx in browser.contexts for p in ctx.pages if not p.is_closed()]
                page = next((p for p in pages if p.url.startswith("https://flow.google.com/")), None)
                if page is None:
                    return {"status": "flow_not_open", "projectOpen": False, "promptCandidates": 0, "fileInputs": 0, "uploadControls": 0}
                prompts = 0
                inputs = 0
                upload_controls = 0
                for frame in page.frames[:8]:
                    try:
                        prompts += await frame.locator('[role="textbox"][data-placeholder], [role="textbox"][aria-label], [contenteditable="true"][data-placeholder], [contenteditable="true"][aria-label], [contenteditable="true"][placeholder]').count()
                        inputs += await frame.locator('input[type="file"]').count()
                        upload_controls += await frame.get_by_role("button", name=re.compile("upload|add image|reference|enviar|imagem|adicionar", re.I)).count()
                    except Exception:
                        continue
                return {"status": "inspected", "projectOpen": page.url.startswith("https://flow.google.com/project/"),
                        "promptCandidates": min(prompts, 100), "fileInputs": min(inputs, 100),
                        "uploadControls": min(upload_controls, 100), "generationStarted": False}
        except Exception:
            raise HTTPException(409, "flow_interaction_failed") from None

async def show_red_click(page, locator, code):
    """Show a temporary red click target in the private browser viewer."""
    record_event(code)
    try:
        # Overlay is fixed in the element's frame, with pointer-events disabled.
        await locator.evaluate("""el => {
            const rect=el.getBoundingClientRect();
            const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
            const dot=document.createElement('div');
            dot.setAttribute('data-mv-click-indicator','true');
            dot.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;'+
                'left:'+x+'px;top:'+y+'px;transform:translate(-50%,-50%);'+
                'width:42px;height:42px;border:4px solid #ff0000;border-radius:50%;'+
                'background:rgba(255,0,0,.22);box-shadow:0 0 0 5px rgba(255,0,0,.15)';
            const cross=document.createElement('div');
            cross.style.cssText='position:absolute;left:50%;top:50%;width:12px;height:12px;'+
                'transform:translate(-50%,-50%);background:#ff0000;border-radius:50%';
            dot.appendChild(cross);
            document.documentElement.appendChild(dot);
            setTimeout(()=>dot.remove(),2500);
        }""", timeout=1500)
        await page.wait_for_timeout(120)
    except Exception:
        pass  # The click must still work if Flow rejects the visual overlay.


async def flow_upload_references(page, images, prompt_control):
    """Adapt the proven Flow library workflow to the private local Chromium CDP."""
    async def click_upload():
        for frame in page.frames[:8]:
            for locator in (
                frame.get_by_text(re.compile(r"^\s*Fazer upload\s*(?:\.\.\.|…)?\s*$", re.I)),
                frame.get_by_role("button", name=re.compile(r"fazer upload|upload", re.I)),
            ):
                for index in range(min(await locator.count(), 12)):
                    control = locator.nth(index)
                    if not await control.is_visible():
                        continue
                    try:
                        async with page.expect_file_chooser(timeout=3500) as event:
                            await show_red_click(page, control, "click_upload")
                            await control.click(timeout=3500)
                        await (await event.value).set_files(images, timeout=12000)
                        return True
                    except Exception:
                        for subframe in page.frames[:8]:
                            inputs = subframe.locator('input[type="file"]')
                            if await inputs.count() == 1:
                                await inputs.set_input_files(images, timeout=12000)
                                return True
        return False

    # Flow exposes "Fazer upload" only after opening "Adicionar elementos"
    # next to the composer. Resolve by accessible name, tooltip/title and
    # spatial proximity to the prompt; never click an unrelated Add control.
    async def open_add_elements():
        # Read one DOM snapshot per frame to avoid duplicate role/CSS locators.
        # Prioritize the Add elements button in the prompt's own composer.
        prompt_handle = await prompt_control.element_handle()
        candidates = []
        for frame in page.frames[:8]:
            try:
                controls = frame.locator('button,[role="button"]')
                for index in range(min(await controls.count(), 120)):
                    button = controls.nth(index)
                    if not await button.is_visible() or not await button.is_enabled():
                        continue
                    labels = await button.evaluate("""el => [
                        el.getAttribute('aria-label'),el.getAttribute('title'),
                        el.getAttribute('data-tooltip'),el.textContent
                    ].filter(Boolean).join(' ')""", timeout=1000)
                    if not re.search(r"adicionar elementos|add elements", labels or "", re.I):
                        continue
                    # In same frame, score by distance to the prompt.
                    try:
                        distance = await button.evaluate("""(el,prompt) => {
                            const a=el.getBoundingClientRect(),b=prompt.getBoundingClientRect();
                            return Math.hypot((a.left+a.right-b.left-b.right)/2,
                                              (a.top+a.bottom-b.top-b.bottom)/2);
                        }""", prompt_handle, timeout=1000)
                    except Exception:
                        distance = 100000
                    candidates.append((distance, button))
            except Exception:
                continue
        if not candidates:
            record_event("add_elements_not_found")
            return False
        candidates.sort(key=lambda item: item[0])
        if len(candidates)>1 and candidates[1][0]-candidates[0][0]<40:
            raise RuntimeError("flow_add_elements_ambiguous")
        await show_red_click(page, candidates[0][1], "click_add_elements")
        await candidates[0][1].click(timeout=4000)
        return True

    # Open the composer menu first, as observed in the live Flow interface.
    if not await open_add_elements():
        raise RuntimeError("flow_add_elements_not_found")
    if not await click_upload():
        record_event("upload_not_found")
        raise RuntimeError("flow_upload_action_not_found")

    # A file chooser accepting N files does NOT mean Flow finished uploading N.
    # Wait for each expected image in the asset library before selecting anything.
    names = [item["name"] for item in images]
    deadline = time.monotonic() + 75
    last_seen = set()
    stable = 0
    while time.monotonic() < deadline:
        # Rights confirmation can appear asynchronously, once per image.
        for frame in page.frames[:8]:
            try:
                agree = frame.get_by_role("button", name=re.compile(r"^\\s*Concordo\\s*$", re.I))
                dialog = frame.get_by_text("Direitos de uso desta imagem", exact=False)
                if await dialog.count() and await dialog.first.is_visible():
                    if await agree.count() != 1 or not await agree.is_enabled():
                        raise RuntimeError("flow_image_rights_unresolved")
                    await show_red_click(page, agree, "click_rights")
                    await agree.click(timeout=6000)
            except RuntimeError:
                raise
            except Exception:
                continue
        seen = set()
        for frame in page.frames[:8]:
            try:
                options = frame.locator('[role="option"]')
                # Require evidence of each named image, not just a finished
                # browser file chooser or one thumbnail.
                for name in names:
                    if await options.filter(has_text=name).count() or await frame.locator(
                        '[role="option"] [title], [role="option"] [alt]').evaluate_all(
                        "(els,name)=>els.some(el=>el.getAttribute('title')===name||el.getAttribute('alt')===name)", name):
                        seen.add(name)
            except Exception:
                continue
        if seen == set(names):
            stable += 1
            if stable >= 3:
                break
        else:
            stable = 0
        last_seen = seen
        await page.wait_for_timeout(700)
    if stable < 3:
        record_event("upload_incomplete")
        raise RuntimeError("flow_upload_incomplete")

    libraries = []
    for frame in page.frames[:8]:
        control = frame.get_by_role("listbox", name=re.compile(r"^(lista de recursos|asset list|assets)$", re.I))
        for i in range(min(await control.count(), 3)):
            if await control.nth(i).is_visible():
                libraries.append(control.nth(i))
    if len(libraries) != 1:
        raise RuntimeError("flow_reference_selection_unavailable")
    library = libraries[0]
    record_event("reference_wait_started")
    await page.wait_for_timeout(10000)
    for index, name in enumerate(names):
        # Never select an unrelated library asset by gallery position.
        target = library.locator('[role="option"]').filter(has_text=name)
        if await target.count() != 1:
            target = library.locator('[role="option"]').filter(
                has=library.locator('[title="' + name + '"], [alt="' + name + '"]'))
        if await target.count() != 1:
            raise RuntimeError("flow_reference_selection_unavailable")
        item = target.first
        await item.click(trial=True, timeout=2500)
        await show_red_click(page, item, "click_reference")
        # Every reference needs a deliberate press-and-hold, not only the first.
        # Keep Ctrl on subsequent images to preserve the existing multi-select.
        if index > 0:
            await item.click(modifiers=["Control"], delay=1100, timeout=6000)
        else:
            await item.click(delay=1100, timeout=6000)
        record_event("reference_click_confirmed")
        await page.wait_for_timeout(900)
    record_event("reference_selection_finished")

    # Flow may render the include action only after the gallery selection settles.
    # Poll the actual enabled control instead of clicking while the UI is loading.
    include_button = None
    include_deadline = time.monotonic() + 45
    while time.monotonic() < include_deadline:
        candidates = []
        for frame in page.frames[:8]:
            controls = frame.get_by_role("button", name=re.compile(
                r"(?:incluir|adicionar|enviar|add|include|send).*?(?:comando|prompt)", re.I))
            for i in range(min(await controls.count(), 12)):
                control = controls.nth(i)
                try:
                    if not await control.is_visible() or not await control.is_enabled():
                        continue
                    label = ((await control.get_attribute("aria-label")) or
                             (await control.inner_text(timeout=1000))).strip()
                    quantity = re.search(r"\b(\d+)\s+(?:itens?|items?|arquivos?|files?)\b", label, re.I)
                    if quantity and int(quantity.group(1)) == len(names):
                        candidates.append(control)
                    elif len(names) == 1 and re.fullmatch(
                        r"\\s*(?:incluir no comando|adicionar ao comando|add to prompt|include in prompt)\\s*", label, re.I):
                        candidates.append(control)
                except Exception:
                    continue
        if len(candidates) == 1:
            try:
                await candidates[0].click(trial=True, timeout=1200)
                include_button = candidates[0]
                record_event("include_button_ready")
                break
            except Exception:
                pass
        await page.wait_for_timeout(750)
    if include_button is None:
        raise RuntimeError("flow_reference_include_unavailable")
    await show_red_click(page, include_button, "click_include")
    await include_button.click(timeout=5000)
    return {"imagesSubmitted": len(names), "referencesIncluded": True,
            "referencesVerified": False}


async def configure_flow_agent(page, prompt_control):
    """Configure image and video defaults in the Flow agent panel."""
    buttons = []
    for frame in page.frames[:8]:
        controls = frame.get_by_role("button", name=re.compile(
            r"configurações do agente|agent settings|configurações|settings", re.I))
        for i in range(min(await controls.count(), 10)):
            control = controls.nth(i)
            if await control.is_visible() and await control.is_enabled():
                buttons.append(control)
    if not buttons:
        raise RuntimeError("flow_settings_button_not_found")
    # The editor's settings control is closest to the prompt box.
    prompt_handle = await prompt_control.element_handle()
    ranked = []
    for control in buttons:
        try:
            distance = await control.evaluate("""(el,prompt) => {
                const a=el.getBoundingClientRect(),b=prompt.getBoundingClientRect();
                return Math.hypot(a.right-b.right,a.bottom-b.bottom);
            }""", prompt_handle, timeout=1200)
            ranked.append((distance,control))
        except Exception:
            continue
    if not ranked:
        raise RuntimeError("flow_settings_button_not_found")
    ranked.sort(key=lambda x:x[0])
    if len(ranked)>1 and ranked[1][0]-ranked[0][0]<40:
        raise RuntimeError("flow_settings_button_ambiguous")
    await show_red_click(page,ranked[0][1],"click_settings")
    await ranked[0][1].click(timeout=4000)
    panel = None
    for frame in page.frames[:8]:
        heading = frame.get_by_text(re.compile(r"^Configurações do agente$|^Agent settings$",re.I))
        if await heading.count():
            candidate = heading.first.locator('xpath=ancestor::*[.//button[normalize-space()="Salvar" or normalize-space()="Save"]][1]')
            if await candidate.count()==1 and await candidate.is_visible():
                panel = candidate
                break
    if panel is None:
        raise RuntimeError("flow_settings_panel_not_found")

    # Choose controls by section, not by the first 9:16 on the page.
    async def select_in_section(section, value, code):
        selected = await panel.evaluate("""(root,args) => {
            const [section,value]=args;
            const text=Array.from(root.querySelectorAll('*')).find(el=>
                el.children.length===0 && (el.textContent||'').trim().toLowerCase()===section.toLowerCase());
            if(!text)return {found:false};
            let container=text.parentElement;
            for(let i=0;i<5 && container;i++,container=container.parentElement){
                const controls=Array.from(container.querySelectorAll('button,[role="radio"],[role="button"]'))
                    .filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});
                const matches=controls.filter(el=>(el.getAttribute('aria-label')||el.textContent||'').trim()===value);
                if(matches.length===1 && controls.length>=2){
                    matches[0].setAttribute('data-mv-setting-target','yes');
                    return {found:true};
                }
            }
            return {found:false};
        }""", [section,value], timeout=1500)
        if not selected["found"]:
            raise RuntimeError("flow_settings_option_not_found")
        target = panel.locator('[data-mv-setting-target="yes"]')
        if await target.count()!=1:
            raise RuntimeError("flow_settings_option_not_found")
        await show_red_click(page,target,code)
        await target.click(timeout=3000)
        await target.evaluate("(el)=>el.removeAttribute('data-mv-setting-target')")

    await select_in_section("Confirmar antes de gerar","Nunca","click_settings")
    await select_in_section("Padrão da geração de imagens","9:16","click_settings")
    await select_in_section("Padrão da geração de imagens","x1","click_settings")
    await select_in_section("Padrão para geração de vídeo","9:16","click_settings")
    # Keep the selected Nano Banana model if already set; do not switch models blindly.
    if not await panel.get_by_text("Nano Banana 2.1",exact=False).count():
        raise RuntimeError("flow_settings_model_unverified")
    save = panel.get_by_role("button",name=re.compile(r"^Salvar$|^Save$",re.I))
    if await save.count()!=1:
        raise RuntimeError("flow_settings_save_not_found")
    await show_red_click(page,save,"click_settings")
    await save.click(timeout=4000)
    return True


async def click_flow_generate(page, prompt_control):
    """One user-authorized Generate click; never auto-approve a later dialog."""
    frame = prompt_control.page.main_frame
    candidates = []
    for candidate_frame in page.frames[:8]:
        controls = candidate_frame.get_by_role("button",name=re.compile(
            r"^(gerar|generate|criar|create)(?: imagem| image)?$",re.I))
        for i in range(min(await controls.count(),8)):
            control=controls.nth(i)
            if await control.is_visible() and await control.is_enabled():
                candidates.append(control)
    if len(candidates)!=1:
        raise RuntimeError("flow_generate_button_unverified")
    await show_red_click(page,candidates[0],"click_generate")
    await candidates[0].click(timeout=4000)
    return True


@app.post("/session/stage")
async def stage_flow(request: Request):
    """Attach locally to the running Chrome; stage draft without generating video."""
    authorize(request)
    raw = await request.body()
    if len(raw) > 3_800_000:
        raise HTTPException(413, "payload_too_large")
    try:
        import json
        data = json.loads(raw)
        prompt = data.get("prompt", "")
        supplied = data.get("images", [])
        if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 4000:
            raise ValueError("invalid_prompt")
        if not isinstance(supplied, list) or len(supplied) > 3:
            raise ValueError("invalid_images")
        if supplied and data.get("imageRightsConfirmed") is not True:
            raise ValueError("image_rights_confirmation_required")
        images = []
        for index, item in enumerate(supplied):
            mime = item.get("mime")
            encoded = item.get("data")
            if mime not in ("image/png", "image/jpeg", "image/webp") or not isinstance(encoded, str):
                raise ValueError("invalid_image")
            content = base64.b64decode(encoded, validate=True)
            signatures = {
                "image/png": content.startswith(bytes.fromhex("89504e470d0a1a0a")),
                "image/jpeg": content.startswith(bytes.fromhex("ffd8ff")),
                "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
            }
            if not content or not signatures[mime]:
                raise ValueError("invalid_image")
            extension = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[mime]
            images.append({"name": f"produto-{index+1}.{extension}", "mimeType": mime, "buffer": content})
        if sum(len(item["buffer"]) for item in images) > 2_500_000:
            raise ValueError("images_too_large")
    except (ValueError, TypeError, AttributeError, KeyError):
        raise HTTPException(400, "invalid_draft")

    async with lock:
        record_event("stage_started")
        if not chrome_running():
            record_event("chrome_not_running")
            raise HTTPException(409, "browser_not_running")
        try:
            async with async_playwright() as pw:
                # CDP is loopback-only, never sent to the client or Supabase.
                browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                if not browser.contexts:
                    raise RuntimeError("no_context")
                pages = [p for p in browser.contexts[0].pages if not p.is_closed()]
                page = next((p for p in pages if p.url.startswith("https://flow.google.com/")), None)
                if page is None:
                    raise RuntimeError("flow_page_not_active")
                if not page.url.startswith("https://flow.google.com/project/"):
                    candidate, _ = await resolve_flow_control(page, "new_project")
                    if candidate is None:
                        raise RuntimeError("new_project_button_not_found")
                    await show_red_click(page, candidate, "click_new_project")
                    await candidate.click(timeout=8000)
                    # Project creation is asynchronous. Keep the same request
                    # alive until the project editor is ready; never require
                    # a second click on the Meu Vendedor submit button.
                    try:
                        await page.wait_for_url(re.compile(
                            r"^https://flow\.google\.com/project/"), timeout=25000)
                    except Exception:
                        # Flow can open the new project in another tab.
                        for _ in range(20):
                            pages = [p for ctx in browser.contexts for p in ctx.pages if not p.is_closed()]
                            found = next((p for p in pages if p.url.startswith("https://flow.google.com/project/")), None)
                            if found:
                                page = found
                                break
                            await asyncio.sleep(0.5)
                if not page.url.startswith("https://flow.google.com/project/"):
                    raise RuntimeError("flow_project_not_active")
                # The URL can change before the composer has hydrated.
                # Wait for its interactive field rather than a fixed sleep.
                try:
                    await page.get_by_role("textbox", name=re.compile(
                        r"o que você quer criar|what do you want to create", re.I)).first.wait_for(
                        state="visible", timeout=15000)
                except Exception:
                    await page.locator('[contenteditable="true"],[role="textbox"]').first.wait_for(
                        state="visible", timeout=10000)
                # Preserve the previously working Flow prompt locator as primary.
                matches = []
                for frame in page.frames[:8]:
                    fields = frame.locator('[role="textbox"][data-placeholder], [role="textbox"][aria-label], [contenteditable="true"][data-placeholder], [contenteditable="true"][aria-label], [contenteditable="true"][placeholder]')
                    for idx in range(min(await fields.count(), 30)):
                        field = fields.nth(idx)
                        if not await field.is_visible():
                            continue
                        label = await field.evaluate("""el => [el.getAttribute('aria-label'),el.getAttribute('data-placeholder'),el.getAttribute('placeholder')].filter(Boolean).join(' ')""")
                        if re.search(r"o que você quer criar|what do you want to create", label or "", re.I):
                            matches.append(field)
                if len(matches) == 1:
                    prompt_control = matches[0]
                else:
                    prompt_control, _ = await resolve_flow_control(page, "prompt")
                    if prompt_control is None:
                        raise RuntimeError("prompt_field_not_unique")
                await show_red_click(page, prompt_control, "click_prompt")
                await prompt_control.click(timeout=4000)
                await prompt_control.fill(prompt.strip(), timeout=8000)
                record_event("stage_prompt_filled")
                uploaded = 0
                references_included = False
                if images:
                    result = await flow_upload_references(page, images, prompt_control)
                    uploaded = result["imagesSubmitted"]
                    references_included = result["referencesIncluded"]
                settings_applied = False
                generation_clicked = False
                if data.get("configureAndGenerate") is True:
                    settings_applied = await configure_flow_agent(page, prompt_control)
                    generation_clicked = await click_flow_generate(page, prompt_control)
                record_event("stage_completed")
                return {"status": "draft_staged", "promptStaged": True, "imagesSubmitted": uploaded, "referencesIncluded": references_included,
                        "referencesVerified": False, "settingsApplied": settings_applied,
                        "generationStarted": generation_clicked}
        except Exception as exc:
            record_event("stage_failed")
            # Only return fixed diagnostic codes, never browser content or credentials.
            allowed = {"no_context", "flow_page_not_active", "new_project_button_not_found",
                       "flow_project_not_active", "prompt_field_not_unique",
                       "flow_upload_action_not_found", "flow_upload_incomplete", "flow_add_elements_not_found",
                       "flow_add_elements_ambiguous", "flow_image_rights_unresolved",
                       "flow_reference_selection_unavailable", "flow_reference_include_unavailable",
                       "flow_settings_button_not_found", "flow_settings_button_ambiguous",
                       "flow_settings_panel_not_found", "flow_settings_option_not_found",
                       "flow_settings_model_unverified", "flow_settings_save_not_found",
                       "flow_generate_button_unverified"}
            code = str(exc) if str(exc) in allowed else "flow_interaction_failed"
            raise HTTPException(409, code) from None


@app.post("/session/view-ticket")
async def view_ticket(request: Request):
    """Issue a short-lived, single-use credential for a protected visual proxy."""
    authorize(request)
    if not chrome_running():
        raise HTTPException(409, "browser_not_running")
    now = time.monotonic()
    for key, expiry in list(view_tickets.items()):
        if expiry <= now:
            del view_tickets[key]
    ticket = secrets.token_urlsafe(32)
    view_tickets[ticket] = now + 60
    record_event("viewer_ticket_issued")
    return {"ticket": ticket, "expiresInSeconds": 60}

def consume_view_ticket(ticket: str) -> bool:
    """Atomic in-process validation; callers must not log ticket values."""
    expiry = view_tickets.pop(ticket, 0)
    return bool(expiry > time.monotonic())

@app.get("/viewer", response_class=HTMLResponse)
async def viewer():
    """Public shell only. The actual screen requires a one-time private ticket."""
    return """<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Chrome privado</title></head><body style="margin:0;font-family:system-ui,sans-serif">
    <p id="status" role="status" style="padding:12px">Conectando à tela privada do Google Chrome...</p>
    <div id="screen" style="width:100%;height:90vh"></div>
    <script type="module">
    const status=document.getElementById("status");
    const ticket=new URLSearchParams(location.search).get("ticket");
    history.replaceState(null,"",location.pathname);
    if(!ticket){status.textContent="Acesso não autorizado. Volte à Loja e clique em Abrir tela para gerar um novo acesso temporário.";}else{
      try{
        const {default:RFB}=await import("/novnc/core/rfb.js");
        const protocol=location.protocol==="https:"?"wss:":"ws:";
        const ws=protocol+"//"+location.host+"/viewer/ws?ticket="+encodeURIComponent(ticket);
        const rfb=new RFB(document.getElementById("screen"),ws);
        rfb.scaleViewport=true;rfb.resizeSession=false;
        rfb.addEventListener("connect",()=>{status.textContent="Chrome conectado.";});
        rfb.addEventListener("securityfailure",()=>{status.textContent="Acesso recusado. Volte à Loja e solicite uma nova visualização.";});
        rfb.addEventListener("disconnect",event=>{status.textContent=event.detail?.clean?"Visualização encerrada.":"Não foi possível conectar à tela. Volte à Loja e clique em Abrir tela novamente.";});
      }catch(error){status.textContent="Não foi possível carregar o visualizador. Tente novamente pela Loja.";}
    }
    </script></body></html>"""

@app.websocket("/viewer/ws")
async def viewer_socket(socket: WebSocket):
    import websockets
    ticket = socket.query_params.get("ticket", "")
    origin = socket.headers.get("origin", "")
    expected_origin = os.getenv("MV_BROWSER_PUBLIC_ORIGIN", "")
    global active_viewers
    if not expected_origin.startswith("https://") or origin != expected_origin:
        await socket.close(code=1008)
        return
    async with lock:
        if not chrome_running() or active_viewers or not consume_view_ticket(ticket):
            record_event("viewer_rejected")
            await socket.close(code=1008)
            return
        active_viewers += 1
    record_event("viewer_connected")
    await socket.accept(subprotocol="binary" if "binary" in socket.scope.get("subprotocols", []) else None)
    try:
        async with websockets.connect("ws://127.0.0.1:6080/", subprotocols=["binary"], max_size=16*1024*1024) as upstream:
            async def to_browser():
                while True:
                    message=await socket.receive()
                    if message["type"]=="websocket.disconnect":
                        break
                    if message.get("bytes") is not None:
                        await upstream.send(message["bytes"])
                    elif message.get("text") is not None:
                        await upstream.send(message["text"])
            async def to_viewer():
                async for message in upstream:
                    if isinstance(message, bytes):
                        await socket.send_bytes(message)
                    else:
                        await socket.send_text(message)
            tasks=[asyncio.create_task(to_browser()),asyncio.create_task(to_viewer())]
            done,pending=await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
            for task in pending: task.cancel()
    except (OSError, WebSocketDisconnect, websockets.exceptions.WebSocketException):
        record_event("viewer_proxy_failed")
    finally:
        record_event("viewer_disconnected")
        active_viewers = max(0, active_viewers - 1)
        try:
            await socket.close()
        except RuntimeError:
            pass
