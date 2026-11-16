"""Private browser control prototype. Never expose raw VNC or CDP to the Internet."""
import asyncio
import base64
import re
import subprocess
import hmac
import os
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
    "stage_started", "stage_completed", "stage_failed", "service_started", "service_stopped"))
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
    authorize(request)
    if not chrome_running():
        record_event("chrome_not_running")
        raise HTTPException(409, "browser_not_running")
    # Inspection will be integrated after manual-login validation.
    return {"running": True, "inspectionAvailable": False, "reason": "manual_chrome_mode"}

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
                    candidates = page.get_by_role("button", name=re.compile(r"novo projeto|new project", re.I))
                    if await candidates.count() != 1:
                        raise RuntimeError("new_project_button_not_found")
                    await candidates.click(timeout=8000)
                    await page.wait_for_timeout(1800)
                if not page.url.startswith("https://flow.google.com/project/"):
                    raise RuntimeError("flow_project_not_active")
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
                if len(matches) != 1:
                    raise RuntimeError("prompt_field_not_unique")
                await matches[0].fill(prompt.strip(), timeout=8000)
                uploaded = 0
                if images:
                    async def upload():
                        for frame in page.frames[:8]:
                            for selector in ('input[type="file"]',):
                                inputs = frame.locator(selector)
                                if await inputs.count() == 1:
                                    await inputs.set_input_files(images, timeout=12000)
                                    return True
                        for frame in page.frames[:8]:
                            actions = frame.get_by_role("button", name=re.compile(r"fazer upload|upload", re.I))
                            for idx in range(min(await actions.count(), 8)):
                                button = actions.nth(idx)
                                if await button.is_visible():
                                    async with page.expect_file_chooser(timeout=4000) as chooser:
                                        await button.click(timeout=4000)
                                    await (await chooser.value).set_files(images, timeout=12000)
                                    return True
                        return False
                    if not await upload():
                        raise RuntimeError("flow_upload_action_not_found")
                    uploaded = len(images)
                record_event("stage_completed")
                return {"status": "draft_staged", "promptStaged": True, "imagesSubmitted": uploaded,
                        "generationStarted": False}
        except Exception as exc:
            record_event("stage_failed")
            # Only return fixed diagnostic codes, never browser content or credentials.
            allowed = {"no_context", "flow_page_not_active", "new_project_button_not_found",
                       "flow_project_not_active", "prompt_field_not_unique",
                       "flow_upload_action_not_found"}
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
