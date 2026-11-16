"""Deploy the isolated Chromium service to Modal.

Deploy only after configuring the private Modal secret and an HTTPS origin.
No browser credentials, cookies or control tokens are stored in source control.
"""
import os
from pathlib import Path
import modal

app = modal.App("meu-vendedor-private-browser")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("xvfb", "x11vnc", "novnc", "websockify", "fluxbox", "supervisor")
    .pip_install(
        "fastapi==0.115.12", "uvicorn==0.34.2", "playwright==1.56.0",
        "httpx==0.28.1", "websockets==15.0.1",
    )
    .run_commands("playwright install --with-deps chromium")
    .add_local_dir(Path(__file__).parent, remote_path="/opt/private-browser", copy=True)
)
profile_volume = modal.Volume.from_name("mv-private-browser-profile", create_if_missing=True)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("mv-private-browser-control")],
    volumes={"/data/browser": profile_volume},
    timeout=3600,
    min_containers=0,
    max_containers=1,
    scaledown_window=120,
)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def browser_gateway():
    """All public requests are gated by the app's bearer or one-time view ticket."""
    import subprocess
    import sys
    from contextlib import asynccontextmanager
    from fastapi import FastAPI
    from fastapi.responses import Response

    os.environ["DISPLAY"] = ":99"
    sys.path.insert(0, "/opt/private-browser")
    import app as browser_service

    # Fail closed before starting any GUI process.
    secret = os.environ.get("MV_BROWSER_CONTROL_SECRET", "")
    origin = os.environ.get("MV_BROWSER_PUBLIC_ORIGIN", "")
    if len(secret) < 32 or not origin.startswith("https://"):
        raise RuntimeError("Private browser Modal secret/origin not configured")

    @asynccontextmanager
    async def lifecycle(api):
        commands = [
            ["/usr/bin/Xvfb", ":99", "-screen", "0", "1280x800x24"],
            ["/usr/bin/fluxbox"],
            ["/usr/bin/x11vnc", "-display", ":99", "-forever", "-shared",
             "-localhost", "-rfbport", "5900", "-nopw"],
            ["/usr/bin/websockify", "127.0.0.1:6080", "127.0.0.1:5900"],
        ]
        processes = []
        try:
            for command in commands:
                processes.append(subprocess.Popen(command, stdout=subprocess.DEVNULL,
                                                  stderr=subprocess.DEVNULL))
            async with browser_service.lifespan(browser_service.app):
                yield
        finally:
            await browser_service.stop_browser()
            profile_volume.commit()
            for process in reversed(processes):
                process.terminate()
            for process in reversed(processes):
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    # Persist profile changes after an authenticated stop, not only on container shutdown.
    # Chromium must be closed before committing its profile to the Modal Volume.
    from fastapi import Request
    @browser_service.app.middleware("http")
    async def persist_stopped_profile(request: Request, call_next):
        response = await call_next(request)
        if request.url.path == "/session/stop" and request.method == "POST" and response.status_code == 200:
            profile_volume.commit()
        return response

    # The FastAPI instance from app.py owns the routes; install the startup
    # manager without changing the authenticated endpoints.
    browser_service.app.router.lifespan_context = lifecycle
    return browser_service.app
