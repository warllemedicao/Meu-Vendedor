"""Private browser control prototype. Never expose raw VNC or CDP to the Internet."""
import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from playwright.async_api import async_playwright

SECRET = os.getenv("MV_BROWSER_CONTROL_SECRET", "")
PROFILE = os.getenv("MV_BROWSER_PROFILE_DIR", "/data/browser")
lock = asyncio.Lock()
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
