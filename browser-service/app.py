"""Private browser control prototype. Never expose raw VNC or CDP to the Internet."""
import asyncio
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
playwright = None
context = None

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
    yield
    await stop_browser()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.mount('/novnc', StaticFiles(directory='/usr/share/novnc', check_dir=False), name='novnc')

async def stop_browser():
    global context, playwright
    view_tickets.clear()
    if context is not None:
        try:
            await context.close()
        finally:
            context = None
    if playwright is not None:
        try:
            await playwright.stop()
        finally:
            playwright = None

@app.get("/health")
async def health(request: Request):
    authorize(request)
    return {"service": "chrome", "ready": bool(context and context.pages), "configured": len(SECRET) >= 32}

@app.post("/session/start")
async def start(request: Request):
    global playwright, context
    authorize(request)
    async with lock:
        if context is not None:
            return {"status": "already_running"}
        try:
            playwright = await async_playwright().start()
            context = await playwright.chromium.launch_persistent_context(
                PROFILE, channel="chrome", headless=False, viewport={"width": 1280, "height": 800}
            )
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto("https://flow.google.com/", wait_until="domcontentloaded", timeout=30000)
        except Exception:
            await stop_browser()
            raise HTTPException(503, "browser_start_failed")
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
    return {"running": context is not None, "pages": len(context.pages) if context else 0}

@app.post("/session/view-ticket")
async def view_ticket(request: Request):
    """Issue a short-lived, single-use credential for a protected visual proxy."""
    authorize(request)
    if context is None:
        raise HTTPException(409, "browser_not_running")
    now = time.monotonic()
    for key, expiry in list(view_tickets.items()):
        if expiry <= now:
            del view_tickets[key]
    ticket = secrets.token_urlsafe(32)
    view_tickets[ticket] = now + 60
    return {"ticket": ticket, "expiresInSeconds": 60}

def consume_view_ticket(ticket: str) -> bool:
    """Atomic in-process validation; callers must not log ticket values."""
    expiry = view_tickets.pop(ticket, 0)
    return bool(expiry > time.monotonic())

@app.get("/viewer", response_class=HTMLResponse)
async def viewer():
    """Public shell only. The actual screen requires a one-time private ticket."""
    return """<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
    <p>Visualização privada do Google Chrome. Abra com um ticket temporário emitido pelo backend autenticado.</p>
    <div id="screen" style="width:100%;height:85vh"></div>
    <script type="module">
    const ticket=new URLSearchParams(location.search).get("ticket");
    history.replaceState(null,"",location.pathname);
    if(!ticket){document.body.textContent="Ticket de acesso necessário";}else{
      const {default:RFB}=await import("/novnc/core/rfb.js");
      const protocol=location.protocol==="https:"?"wss:":"ws:";
      const ws=protocol+"//"+location.host+"/viewer/ws?ticket="+encodeURIComponent(ticket);
      const rfb=new RFB(document.getElementById("screen"),ws);
      rfb.scaleViewport=true;rfb.resizeSession=false;
      rfb.addEventListener("disconnect",()=>document.body.insertAdjacentText("beforeend","Sessão encerrada."));
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
        if context is None or active_viewers or not consume_view_ticket(ticket):
            await socket.close(code=1008)
            return
        active_viewers += 1
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
        pass
    finally:
        active_viewers = max(0, active_viewers - 1)
        try:
            await socket.close()
        except RuntimeError:
            pass
