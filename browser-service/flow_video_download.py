"""Download an already-completed Google Flow video using the editor toolbar.

Never create projects, send prompts/references, click Generate or use the
ambiguous global or thumbnail three-dot menus.
"""
import asyncio
import re


async def _locate_editor_download(page):
    """Return one verified download toolbar button, or fail without clicking."""
    candidates = []
    for frame in page.frames[:8]:
        try:
            evidence = await frame.locator("body").evaluate(r"""body => {
                const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
                const buttons=[...body.querySelectorAll('button,[role="button"]')];
                const hint=e=>[e.getAttribute('aria-label'),e.getAttribute('title'),
                    e.getAttribute('data-testid'),e.getAttribute('data-tooltip'),
                    e.querySelector('svg')?.getAttribute('data-testid'),
                    e.querySelector('svg')?.getAttribute('class'),
                    e.querySelector('mat-icon')?.textContent].filter(Boolean).join(' ').toLowerCase();
                const matches=buttons.map((e,i)=>({e,i})).filter(({e})=>{
                    const r=e.getBoundingClientRect(), x=r.left+r.width/2;
                    return visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&
                        r.top>=0&&r.top<170&&r.width>=20&&r.width<=75&&
                        x>=innerWidth*.35&&x<=innerWidth*.90&&
                        /(?:download|baixar|file_download|arrow_down_to_line)/i.test(hint(e));
                }).map(({i})=>i);
                return matches;
            }""", timeout=3500)
            buttons = frame.locator("button, [role='button']")
            for index in evidence:
                candidates.append((frame, buttons.nth(index)))
        except Exception:
            continue
    if len(candidates) != 1:
        raise RuntimeError("flow_video_download_control_not_unique")
    return candidates[0]


async def _open_completed_video(page, event, show_click):
    if re.search(r"/edit/", page.url):
        return
    if not page.url.startswith("https://flow.google.com/project/"):
        raise RuntimeError("flow_video_project_not_unique")

    # Prefer one prominent HTML5 video. A click on its visual surface opens
    # the editor in the user's recorded workflow; never click any three-dot menu.
    candidates = []
    for frame in page.frames[:8]:
        try:
            videos = frame.locator("video")
            for i in range(min(await videos.count(), 40)):
                video = videos.nth(i)
                if not await video.is_visible():
                    continue
                rect = await video.bounding_box()
                if rect and rect["width"] >= 220 and rect["height"] >= 120 and rect["y"] >= 80:
                    candidates.append((video, rect["width"] * rect["height"]))
        except Exception:
            continue
    candidates.sort(key=lambda item: item[1], reverse=True)
    if not candidates or (len(candidates) > 1 and candidates[1][1] >= candidates[0][1] * 0.85):
        raise RuntimeError("flow_video_not_unique")

    video = candidates[0][0]
    await video.click(trial=True, timeout=3500)
    await show_click(page, video, "click_video_preview")
    await video.click(timeout=3500, position={"x": 25, "y": 25})
    try:
        await page.wait_for_url(re.compile(r"^https://flow\.google\.com/project/[^/]+/edit/"),
                                timeout=12000)
    except Exception:
        raise RuntimeError("flow_video_editor_not_open") from None


async def download_existing_video(page, before_ids, finished_mp4_files, event, show_click):
    await _open_completed_video(page, event, show_click)
    if not re.search(r"^https://flow\.google\.com/project/[^/]+/edit/", page.url):
        raise RuntimeError("flow_video_editor_not_open")

    frame, button = await _locate_editor_download(page)
    await button.click(trial=True, timeout=3500)
    await show_click(page, button, "click_video_download_menu")
    await button.click(timeout=3500)

    # The open menu contains a single enabled "720p - Tamanho original"
    # option. Never choose 270p GIF or paid 1080p/4K.
    options = frame.get_by_role("menuitem", name=re.compile(r"^\s*720p(?:\s|$)", re.I))
    for _ in range(8):
        if await options.count() == 1 and await options.first.is_visible():
            break
        await asyncio.sleep(0.25)
    if await options.count() != 1 or not await options.first.is_visible() or not await options.first.is_enabled():
        raise RuntimeError("flow_video_download_control_not_unique")

    await show_click(page, options.first, "click_video_720p")
    await options.first.click(timeout=3500)

    # Verify a finished new MP4; the download directory excludes .crdownload.
    for _ in range(50):
        await asyncio.sleep(0.5)
        new_files = [item for item in finished_mp4_files() if item["id"] not in before_ids]
        if len(new_files) == 1:
            event("video_download_detected")
            return {key: new_files[0][key] for key in ("id", "name", "bytes", "modifiedAt")}
        if len(new_files) > 1:
            raise RuntimeError("flow_video_download_control_not_unique")
    raise RuntimeError("flow_video_download_not_started")
