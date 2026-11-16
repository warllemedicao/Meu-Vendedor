"""Private browser control prototype. Never expose raw VNC or CDP to the Internet."""
import asyncio
import hmac
import os
import secrets
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from playwright.async_api import async_playwright

SECRET = os.getenv("MV_BROWSER_CONTROL_SECRET", "")
PROFILE = os.getenv("MV_BROWSER_PROFILE_DIR", "/data/browser")
lock = asyncio.Lock()
view_tickets = {}
playwright = None
context = None

def authorize(request: Request):
    if len(SECRET) < 32 or not hmac.compare_digest(
        request.headers.get("authorization", ""), "Bearer " + SECRET
    ):
        raise HTTPException(401, "unauthorized")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await stop_browser()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

async def stop_browser():
    global context, playwright
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
    return {"service": "chromium", "ready": bool(context and context.pages), "configured": len(SECRET) >= 32}

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
                PROFILE, headless=False, viewport={"width": 1280, "height": 800},
                args=["--no-first-run", "--no-default-browser-check"]
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
