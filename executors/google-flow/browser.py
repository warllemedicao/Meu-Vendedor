"""Ephemeral, authenticated browser. Login cookies persist only in the app's encrypted vault."""
import asyncio
import hmac
import os
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, Response
from playwright.async_api import async_playwright

ALLOWED = ('google.com', 'labs.google', 'gstatic.com', 'googleapis.com', 'googleusercontent.com', 'recaptcha.net', 'googlevideo.com')

def allowed(url):
    parsed = urlsplit(url)
    return parsed.scheme == 'https' and any(parsed.hostname == host or (parsed.hostname or '').endswith('.' + host) for host in ALLOWED)

def authorize(request, variable):
    expected = os.environ.get(variable, '')
    if len(expected) < 32 or not hmac.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + expected):
        raise HTTPException(401)

@asynccontextmanager
async def lifespan(app):
    display = subprocess.Popen(['Xvfb', ':99', '-screen', '0', '1280x900x24'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.environ['DISPLAY'] = ':99'
    await asyncio.sleep(.5)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = await browser.new_context(viewport={'width':1280, 'height':900}, locale='pt-BR', accept_downloads=True, service_workers='block')
        async def guard(route):
            if allowed(route.request.url): await route.continue_()
            else: await route.abort()
        await context.route('**/*', guard)
        page = await context.new_page()
        app.state.context = context
        app.state.page = page
        app.state.lock = asyncio.Lock()
        try:
            await page.goto('https://flow.google.com/', wait_until='domcontentloaded', timeout=45000)
        except Exception:
            pass  # A navigation failure is inspected by the controller, never reported as connected.
        yield
        await context.close()
        await browser.close()
    display.terminate()

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

@app.middleware('http')
async def private_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()'})
    return response

def active_page():
    pages = [p for p in app.state.context.pages if not p.is_closed()]
    if not pages: raise HTTPException(410)
    return pages[-1]

@app.get('/view')
async def view():
    return HTMLResponse(Path('/opt/flow/view.html').read_text(), headers={'Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev http://localhost:3000"})

@app.get('/screenshot')
async def screenshot(request: Request):
    authorize(request, 'VIEW_TOKEN')
    async with app.state.lock:
        return Response(await active_page().screenshot(type='jpeg', quality=65), media_type='image/jpeg')

@app.post('/input')
async def remote_input(request: Request):
    authorize(request, 'VIEW_TOKEN')
    raw = await request.body()
    if len(raw) > 20000: raise HTTPException(413)
    import json
    body = json.loads(raw)
    async with app.state.lock:
        page = active_page()
        kind = body.get('kind')
        if kind == 'click':
            x, y = body.get('x'), body.get('y')
            if not isinstance(x, (int,float)) or not isinstance(y, (int,float)) or not (0 <= x <= 1280 and 0 <= y <= 900): raise HTTPException(400)
            await page.mouse.click(x,y)
        elif kind == 'text':
            text = body.get('text')
            if not isinstance(text,str) or len(text) > 4000: raise HTTPException(400)
            await page.keyboard.insert_text(text)
        elif kind == 'key':
            if body.get('key') not in ['Enter','Tab','Backspace','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','ControlOrMeta+A']: raise HTTPException(400)
            await page.keyboard.press(body['key'])
        elif kind == 'scroll':
            delta = body.get('delta')
            if not isinstance(delta,(int,float)) or abs(delta)>2000: raise HTTPException(400)
            await page.mouse.wheel(0,delta)
        else: raise HTTPException(400)
    return {'ok':True}

@app.post('/rpc')
async def rpc(request: Request):
    authorize(request, 'CONTROL_TOKEN')
    raw = await request.body()
    if len(raw)>140000: raise HTTPException(413)
    import json
    body=json.loads(raw)
    async with app.state.lock:
        action=body.get('action')
        if action=='health': return {'ready':True}
        if action=='restore':
            cookies=body.get('cookies',[])
            if not isinstance(cookies,list) or len(cookies)>500: raise HTTPException(400)
            clean=[]
            for cookie in cookies:
                if not isinstance(cookie,dict): raise HTTPException(400)
                domain=str(cookie.get('domain','')).lstrip('.')
                if domain=='google.com' or domain.endswith('.google.com') or domain=='labs.google':
                    clean.append({key:value for key,value in cookie.items() if key in ['name','value','domain','path','expires','httpOnly','secure','sameSite']})
            await app.state.context.add_cookies(clean)
            await app.state.page.goto('https://flow.google.com/',wait_until='domcontentloaded',timeout=45000)
            return {'restored':True}
        if action not in ['verify','save']: raise HTTPException(400)
        pages=[p for p in app.state.context.pages if not p.is_closed()]
        page=next((p for p in reversed(pages) if urlsplit(p.url).hostname in ['flow.google.com','labs.google']),active_page())
        observed=await page.evaluate(Path('/opt/flow/inspection.js').read_text())
        result={'observed':observed}
        if action=='save':
            # Only the trusted controller can retrieve cookies; the view token cannot.
            result['cookies']=await app.state.context.cookies()
        return result
