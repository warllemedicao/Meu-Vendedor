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
browser_monitor_task = None
video_download_tickets = {}
# Only the most recent explicitly authorized generation may trigger automatic download.
generation_watch = {"active": False, "baseline": [], "projectUrl": "", "startedAt": 0.0, "ready": False, "newFirstObserved": False,
                    "failed": False, "networkFailures": 0, "lastNetworkCategory": None, "cacheCleared": False}
MAX_MANUAL_VIDEO_BYTES = 100 * 1024 * 1024


# Browser diagnostics never collect URLs, messages, page contents, headers or payloads.
def log_flow_browser_issue(kind, *, status=None, resource=None, category=None, host=None):
    import json
    payload = {"kind": kind, "at": int(time.time())}
    if status is not None:
        payload["status"] = int(status)
    if resource in {"document", "script", "xhr", "fetch", "image", "stylesheet", "other"}:
        payload["resource"] = resource
    if category:
        payload["category"] = category
    if host:
        payload["host"] = host
    # Link the independent browser diagnostics to the generation currently
    # being observed. Network failures are clues, not proof of a failed job.
    watch = globals().get("generation_watch")
    if isinstance(watch, dict) and watch.get("active") and kind in ("request_failed", "http_error"):
        if resource in ("xhr", "fetch") and host == "google":
            watch["networkFailures"] = min(99, watch.get("networkFailures", 0) + 1)
            watch["lastNetworkCategory"] = category if category in (
                "network", "rate_or_quota", "timeout", "auth", "server", "unknown") else "network"
            print("mv_generation_signal " + json.dumps({
                "source": "chrome_network", "type": kind,
                "count": watch["networkFailures"],
                "status": status if status in (401,403,408,409,429,500,502,503,504) else None
            }), flush=True)
    print("mv_chrome_diagnostic " + json.dumps(payload), flush=True)


def classify_browser_error(value):
    # Match a small predefined vocabulary; never print the original error text.
    raw = str(value or "").lower()
    if any(word in raw for word in ("429", "rate limit", "too many requests", "quota", "resource exhausted")):
        return "rate_or_quota"
    if any(word in raw for word in ("403", "forbidden", "permission", "access denied", "blocked")):
        return "access_denied"
    if any(word in raw for word in ("401", "unauthorized", "authentication")):
        return "authentication"
    if any(word in raw for word in ("timeout", "timed out")):
        return "timeout"
    if any(word in raw for word in ("failed to fetch", "network", "net::", "connection", "dns", "cors")):
        return "network"
    if any(word in raw for word in ("500", "502", "503", "504", "internal server")):
        return "server"
    return "unclassified"


def classify_network_failure(value):
    """Allowlisted Chromium failure classes; never log the raw failure string."""
    raw = str(value or "").upper()
    patterns = (
        ("ERR_ABORTED", "request_cancelled"),
        ("ERR_TIMED_OUT", "connection_timeout"),
        ("ERR_CONNECTION_RESET", "connection_reset"),
        ("ERR_CONNECTION_CLOSED", "connection_closed"),
        ("ERR_CONNECTION_REFUSED", "connection_refused"),
        ("ERR_CONNECTION_FAILED", "connection_failed"),
        ("ERR_NAME_NOT_RESOLVED", "dns_failure"),
        ("ERR_DNS", "dns_failure"),
        ("ERR_INTERNET_DISCONNECTED", "offline"),
        ("ERR_NETWORK_CHANGED", "network_changed"),
        ("ERR_SSL", "tls_error"),
        ("ERR_CERT", "certificate_error"),
        ("ERR_HTTP2_PROTOCOL_ERROR", "http2_protocol_error"),
        ("ERR_QUIC_PROTOCOL_ERROR", "quic_protocol_error"),
        ("ERR_BLOCKED_BY_CLIENT", "client_blocked"),
        ("ERR_BLOCKED_BY_RESPONSE", "response_blocked"),
        ("ERR_FAILED", "generic_network_failed"),
    )
    return next((category for pattern, category in patterns if pattern in raw),
                "other_network_error")


def flow_host_group(raw_url):
    host = (urlsplit(raw_url).hostname or "").lower()
    if host == "flow.google.com":
        return "flow"
    if host == "google.com" or host.endswith(".google.com"):
        return "google"
    if host == "googleapis.com" or host.endswith(".googleapis.com"):
        return "googleapis"
    return None


async def observe_chrome_errors():
    # Independent read-only CDP monitor for both robot and manual Flow actions.
    # Only fixed diagnostic categories are emitted: no URLs, messages or payloads.
    phase = "starting"
    attempt = 0
    try:
        async with async_playwright() as pw:
            browser = None
            for attempt in range(1, 6):
                if not chrome_running():
                    return
                phase = "cdp_connect"
                try:
                    browser = await pw.chromium.connect_over_cdp(
                        "http://127.0.0.1:9222", timeout=5000)
                    break
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    log_flow_browser_issue("observer_connect_retry",
                        category=type(exc).__name__)
                    if attempt == 5:
                        raise
                    await asyncio.sleep(1)
            phase = "restore_native_downloads"
            await restore_native_download_behavior(browser, stage="observer_attach")
            phase = "attach_existing_pages"
            seen_pages = set()
            def attach_page(page):
                if page in seen_pages:
                    return
                seen_pages.add(page)

                def on_console(message):
                    if message.type == "error":
                        log_flow_browser_issue("console_error",
                            category=classify_browser_error(message.text))

                def on_pageerror(error):
                    log_flow_browser_issue("javascript_error",
                        category=classify_browser_error(error))

                def on_response(response):
                    if response.status < 400:
                        return
                    host = flow_host_group(response.url)
                    if host:
                        log_flow_browser_issue("http_error", status=response.status,
                            resource=response.request.resource_type, host=host)
                        watch = generation_watch
                        if watch.get("active") and response.request.resource_type in ("xhr", "fetch"):
                            print("mv_generation_network_probe " + __import__("json").dumps({
                                "signal": "http_error", "status": response.status,
                                "method": response.request.method if response.request.method in ("GET", "POST", "PUT", "PATCH", "DELETE") else "other",
                                "host": host,
                                "msSinceGenerate": max(0, int((time.monotonic() - watch["startedAt"]) * 1000))
                            }), flush=True)

                def on_requestfailed(request):
                    host = flow_host_group(request.url)
                    if host:
                        failure_code = classify_network_failure(request.failure)
                        log_flow_browser_issue("request_failed",
                            category=classify_browser_error(request.failure),
                            resource=request.resource_type, host=host)
                        watch = generation_watch
                        if watch.get("active") and request.resource_type in ("xhr", "fetch"):
                            # Safe correlation only: no URL, query, cookies, body,
                            # headers, request text or raw failure strings.
                            print("mv_generation_network_probe " + __import__("json").dumps({
                                "signal": "request_failed",
                                "reason": failure_code,
                                "method": request.method if request.method in ("GET", "POST", "PUT", "PATCH", "DELETE") else "other",
                                "host": host,
                                "msSinceGenerate": max(0, int((time.monotonic() - watch["startedAt"]) * 1000)),
                                "retryScreenConfirmed": watch.get("failed") is True
                            }), flush=True)

                page.on("console", on_console)
                page.on("pageerror", on_pageerror)
                page.on("response", on_response)
                page.on("requestfailed", on_requestfailed)

            for ctx in browser.contexts:
                ctx.on("page", attach_page)
                for page in ctx.pages:
                    attach_page(page)
            phase = "monitoring"
            log_flow_browser_issue("observer_attached")
            while chrome_running():
                await asyncio.sleep(1)
            # CDP client disconnect only; don't close the user's Chrome session.
            phase = "disconnect"
            await browser.close()
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        import json
        # Fixed phase and exception class only; never print exception messages.
        print("mv_chrome_observer_failure " + json.dumps({
            "phase": phase, "attempt": attempt,
            "errorType": type(exc).__name__,
        }), flush=True)
        log_flow_browser_issue("observer_failed", category=type(exc).__name__)


# Fixed-code diagnostic ring. No prompts, URLs, cookies, secrets or exception text.
DIAGNOSTIC_CODES = frozenset(("chrome_started", "chrome_already_running", "chrome_stopped",
    "chrome_exited", "chrome_start_failed", "chrome_not_running", "viewer_ticket_issued",
    "viewer_rejected", "viewer_connected", "viewer_disconnected", "viewer_proxy_failed",
    "stage_started", "stage_completed", "stage_failed", "stage_prompt_filled", "stage_upload_failed",
    "click_new_project", "click_prompt", "click_add_elements", "click_upload", "click_settings", "click_generate", "click_rights", "click_reference", "click_include",
    "add_elements_not_found", "upload_not_found", "upload_incomplete", "reference_wait_started",
    "reference_click_confirmed", "reference_selection_finished", "include_button_ready",
    "click_video_menu", "click_video_download_menu", "click_video_720p", "video_download_detected", "video_menu_not_unique", "click_video_preview",
    "service_started", "service_stopped"))
diagnostic_events = []

def record_event(code):
    if code not in DIAGNOSTIC_CODES:
        return
    event = {"code": code, "at": int(time.time())}
    diagnostic_events.append(event)
    del diagnostic_events[:-40]
    if learning_state["active"]:
        learning_state["events"].append({"kind": "robot-action", "code": code, "at": event["at"]})
        del learning_state["events"][:-200]
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
    global chrome_process, browser_monitor_task
    view_tickets.clear()
    for ticket_info in video_download_tickets.values():
        try:
            os.unlink(ticket_info["path"])
        except FileNotFoundError:
            pass
    video_download_tickets.clear()
    if browser_monitor_task is not None:
        browser_monitor_task.cancel()
        try:
            await browser_monitor_task
        except asyncio.CancelledError:
            pass
        browser_monitor_task = None
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
    global chrome_process, browser_monitor_task
    authorize(request)
    async with lock:
        if chrome_running():
            record_event("chrome_already_running")
            return {"status": "already_running"}
        if chrome_process is not None:
            await stop_browser()
        try:
            os.makedirs(PROFILE, mode=0o700, exist_ok=True)
            os.makedirs(DOWNLOAD_DIR, mode=0o700, exist_ok=True)
            # Open a regular Chrome GUI independently of Playwright.
            # Never enable an unauthenticated remote-debugging port.
            chrome_process = subprocess.Popen([
                "/opt/google/chrome/chrome", "--no-sandbox",
                "--user-data-dir=" + PROFILE,
                "--no-first-run", "--no-default-browser-check",
                "--window-size=1280,800",
                "--download-default-directory=" + DOWNLOAD_DIR,
                "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9222",
                "https://flow.google.com/"
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            await asyncio.sleep(2)
            if chrome_running():
                # Chrome's first Ctrl+Plus step changes 100% to 110%.
                # Apply once to the initial Flow tab, not on every automation run.
                try:
                    async with async_playwright() as pw:
                        browser = await pw.chromium.connect_over_cdp(
                            "http://127.0.0.1:9222", timeout=10000)
                        # Configure Chrome's own Downloads destination. No profile
                        # cookies, auth storage, or automation selectors are touched.
                        try:
                            cdp = await browser.new_browser_cdp_session()
                            await cdp.send("Browser.setDownloadBehavior", {
                                "behavior": "allow", "downloadPath": DOWNLOAD_DIR,
                                "eventsEnabled": True,
                            })
                            await cdp.detach()
                            record_event("chrome_download_directory_ready")
                        except Exception:
                            record_event("chrome_download_directory_unverified")
                        flow_pages = [p for ctx in browser.contexts for p in ctx.pages
                                      if not p.is_closed() and p.url.startswith("https://flow.google.com/")]
                        if flow_pages:
                            await flow_pages[0].bring_to_front()
                            await flow_pages[0].keyboard.press("Control+0")
                            record_event("flow_zoom_100_requested")
                except Exception:
                    record_event("flow_zoom_100_unverified")
            if not chrome_running():
                record_event("chrome_exited")
                raise RuntimeError("chrome_exited")
        except Exception:
            record_event("chrome_start_failed")
            await stop_browser()
            raise HTTPException(503, "browser_start_failed")
        if browser_monitor_task is None or browser_monitor_task.done():
            browser_monitor_task = asyncio.create_task(observe_chrome_errors())
        record_event("chrome_started")
        return {"status": "running"}

@app.post("/session/stop")
async def stop(request: Request):
    authorize(request)
    async with lock:
        await stop_browser()
    return {"status": "stopped"}

# Keep downloaded files outside the Chrome profile. Modal mounts /data/browser as
# a persistent Volume, so a stopped browser does not destroy finished MP4 files.
DOWNLOAD_DIR = os.getenv("MV_BROWSER_DOWNLOAD_DIR", "/data/browser/downloads")
DOWNLOAD_SEARCH_DIRS = [Path(DOWNLOAD_DIR), Path.home() / "Downloads"]


async def restore_native_download_behavior(browser, *, stage="unspecified"):
    """Override Playwright's allowAndName and its temporary downloads directory.

    Chromium CDP attachment may set Browser.setDownloadBehavior globally.
    This browser is user-owned, and downloads must retain their native names
    in the persistent Chrome Downloads folder.
    """
    session = None
    try:
        os.makedirs(DOWNLOAD_DIR, mode=0o700, exist_ok=True)
        session = await browser.new_browser_cdp_session()
        await session.send("Browser.setDownloadBehavior", {
            "behavior": "allow", "downloadPath": DOWNLOAD_DIR, "eventsEnabled": True
        })
        print("mv_download_behavior " + __import__("json").dumps({
            "stage": stage, "mode": "allow", "destination": "persistent_downloads",
            "restored": True
        }), flush=True)
    except Exception as exc:
        print("mv_download_behavior " + __import__("json").dumps({
            "stage": stage, "restored": False, "errorType": type(exc).__name__
        }), flush=True)
        raise RuntimeError("flow_native_download_behavior_unverified") from None
    finally:
        if session is not None:
            await session.detach()


def diagnostic_download_files():
    """Safe file-type inventory: no filenames, content, URLs or credentials."""
    import stat as statlib
    rows = []
    now = time.time()
    for folder in DOWNLOAD_SEARCH_DIRS:
        if not folder.is_dir() or folder.is_symlink():
            continue
        try:
            entries = list(folder.iterdir())[-120:]
        except OSError:
            continue
        for entry in entries:
            try:
                info = entry.lstat()
                if not statlib.S_ISREG(info.st_mode) or now - info.st_mtime > 240:
                    continue
                with entry.open("rb") as handle:
                    head = handle.read(64)
                if len(head) >= 12 and head[4:8] == b"ftyp":
                    kind = "iso_bmff_ftyp"
                elif head.startswith(b"\x1aE\xdf\xa3"):
                    kind = "matroska_webm"
                elif head.startswith(b"RIFF") and head[8:12] == b"AVI ":
                    kind = "avi"
                elif head.startswith(b"PK\x03\x04"):
                    kind = "zip"
                elif head.lstrip().startswith((b"{", b"[")):
                    kind = "json_like"
                elif head.lstrip().startswith((b"<", b"<!")):
                    kind = "html_xml_like"
                elif not head:
                    kind = "empty"
                else:
                    kind = "unknown_binary"
                suffix = entry.suffix.lower()
                ext_class = ("mp4" if suffix == ".mp4" else
                             "partial" if suffix in (".crdownload", ".tmp") else
                             "none" if not suffix else "other")
                rows.append({"type": kind, "extension": ext_class,
                             "bytes": info.st_size,
                             "ageSeconds": round(max(0, now - info.st_mtime))})
            except OSError:
                continue
    rows.sort(key=lambda row: row["ageSeconds"])
    return rows[:25]


def finished_mp4_files():
    """Find completed MP4 payloads, even when Chrome saved a UUID without .mp4.

    Google Flow can return a video with an extensionless Content-Disposition
    filename. Never trust the filename alone: verify ISO BMFF ftyp and a known
    video brand. Do not rename Chrome's download (its history tracks that path).
    """
    import stat as statlib
    result = []
    seen = set()
    video_brands = {b"isom", b"iso2", b"iso5", b"iso6", b"mp41", b"mp42",
                    b"avc1", b"dash", b"cmfc", b"cmfs", b"M4V ", b"MSNV"}
    for folder in DOWNLOAD_SEARCH_DIRS:
        if not folder.is_dir() or folder.is_symlink():
            continue
        for entry in folder.iterdir():
            try:
                info = entry.lstat()
                extensionless = (not entry.suffix and bool(re.fullmatch(
                    r"[0-9a-fA-F-]{32,64}", entry.name)))
                if (not statlib.S_ISREG(info.st_mode)
                        or (entry.suffix.lower() != ".mp4" and not extensionless)
                        or info.st_size < 16 or info.st_size > MAX_MANUAL_VIDEO_BYTES
                        or time.time() - info.st_mtime < 3):
                    continue
                resolved = str(entry.resolve(strict=True))
                if resolved in seen:
                    continue
                with entry.open("rb") as handle:
                    header = handle.read(64)
                if (len(header) < 16 or header[4:8] != b"ftyp"
                        or int.from_bytes(header[:4], "big") < 16
                        or header[8:12] not in video_brands
                        and not any(header[pos:pos + 4] in video_brands
                                    for pos in range(16, min(len(header) - 3, 64), 4))):
                    continue
                seen.add(resolved)
                identity = (resolved + ":" + str(info.st_size) + ":" +
                            str(info.st_mtime_ns)).encode()
                download_id = hmac.new(SECRET.encode(), identity, "sha256").hexdigest()
                name = entry.name + ".mp4" if extensionless else entry.name
                result.append({"id": download_id, "path": entry,
                    "name": name[:120], "bytes": info.st_size,
                    "modifiedAt": int(info.st_mtime)})
            except (OSError, ValueError):
                continue
    result.sort(key=lambda item: item["modifiedAt"], reverse=True)
    return result[:20]

@app.post("/session/video/train-download")
async def train_flow_download(request: Request):
    """Download exactly one previously completed Flow video; never generate."""
    authorize(request)
    diagnostic = {"stage": "initializing", "reason": "not_started"}
    async with lock:
        if not chrome_running():
            diagnostic.update({"stage": "browser_check", "reason": "chrome_not_running"})
            print("mv_video_download_failure " + __import__("json").dumps(diagnostic), flush=True)
            raise HTTPException(409, detail={"code": "browser_not_running", "diagnostic": diagnostic})
        try:
            from flow_video_download import download_existing_video
            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                try:
                    await restore_native_download_behavior(browser, stage="train_download")
                    pages = [p for ctx in browser.contexts for p in ctx.pages
                             if not p.is_closed() and p.url.startswith("https://flow.google.com/project/")]
                    diagnostic.update({"stage": "project_check", "flowProjectTabs": len(pages),
                                       "reason": "project_tab_count_not_one" if len(pages) != 1 else "verified"})
                    if len(pages) != 1:
                        raise RuntimeError("flow_video_project_not_unique")
                    # The training UI was retired: automatic download now needs
                    # a confirmed newly generated editor, never an old video.
                    if not generation_watch["active"] or not generation_watch["ready"]:
                        raise RuntimeError("flow_generated_video_not_ready")
                    if not pages[0].url.startswith(generation_watch["projectUrl"] + "/edit/"):
                        raise RuntimeError("flow_generated_video_not_ready")
                    before = {item["id"] for item in finished_mp4_files()}
                    print("mv_download_file_types " + __import__("json").dumps({
                        "phase": "before_automated_clicks",
                        "files": diagnostic_download_files()
                    }), flush=True)
                    video = await download_existing_video(
                        pages[0], before, finished_mp4_files, record_event, show_red_click, diagnostic)
                    generation_watch["active"] = False
                    return {"status": "download_completed", "video": video}
                finally:
                    # Disconnect only. Never close the user's Chromium process.
                    await browser.close()
        except Exception as exc:
            allowed = {"flow_video_project_not_unique", "flow_video_download_control_not_unique",
                       "flow_video_download_not_started", "flow_video_not_unique",
                       "flow_video_editor_not_open", "flow_native_download_behavior_unverified",
                       "flow_generated_video_not_ready"}
            code = str(exc) if str(exc) in allowed else "flow_video_download_failed"
            diagnostic.update({"errorCode": code, "exceptionType": type(exc).__name__})
            if diagnostic.get("stage") == "wait_for_mp4":
                print("mv_download_file_types " + __import__("json").dumps({
                    "phase": "failed_after_720p",
                    "files": diagnostic_download_files()
                }), flush=True)
            print("mv_video_download_failure " + __import__("json").dumps(diagnostic), flush=True)
            if learning_state["active"]:
                learning_state["events"].append({
                    "kind": "robot-diagnostic",
                    "stage": diagnostic.get("stage", "initializing"),
                    "reason": diagnostic.get("reason", "not_started"),
                    "code": code,
                    "videoCandidates": diagnostic.get("videoCandidates", 0),
                    "toolbarCandidates": diagnostic.get("toolbarCandidates", 0),
                    "resolutionCandidates": diagnostic.get("resolutionCandidates", 0),
                    "frames": diagnostic.get("frames", []),
                    "at": int(time.time())
                })
                del learning_state["events"][:-200]
            # Fixed fields only: no page text, prompts, URLs, cookies or secrets.
            raise HTTPException(409, detail={"code": code, "diagnostic": diagnostic}) from None


async def flow_retry_message_visible(page):
    """Detect an actual visible Flow retry action, not arbitrary network noise.

    Read only accessible labels of small on-screen controls. Never log page
    content, prompt, images or URLs. Retrying requires a fresh user action.
    """
    for frame in page.frames[:8]:
        try:
            found = await frame.locator("body").evaluate(r"""root => {
                const candidates = root.querySelectorAll(
                    'button,[role="button"],[role="alert"],[role="status"]');
                for (const e of Array.from(candidates).slice(0,350)) {
                    const r=e.getBoundingClientRect(), style=getComputedStyle(e);
                    if (r.width<8||r.height<8||r.top>=innerHeight||r.bottom<=0||
                        style.display==='none'||style.visibility==='hidden') continue;
                    const label=[e.getAttribute('aria-label'),e.getAttribute('title'),
                        e.innerText||''].filter(Boolean).join(' ').trim();
                    // Do not match the application's own UI: this runs in Flow.
                    const retry= /^(tentar de novo|tente novamente|try again|retry)[.!\s]*$/i;
                    if (retry.test(label)) return true;
                }
                return false;
            }""", timeout=2500)
            if found:
                return True
        except Exception:
            continue
    return False


async def abort_failed_generation(page, stage):
    """End this attempt and clear only HTTP cache, preserving Google login.

    Never clear cookies, localStorage, IndexedDB, permissions, service workers,
    or the persistent Chrome profile. No automatic retry or browser shutdown.
    """
    if generation_watch["failed"]:
        return
    generation_watch["failed"] = True
    generation_watch["active"] = False
    generation_watch["ready"] = False
    cache_cleared = False
    session = None
    try:
        session = await page.context.new_cdp_session(page)
        await session.send("Network.enable")
        await session.send("Network.clearBrowserCache")
        cache_cleared = True
    except Exception as exc:
        print("mv_generation_cache_cleanup " + __import__("json").dumps({
            "result": "failed", "errorType": type(exc).__name__
        }), flush=True)
    finally:
        if session is not None:
            try:
                await session.detach()
            except Exception:
                pass
    generation_watch["cacheCleared"] = cache_cleared
    print("mv_generation_aborted " + __import__("json").dumps({
        "reason": "flow_try_again", "stage": stage,
        "networkFailures": generation_watch["networkFailures"],
        "httpCacheCleared": cache_cleared, "loginPreserved": True
    }), flush=True)


@app.get("/session/video/generation-error")
async def generation_error_status(request: Request):
    """Read-only failure probe during the initial 110-second generation wait."""
    authorize(request)
    if generation_watch["failed"]:
        return {"failed": True, "reason": "flow_try_again"}
    if not generation_watch["active"]:
        return {"failed": False, "reason": "generation_not_registered"}
    if not chrome_running():
        return {"failed": True, "reason": "browser_not_running"}
    async with lock:
        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
            try:
                await restore_native_download_behavior(browser, stage="generation_error_probe")
                project_url = generation_watch["projectUrl"]
                pages = [p for ctx in browser.contexts for p in ctx.pages
                         if not p.is_closed() and p.url.startswith(project_url)]
                if len(pages) != 1:
                    return {"failed": False, "reason": "project_not_visible"}
                if await flow_retry_message_visible(pages[0]):
                    await abort_failed_generation(pages[0], "initial_wait")
                    return {"failed": True, "reason": "flow_try_again"}
                return {"failed": False, "reason": "no_retry_message",
                        "networkFailures": generation_watch["networkFailures"]}
            finally:
                await browser.close()


@app.get("/session/video/generated-ready")
async def generated_video_ready(request: Request):
    """Poll whether a new gallery thumbnail appeared after the authorized Generate."""
    authorize(request)
    if not chrome_running():
        raise HTTPException(409, "browser_not_running")
    if generation_watch["failed"]:
        return {"ready": False, "failed": True, "reason": "flow_try_again"}
    if not generation_watch["active"]:
        return {"ready": False, "reason": "generation_not_registered"}
    if time.monotonic() - generation_watch["startedAt"] > 600:
        generation_watch["active"] = False
        return {"ready": False, "reason": "generation_expired"}
    async with lock:
        from flow_video_download import gallery_thumbnail_fingerprints
        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
            try:
                await restore_native_download_behavior(browser, stage="generated_ready")
                project_url = generation_watch["projectUrl"]
                pages = [p for ctx in browser.contexts for p in ctx.pages
                         if not p.is_closed() and p.url.startswith(project_url)]
                if len(pages) != 1:
                    return {"ready": False, "reason": "project_not_visible"}
                page = pages[0]
                if await flow_retry_message_visible(page):
                    await abort_failed_generation(page, "monitoring")
                    return {"ready": False, "failed": True, "reason": "flow_try_again"}
                if "/edit/" in page.url:
                    if generation_watch["ready"]:
                        return {"ready": True, "reason": "editor_confirmed"}
                    if generation_watch["newFirstObserved"]:
                        from flow_video_download import _locate_editor_download
                        try:
                            await _locate_editor_download(page, {})
                            generation_watch["ready"] = True
                            return {"ready": True, "reason": "editor_confirmed"}
                        except Exception:
                            return {"ready": False, "reason": "editor_not_ready"}
                    return {"ready": False, "reason": "gallery_not_visible"}
                current = await gallery_thumbnail_fingerprints(page)
                baseline = set(generation_watch["baseline"])
                new_first = bool(current and current[0] not in baseline)
                if not new_first:
                    return {"ready": False, "reason": "still_processing"}
                generation_watch["newFirstObserved"] = True
                # Opening the generated card must navigate to a real /edit/
                # page with the known download toolbar. If Flow is still
                # processing, it will fail safely and the UI retries in 10s.
                from flow_video_download import _open_completed_video, _locate_editor_download
                evidence = {}
                try:
                    await _open_completed_video(page, record_event, show_red_click, evidence)
                    await _locate_editor_download(page, evidence)
                except Exception as exc:
                    print("mv_generation_ready " + __import__("json").dumps({
                        "ready": False, "reason": "preview_not_openable",
                        "errorType": type(exc).__name__
                    }), flush=True)
                    return {"ready": False, "reason": "preview_not_openable"}
                generation_watch["ready"] = True
                print("mv_generation_ready " + __import__("json").dumps({
                    "ready": True, "visible": len(current),
                    "elapsedSeconds": round(time.monotonic() - generation_watch["startedAt"])
                }), flush=True)
                return {"ready": True, "reason": "editor_confirmed"}
            finally:
                await browser.close()


@app.get("/session/video/downloads")
async def list_manual_flow_downloads(request: Request):
    """List finished MP4 downloads from the isolated Chromium, not any account data."""
    authorize(request)
    return {"videos": [{key: item[key] for key in
             ("id", "name", "bytes", "modifiedAt")} for item in finished_mp4_files()]}


@app.post("/session/video/prepare")
async def prepare_manual_flow_video(request: Request):
    """Prepare an explicitly selected finished MP4; never click the Flow UI."""
    authorize(request)
    try:
        data = await request.json()
        app_origin = data.get("appOrigin")
        download_id = data.get("downloadId")
        parsed = urlsplit(app_origin)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
                parsed.password or parsed.path not in ("", "/") or parsed.query or
                parsed.fragment or parsed.port not in (None, 443) or
                not isinstance(download_id, str) or
                not re.fullmatch(r"[0-9a-f]{64}", download_id)):
            raise ValueError()
        app_origin = f"https://{parsed.hostname}"
        if app_origin != os.getenv("MV_APP_ORIGIN", app_origin):
            # Explicit MV_APP_ORIGIN is optional: the authorized bridge already
            # constructs appOrigin from its trusted environment.
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(400, "invalid_download_selection")

    async with lock:
        import tempfile
        import shutil
        import json
        choices = [item for item in finished_mp4_files()
                   if hmac.compare_digest(item["id"], download_id)]
        if len(choices) != 1:
            raise HTTPException(409, "flow_download_file_not_found")
        selected = choices[0]
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                    prefix="mv-flow-", suffix=".mp4", delete=False) as handle:
                tmp_path = handle.name
                with selected["path"].open("rb") as original:
                    shutil.copyfileobj(original, handle)
            size = os.path.getsize(tmp_path)
            with open(tmp_path, "rb") as handle:
                signature = handle.read(12)
            if (size != selected["bytes"] or size < 12 or
                    size > MAX_MANUAL_VIDEO_BYTES or signature[4:8] != b"ftyp"):
                raise HTTPException(409, "flow_video_invalid_mp4")
            now = time.time()
            for old_token, info in list(video_download_tickets.items()):
                if info["expires"] < now:
                    video_download_tickets.pop(old_token, None)
                    try:
                        os.unlink(info["path"])
                    except FileNotFoundError:
                        pass
            token = secrets.token_urlsafe(32)
            video_download_tickets[token] = {
                "path": tmp_path, "origin": app_origin, "expires": now + 180}
            tmp_path = None
            print("mv_manual_download " + json.dumps({
                "result": "ready_from_downloads", "bytes": size}), flush=True)
            return {"ticket": token, "bytes": size}
        except HTTPException:
            raise
        except (OSError, ValueError) as exc:
            print("mv_manual_download " + json.dumps({
                "result": "file_read_failed", "errorType": type(exc).__name__
            }), flush=True)
            raise HTTPException(409, "flow_download_file_not_found")
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except FileNotFoundError:
                    pass


@app.get("/session/video/file")
async def retrieve_manual_flow_video(request: Request, ticket: str = ""):
    """Single-use, origin-bound stream; no browser control bearer exposed."""
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", ticket):
        raise HTTPException(403, "invalid_video_ticket")
    info = video_download_tickets.get(ticket)
    if (info is None or info["expires"] < time.time() or
            request.headers.get("origin") != info["origin"]):
        raise HTTPException(403, "invalid_video_ticket")
    info = video_download_tickets.pop(ticket)
    return FileResponse(info["path"], media_type="video/mp4",
        filename="google-flow-video.mp4",
        headers={"Access-Control-Allow-Origin": info["origin"],
                 "Cache-Control": "no-store", "Vary": "Origin"},
        background=BackgroundTask(os.unlink, info["path"]))


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
                await restore_native_download_behavior(browser, stage="learning_stop")
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
  if (window.__mvLearningCleanup) return;
  const events = window.__mvLearningEvents = [];
  const MAX = 160;
  const emit = item => {
    events.push({...item, timeMs: Math.round(performance.now())});
    if (events.length > MAX) events.shift();
  };
  const sensitive = el => !!el.closest('input,textarea,[contenteditable],form,[type="password"]');
  const safe = el => {
    if (!(el instanceof Element) || sensitive(el)) return null;
    const target = el.closest('button,[role="button"],[role="checkbox"],[aria-selected],[aria-pressed],[data-state],img,li') || el;
    const state = {};
    for (const key of ['aria-selected','aria-pressed','aria-checked','aria-expanded','data-state']) {
      const v = target.getAttribute(key);
      if (v !== null && /^(true|false|open|closed|checked|unchecked|on|off|active|inactive)$/.test(v)) state[key] = v;
    }
    return {role:(target.getAttribute('role') || target.tagName.toLowerCase()).slice(0,24),
      state, disabled:target.matches(':disabled,[aria-disabled="true"]'),
      visible:!!target.getClientRects().length};
  };
  const snapshot = () => {
    const scope = document.querySelector('[role="dialog"]') || document;
    const nodes = [...scope.querySelectorAll('[aria-selected],[aria-pressed],[aria-checked],[data-state],[aria-expanded]')]
      .filter(el => !sensitive(el) && el.getClientRects().length).slice(0,120);
    const count = (key,val) => nodes.filter(el=>el.getAttribute(key)===val).length;
    return {selectedTrue:count('aria-selected','true'),selectedFalse:count('aria-selected','false'),
      pressedTrue:count('aria-pressed','true'),pressedFalse:count('aria-pressed','false'),
      checkedTrue:count('aria-checked','true'),expandedTrue:count('aria-expanded','true'),
      dialogs:document.querySelectorAll('[role="dialog"]').length,
      disabledButtons:[...scope.querySelectorAll('button:disabled,[role="button"][aria-disabled="true"]')].length,
      visibleImages:[...scope.querySelectorAll('img')].filter(el=>el.getClientRects().length).length};
  };
  let active = null, timer = null, last = snapshot(), pending = [];
  const flush = () => {
    if (!active) return;
    const after = snapshot();
    const delta = {};
    for (const k of Object.keys(after)) if (after[k] !== active.before[k]) delta[k] = {before:active.before[k],after:after[k]};
    const observed = Object.keys(delta).length>0 || pending.length>0;
    emit({kind:'browser-response',target:active.target,elapsedMs:Math.round(performance.now()-active.at),
      changes:pending.splice(0,24),delta,observed});
    last=after;
  };
  const click = e => {
    const target=safe(e.target);
    if (!target) return;
    if (timer) clearTimeout(timer);
    if (active) flush();
    // Coordinates and element role only; no texts, values, URLs or credentials.
    const pointer={...target,
      x:Math.round(e.clientX),y:Math.round(e.clientY),
      viewportWidth:Math.round(innerWidth),viewportHeight:Math.round(innerHeight)};
    active={target:pointer,before:snapshot(),at:performance.now()};
    pending=[];
    timer=setTimeout(()=>{flush();active=null;},1200);
  };
  const observer = new MutationObserver(changes => {
    if (!active) return;
    for (const m of changes) {
      if (pending.length>=24) break;
      if (!(m.target instanceof Element) || sensitive(m.target)) continue;
      if (m.type==='attributes' && m.attributeName==='class') continue;
      const element=safe(m.target);
      if (!element) continue;
      pending.push({type:m.type,attribute:m.attributeName || 'structure',
        role:element.role,state:element.state,disabled:element.disabled});
    }
  });
  document.addEventListener('click',click,true);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,
    attributeFilter:['aria-selected','aria-pressed','aria-checked','aria-expanded','data-state','disabled']});
  window.__mvLearningCleanup=()=>{
    if(timer) clearTimeout(timer);
    if(active) flush();
    document.removeEventListener('click',click,true);
    observer.disconnect();
    delete window.__mvLearningCleanup;
  };
})()"""
async def learning_browser_page(pw):
    browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
    await restore_native_download_behavior(browser, stage="learning_start")
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
                    await frame.evaluate("if(window.__mvLearningCleanup) window.__mvLearningCleanup(); delete window.__mvLearningEvents")
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
                browser = await pw.chromium.connect_over_cdp("http://127.0.0.1:9222", timeout=10000)
                pages = [p for ctx in browser.contexts for p in ctx.pages
                         if not p.is_closed() and p.url.startswith("https://flow.google.com/")]
                for frame in [f for page in pages for f in page.frames[:8]][:24]:
                    try:
                        events = await frame.evaluate("""() => {
                          if(window.__mvLearningCleanup) window.__mvLearningCleanup();
                          const events = window.__mvLearningEvents || [];
                          delete window.__mvLearningEvents;
                          return events;
                        }""")
                        for event in events[:200]:
                            if len(learning_state["events"]) >= 200:
                                break
                            element = event.get("element") or {}
                            state = element.get("state") or {}
                            delta = event.get("delta") if isinstance(event.get("delta"), dict) else {}
                            changes = event.get("changes") if isinstance(event.get("changes"), list) else []
                            learning_state["events"].append({
                                "kind": "browser-response",
                                "target": {
                                    "role": str((event.get("target") or {}).get("role", ""))[:24],
                                    "x": min(max((event.get("target") or {}).get("x", 0), 0), 10000) if isinstance((event.get("target") or {}).get("x"), int) else None,
                                    "y": min(max((event.get("target") or {}).get("y", 0), 0), 10000) if isinstance((event.get("target") or {}).get("y"), int) else None,
                                    "viewportWidth": min(max((event.get("target") or {}).get("viewportWidth", 0), 0), 10000) if isinstance((event.get("target") or {}).get("viewportWidth"), int) else None,
                                    "viewportHeight": min(max((event.get("target") or {}).get("viewportHeight", 0), 0), 10000) if isinstance((event.get("target") or {}).get("viewportHeight"), int) else None,
                                    "state": {k: v for k, v in ((event.get("target") or {}).get("state") or {}).items()
                                              if k in ("aria-selected", "aria-pressed", "aria-checked", "aria-expanded", "data-state")
                                              and v in ("true", "false", "open", "closed", "checked", "unchecked", "on", "off", "active", "inactive")},
                                },
                                "elapsedMs": min(max(event.get("elapsedMs", 0), 0), 30000) if isinstance(event.get("elapsedMs"), int) else None,
                                "timeMs": event.get("timeMs") if isinstance(event.get("timeMs"), int) else None,
                                "observed": event.get("observed") is True,
                                "delta": {k: {"before": v.get("before"), "after": v.get("after")}
                                          for k, v in delta.items() if k in
                                          ("selectedTrue", "selectedFalse", "pressedTrue", "pressedFalse",
                                           "checkedTrue", "expandedTrue", "dialogs", "disabledButtons", "visibleImages")
                                          and isinstance(v, dict)},
                                "changes": [
                                    {"type": str(c.get("type", ""))[:12],
                                     "attribute": str(c.get("attribute", ""))[:24],
                                     "role": str(c.get("role", ""))[:24],
                                     "state": {k: v for k, v in (c.get("state") or {}).items()
                                               if k in ("aria-selected", "aria-pressed", "aria-checked", "aria-expanded", "data-state")
                                               and v in ("true", "false", "open", "closed", "checked", "unchecked", "on", "off", "active", "inactive")},
                                     "disabled": c.get("disabled") is True}
                                    for c in changes[:24] if isinstance(c, dict)
                                ],
                            })
                    except Exception:
                        continue
        # Log only click geometry/roles and event counts for user debugging.
        manual_clicks = [
            {"role": e.get("target", {}).get("role"),
             "x": e.get("target", {}).get("x"),
             "y": e.get("target", {}).get("y")}
            for e in learning_state["events"]
            if e.get("kind") == "browser-response"
        ]
        print("mv_manual_click_diagnostic " + __import__("json").dumps({
            "eventCount": len(learning_state["events"]),
            "clicks": manual_clicks[:25]
        }), flush=True)
        learning_state["active"] = False
        clear_learning_images()
    return {"active": False, "recorded": len(learning_state["events"]),
            "events": learning_state["events"][-200:]}


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

async def show_red_click(page, locator, code, position=None):
    """Show a temporary red click target in the private browser viewer."""
    record_event(code)
    try:
        # Overlay is fixed in the element's frame, with pointer-events disabled.
        await locator.evaluate("""(el, position) => {
            const rect=el.getBoundingClientRect();
            const x=rect.left+(position ? position.x : rect.width/2);
            const y=rect.top+(position ? position.y : rect.height/2);
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
        }""", position, timeout=1500)
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
    # Flow renders the add-elements popup asynchronously. The preceding click
    # can succeed while the nested "Fazer upload" action is still hydrating.
    # Wait for the existing, approved upload control; do NOT alter the image
    # 1/2/3 selection modules or any later settings/generation logic.
    upload_found = False
    upload_deadline = time.monotonic() + 8
    while time.monotonic() < upload_deadline:
        if await click_upload():
            upload_found = True
            break
        await page.wait_for_timeout(400)
    if not upload_found:
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
    image_count = len(names)
    if image_count not in (1, 2, 3):
        raise RuntimeError("flow_reference_count_unsupported")
    record_event("reference_mode_" + str(image_count))
    async def ingredient_count():
        counts = []
        for frame in page.frames[:8]:
            counts.append(await frame.locator("flow-ingredient-chip").count())
        return sum(counts)
    baseline_chips = await ingredient_count()
    import json

    def selection_log(event, **fields):
        # Structural metadata only; do not expose names, prompts or page contents.
        print("mv_reference_diagnostic " + json.dumps(
            {"event": event, "expected": image_count, **fields},
            ensure_ascii=False), flush=True)

    async def observe(ordinal, item=None):
        try:
            opened = await library.is_visible()
        except Exception:
            opened = False
        try:
            chips = await ingredient_count() - baseline_chips
        except Exception:
            chips = -1
        selected = None
        if item is not None and opened:
            try:
                selected = await item.get_attribute("aria-selected", timeout=1000)
            except Exception:
                pass
        selection_log("observed", ordinal=ordinal, library_open=opened,
                      chips_added=chips, selected=selected)
        return opened, chips, selected

    # Only the library selection is dispatched by image count.
    # Upload, Include, settings and Generate remain in the shared controller.
    if image_count == 1:
        from flow_references.single_image import select
    elif image_count == 2:
        from flow_references.two_images import select
    else:
        from flow_references.three_images import select
    selection_result = await select(
        page, names, library, observe, selection_log, ingredient_count,
        baseline_chips, record_event, show_red_click)
    if selection_result is not None:
        return selection_result

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
                    if quantity and int(quantity.group(1)) == (
                            len(names)):
                        candidates.append(control)
                    elif (len(names) in (1, 2) and re.fullmatch(
                        r"\s*(?:incluir no comando|adicionar ao comando|add to prompt|include in prompt)\s*", label, re.I)):
                        # Two-image mode only reaches this point after confirming
                        # both library options are selected.
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
    if image_count == 2:
        for attempt in range(8):
            chips = await ingredient_count() - baseline_chips
            selection_log("two_post_include_check", attempt=attempt + 1,
                          chips_added=chips)
            if chips == 2:
                return {"imagesSubmitted": 2, "referencesIncluded": True,
                        "referencesVerified": True}
            await page.wait_for_timeout(500)
        raise RuntimeError("flow_two_reference_count_unverified")
    return {"imagesSubmitted": len(names), "referencesIncluded": True,
            "referencesVerified": False}


async def configure_flow_agent(page, prompt_control):
    """Set Flow agent defaults, explicitly save, and verify the dialog closed."""
    buttons = []
    for frame in page.frames[:8]:
        controls = frame.get_by_role("button", name=re.compile(
            r"configurações do agente|agent settings|configurações|settings", re.I))
        for i in range(min(await controls.count(), 12)):
            control = controls.nth(i)
            if await control.is_visible() and await control.is_enabled():
                buttons.append(control)
    if not buttons:
        raise RuntimeError("flow_settings_button_not_found")
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
    for _ in range(12):
        for frame in page.frames[:8]:
            dialogs = frame.get_by_role("dialog")
            for i in range(min(await dialogs.count(), 6)):
                candidate = dialogs.nth(i)
                if await candidate.is_visible() and await candidate.get_by_role(
                        "button",name=re.compile(r"^(Salvar|Save)$",re.I)).count()==1:
                    panel = candidate
                    break
            if panel is not None:
                break
            heading = frame.get_by_text(re.compile(
                r"^Configurações do agente$|^Agent settings$",re.I))
            if await heading.count():
                candidate = heading.first.locator(
                    'xpath=ancestor::*[.//button[normalize-space()="Salvar" or normalize-space()="Save"]][1]')
                if await candidate.count()==1 and await candidate.is_visible():
                    panel = candidate
                    break
        if panel is not None:
            break
        await page.wait_for_timeout(250)
    if panel is None:
        raise RuntimeError("flow_settings_panel_not_found")

    async def choose_segmented_option(section, row, value, step):
        """Choose the correct row within the image or video section of Flow."""
        record_event("settings_search_" + step)
        for attempt in range(5):
            result=await panel.evaluate("""(root,args)=>{
                const [section,row,value]=args;
                const norm=s=>(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')
                    .trim().toLowerCase().replace(/\\s+/g,' ');
                const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
                const leaves=[...root.querySelectorAll('*')].filter(e=>visible(e)&&
                    e.children.length===0);
                const headings=leaves.filter(e=>norm(e.textContent).includes(norm(section)));
                if(headings.length!==1)return {state:'heading',count:headings.length};
                const start=headings[0].getBoundingClientRect().top;
                const other=leaves.filter(e=>norm(e.textContent).includes(
                    norm(section==='Padrão da geração de imagens'?
                        'Padrão para geração de vídeo':'Padrão da geração de imagens')));
                const end=section==='Padrão da geração de imagens'?
                    (other.length?other[0].getBoundingClientRect().top:Infinity):Infinity;
                const labels=leaves.filter(e=>{
                    const y=e.getBoundingClientRect().top;
                    return y>start&&y<end&&norm(e.textContent)===norm(value);
                });
                const candidates=labels.filter(e=>{
                    const r=e.getBoundingClientRect();
                    return row==='ratio'?r.top<start+180:r.top>=start+30;
                });
                // The ratio grid and quantity row have repeated values only across sections.
                if(candidates.length!==1)return {state:'option',count:candidates.length};
                let target=candidates[0];
                for(let i=0;i<3&&target.parentElement;i++){
                    if(target.matches('button,[role="radio"],[role="button"]'))break;
                    if(target.parentElement.matches('button,[role="radio"],[role="button"]')){
                        target=target.parentElement;break;
                    }
                    if(target.parentElement.children.length>1)break;
                    target=target.parentElement;
                }
                const checked=[target,...Array.from((target.parentElement||target).querySelectorAll('*'))]
                    .some(e=>e.getAttribute('aria-checked')==='true'||
                        e.getAttribute('aria-pressed')==='true'||
                        e.getAttribute('data-state')==='checked');
                if(checked)return {state:'selected'};
                target.setAttribute('data-mv-setting-target','yes');
                return {state:'click'};
            }""",[section,row,value],timeout=2000)
            if result["state"]=="selected":
                record_event("settings_already_selected_"+step)
                return
            if result["state"]=="click":
                target=panel.locator('[data-mv-setting-target="yes"]')
                try:
                    if await target.count()!=1:
                        raise RuntimeError("flow_settings_ambiguous_"+step)
                    await target.click(timeout=4000)
                    record_event("settings_applied_"+step)
                    return
                finally:
                    if await target.count():
                        await target.first.evaluate("(el)=>el.removeAttribute('data-mv-setting-target')")
            await page.wait_for_timeout(250)
        record_event("settings_missing_"+step)
        raise RuntimeError("flow_settings_missing_"+step)

    # Explicit user-selected Flow policy: Never ask before generating.
    # Restrict selection to the verified agent-settings panel; fail closed on ambiguity.
    never_radio = panel.get_by_role("radio", name=re.compile(r"^Nunca\\b", re.I))
    if await never_radio.count() != 1:
        # Some Flow layouts put the radio label beside (not inside) the radio.
        # Resolve by the exact visible label, within a row containing one radio.
        resolved = await panel.evaluate(r"""root => {
            const visible = el => {
                const b = el.getBoundingClientRect();
                return b.width > 0 && b.height > 0;
            };
            const labels = [...root.querySelectorAll('*')].filter(el =>
                el.children.length === 0 && visible(el) &&
                (el.textContent || '').trim().toLowerCase() === 'nunca');
            const matches = [];
            for (const label of labels) {
                let row = label;
                for (let depth = 0; depth < 5 && row && row !== root; depth++, row = row.parentElement) {
                    const radios = [...row.querySelectorAll('[role="radio"],input[type="radio"]')];
                    if (radios.length === 1 && visible(radios[0])) {
                        matches.push(radios[0]);
                        break;
                    }
                }
            }
            const unique = [...new Set(matches)];
            if (unique.length !== 1) return unique.length;
            unique[0].setAttribute('data-mv-never-radio', 'yes');
            return 1;
        }""")
        if resolved != 1:
            raise RuntimeError("flow_settings_never_not_found")
        never_radio = panel.locator('[data-mv-never-radio="yes"]')
    if await never_radio.count() != 1 or not await never_radio.first.is_visible() or not await never_radio.first.is_enabled():
        raise RuntimeError("flow_settings_never_not_found")
    try:
        radio = never_radio.first
        async def never_is_checked():
            return await radio.evaluate("""el =>
                el.getAttribute('aria-checked') === 'true' ||
                el.checked === true ||
                el.getAttribute('data-state') === 'checked'
            """)
        if not await never_is_checked():
            await radio.click(timeout=4000)
        if not await never_is_checked():
            raise RuntimeError("flow_settings_never_unverified")
        print("mv_settings_confirmation_diagnostic " +
              __import__("json").dumps({"choice": "never", "verified": True}), flush=True)
    finally:
        marked = panel.locator('[data-mv-never-radio="yes"]')
        if await marked.count() == 1:
            await marked.evaluate("(el) => el.removeAttribute('data-mv-never-radio')")

    # The screenshot shows two independent groups: image defaults and video defaults.
    # Never infer a 9:16 control from the whole panel.
    await choose_segmented_option("Padrão da geração de imagens","ratio","9:16","image_ratio")
    await choose_segmented_option("Padrão da geração de imagens","quantity","x1","image_count")
    await choose_segmented_option("Padrão para geração de vídeo","ratio","9:16","video_ratio")
    await choose_segmented_option("Padrão para geração de vídeo","quantity","x1","video_count")
    # The screenshot already shows Nano Banana 2.1; leave the model dropdown unchanged.
    record_event("settings_image_model_preserved")
    # Prefer the prominent Save button physically below the Veo 3.1 model selector.
    # Flow sometimes renders this footer outside the dialog container.
    save_candidates = []
    # Read-only diagnostics; keep the approved Save-by-Veo selection unchanged.
    # No page text, prompts, URLs, HTML, cookies, or coordinates are logged.
    save_diagnostics = []
    for frame_index, frame in enumerate(page.frames[:8]):
        veo_labels = frame.get_by_text(re.compile(r"Veo\s*3\.1", re.I))
        anchors = []
        veo_total = await veo_labels.count()
        for i in range(min(veo_total, 12)):
            label = veo_labels.nth(i)
            if await label.is_visible():
                anchors.append(await label.bounding_box())
        anchors = [box for box in anchors if box]
        controls = frame.get_by_role("button", name=re.compile(r"^(Salvar|Save)$", re.I))
        save_total = await controls.count()
        save_visible = 0
        save_enabled = 0
        save_below_veo = 0
        for i in range(min(save_total, 12)):
            button = controls.nth(i)
            if not await button.is_visible():
                continue
            save_visible += 1
            if not await button.is_enabled():
                continue
            save_enabled += 1
            box = await button.bounding_box()
            if not box:
                continue
            # Same geometry and column check as the approved milestone.
            if any(box["y"] > anchor["y"] + anchor["height"] and
                   box["x"] < anchor["x"] + anchor["width"] + 180 and
                   box["x"] + box["width"] > anchor["x"] - 180
                   for anchor in anchors):
                save_below_veo += 1
                save_candidates.append(button)
        save_diagnostics.append({
            "frame": frame_index, "veoTotal": veo_total,
            "veoVisible": len(anchors), "saveTotal": save_total,
            "saveVisible": save_visible, "saveEnabled": save_enabled,
            "saveBelowVeo": save_below_veo,
        })
    print("mv_settings_save_diagnostic " + __import__("json").dumps({
        "frames": save_diagnostics, "candidateCount": len(save_candidates),
    }), flush=True)
    save_method = "below_veo"
    if not save_candidates:
        # The Flow settings panel may scroll independently of its sticky Save footer.
        # Only fall back to the unique Save belonging to the already verified panel.
        panel_save = panel.get_by_role("button", name=re.compile(r"^(Salvar|Save)$", re.I))
        if await panel_save.count() == 1:
            candidate = panel_save.first
            if await candidate.is_visible() and await candidate.is_enabled():
                save_candidates = [candidate]
                save_method = "verified_settings_panel"
        print("mv_settings_save_fallback " + __import__("json").dumps({
            "panelSaveCount": await panel_save.count(),
            "accepted": save_method == "verified_settings_panel",
        }), flush=True)
    if len(save_candidates) != 1:
        record_event("settings_save_candidates_" + str(len(save_candidates)))
        raise RuntimeError("flow_settings_save_not_found" if not save_candidates
                           else "flow_settings_save_ambiguous")
    save = save_candidates[0]
    print("mv_settings_save_target " + __import__("json").dumps({
        "method": save_method,
    }), flush=True)
    if save_method == "below_veo":
        record_event("settings_save_below_veo_confirmed")
    await show_red_click(page, save, "click_settings")
    await save.click(timeout=4000)
    for _ in range(16):
        if not await panel.is_visible():
            record_event("settings_saved")
            return True
        await page.wait_for_timeout(250)
    raise RuntimeError("flow_settings_save_unverified")


async def click_flow_generate(page, prompt_control, reference_count=0):
    """Find the Flow composer send arrow using prompt geometry and icon metadata."""
    import json

    def generate_log(code, **details):
        # Never log page text, prompts, HTML, credentials or session URLs.
        record_event(code)
        print("mv_generate_diagnostic " + json.dumps(
            {"code": code, **details}, ensure_ascii=False), flush=True)

    candidates = []
    for frame_index, frame in enumerate(page.frames[:8]):
        try:
            controls = frame.locator("button, [role='button']")
            evidence = await frame.locator("body").evaluate(r"""body => {
                const visible=e=>{
                    const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
                };
                const buttons=Array.from(body.querySelectorAll('button,[role="button"]'));
                const prompts=Array.from(body.querySelectorAll('[role="textbox"],[contenteditable="true"]'))
                    .filter(visible).filter(e=>/o que você quer criar|what do you want to create/i.test(
                        [e.getAttribute('aria-label'),e.getAttribute('placeholder'),
                         e.getAttribute('data-placeholder')].join(' ')));
                if(prompts.length!==1)return {indices:[],prompts:prompts.length,gears:0,reason:'prompt_not_unique'};
                const p=prompts[0].getBoundingClientRect();
                const label=e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.textContent]
                    .filter(Boolean).join(' ').trim();
                const gears=buttons.filter(e=>visible(e)&&
                    /^(configurações(?: do (?:agente|vídeo|video))?|(?:agent |video )?settings)$/i.test(label(e)));
                const nearby=gears.map(e=>({e,d:Math.hypot(
                    e.getBoundingClientRect().right-p.right,
                    e.getBoundingClientRect().bottom-p.bottom)})).sort((a,b)=>a.d-b.d);
                const gear=nearby[0]?.e, g=gear?.getBoundingClientRect();
                const indices=buttons.map((e,i)=>({e,i})).filter(({e})=>{
                    if(e===gear||!visible(e)||e.disabled||e.getAttribute('aria-disabled')==='true')return false;
                    const r=e.getBoundingClientRect();
                    const hint=[label(e),e.getAttribute('data-testid'),
                        e.querySelector('mat-icon')?.textContent,
                        e.querySelector('svg')?.getAttribute('data-testid'),
                        e.querySelector('svg')?.getAttribute('class')].filter(Boolean).join(' ');
                    const named=/send|submit|generate|gerar|enviar|arrow_forward|north|upward/i.test(hint);
                    const nearPrompt=Math.abs(r.bottom-p.bottom)<180&&Math.abs(r.right-p.right)<280;
                    const besideGear=!!g&&Math.abs((r.top+r.height/2)-(g.top+g.height/2))<=22
                        &&r.left>=g.right-3&&r.left-g.right<=115;
                    const compact=r.width>=20&&r.width<=76&&r.height>=20&&r.height<=76;
                    // An unnamed control must be uniquely adjacent to the settings icon.
                    return compact&&((named&&nearPrompt)||(besideGear&&(!label(e)||named)));
                }).map(({i})=>i);
                return {indices,prompts:prompts.length,gears:gears.length,reason:'ok'};
            }""", timeout=4500)
            generate_log("generate_discovery", frame=frame_index,
                         prompt_candidates=evidence["prompts"],
                         settings_candidates=evidence["gears"],
                         arrow_candidates=len(evidence["indices"]),
                         reason=evidence["reason"])
            for index in evidence["indices"]:
                candidates.append((frame_index, controls.nth(index)))
        except Exception as exc:
            generate_log("generate_discovery_error", frame=frame_index,
                         error_type=type(exc).__name__)

    if len(candidates) != 1:
        generate_log("generate_target_not_verified", arrow_candidates=len(candidates))
        raise RuntimeError("flow_generate_button_unverified")

    frame_index, target = candidates[0]
    try:
        # Trial validates that the intended DOM control is clickable without activating it.
        await target.click(trial=True, timeout=2500)
        generate_log("generate_target_verified", frame=frame_index,
                     method="prompt_geometry_and_icon_metadata")
        await show_red_click(page, target, "click_generate")
        await target.click(timeout=3500)
        generate_log("generate_click_dispatched", frame=frame_index)
    except Exception as exc:
        generate_log("generate_click_failed", frame=frame_index,
                     error_type=type(exc).__name__)
        raise

    # Three-reference pilot only: wait for the delayed credit prompt.
    # Observation is read-only. Never spend credits or choose "always approve".
    if reference_count == 3:
        try:
            import time
            deadline = time.monotonic() + 45
            poll = 0
            while time.monotonic() < deadline:
                poll += 1
                found = False
                for frame_index, frame in enumerate(page.frames[:8]):
                    try:
                        state = await frame.locator("body").evaluate(r"""body=>{
                            const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                                return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
                            const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
                            const controls=Array.from(body.querySelectorAll('button,[role="button"]')).filter(visible);
                            const names=controls.map(e=>norm(e.innerText||e.getAttribute('aria-label')||''));
                            const approve=names.filter(s=>s==='aprovar'||s==='approve');
                            const always=names.filter(s=>s==='sempre aprovar no projeto'||s==='always approve in this project');
                            const reject=names.filter(s=>s==='rejeitar'||s==='reject');
                            const dialogs=Array.from(body.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog')).filter(visible);
                            const question=Array.from(body.querySelectorAll('p,div,span')).some(e=>visible(e)&&
                                e.children.length===0&&/quer que eu inicie essa.*gerac.{0,3}o de v.deo.*cr.ditos/i.test(norm(e.textContent)));
                            return {approveCount:approve.length,alwaysCount:always.length,rejectCount:reject.length,
                                dialogCount:dialogs.length,creditQuestionVisible:question};
                        }""", timeout=2500)
                        if state["approveCount"] or state["creditQuestionVisible"]:
                            generate_log("credit_prompt_candidate", frame=frame_index, poll=poll, **state)
                        if state["approveCount"] == 1 and state["alwaysCount"] == 1 and state["rejectCount"] == 1:
                            generate_log("credit_prompt_verified_no_click", frame=frame_index, poll=poll, **state)
                            found = True
                            break
                    except Exception as exc:
                        generate_log("credit_prompt_frame_error", frame=frame_index,
                                     error_type=type(exc).__name__)
                if found:
                    break
                await page.wait_for_timeout(1500)
            else:
                generate_log("credit_prompt_not_detected", polls=poll)
        except Exception as exc:
            generate_log("credit_prompt_observation_failed", error_type=type(exc).__name__)
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
                # Keep the observer active across project navigation and robot clicks.
                if learning_state["active"]:
                    for frame in page.frames[:8]:
                        try:
                            await frame.evaluate(LEARNING_SCRIPT)
                        except Exception:
                            pass
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
                # Project navigation replaces the DOM; reattach before upload.
                if learning_state["active"]:
                    for frame in page.frames[:8]:
                        try:
                            await frame.evaluate(LEARNING_SCRIPT)
                        except Exception:
                            pass
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
                # All supported reference counts use the same verified composer
                # Generate locator; never generate if references were not included.
                generate_authorized = bool(images) and uploaded in (1, 2, 3) and references_included
                if data.get("configureSettings") is True or data.get("configureAndGenerate") is True or generate_authorized:
                    settings_applied = await configure_flow_agent(page, prompt_control)
                if generate_authorized and settings_applied:
                    from flow_video_download import gallery_thumbnail_fingerprints
                    before_generation = await gallery_thumbnail_fingerprints(page)
                    record_event("generate_authorized")
                    generation_clicked = await click_flow_generate(page, prompt_control, uploaded)
                    if generation_clicked:
                        generation_watch.update({
                            "active": True, "baseline": before_generation,
                            "projectUrl": page.url.split("/edit/")[0],
                            "startedAt": time.monotonic(), "ready": False,
                            "newFirstObserved": False, "failed": False,
                            "networkFailures": 0, "lastNetworkCategory": None,
                            "cacheCleared": False,
                        })
                        if await flow_retry_message_visible(page):
                            await abort_failed_generation(page, "after_generate_click")
                        print("mv_generation_watch " + __import__("json").dumps({
                            "started": True, "baselineCount": len(before_generation),
                            "failed": generation_watch["failed"]
                        }), flush=True)
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
                       "flow_reference_library_closed_before_second", "flow_reference_count_unsupported",
                       "flow_settings_button_not_found", "flow_settings_button_ambiguous",
                       "flow_settings_panel_not_found", "flow_settings_option_not_found",
                       "flow_settings_model_unverified", "flow_settings_save_not_found",
                       "flow_settings_save_unverified", "flow_settings_never_not_found",
                       "flow_settings_never_unverified",
                       "flow_settings_missing_confirmation", "flow_settings_missing_image_ratio",
                       "flow_settings_missing_image_count", "flow_settings_missing_video_ratio",
                       "flow_settings_missing_video_count", "flow_settings_missing_image_model",
                       "flow_generate_button_unverified"}
            code = str(exc) if str(exc) in allowed else "flow_interaction_failed"
            # Sanitized failure code and exception class only; never log browser text.
            print("mv_stage_failure_diagnostic " + __import__("json").dumps({
                "code": code, "errorType": type(exc).__name__,
            }), flush=True)
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
