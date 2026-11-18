"""Isolated, conservative download action for an already rendered Google Flow video.

No prompt input, image upload, project creation or generation is permitted here.
"""
import asyncio
import re


async def download_existing_video(page, before_ids, finished_mp4_files, event, show_click):
    if not page.url.startswith("https://flow.google.com/project/"):
        raise RuntimeError("flow_video_project_not_unique")

    # First REVEAL the hidden three-dot control by moving the mouse over the
    # top-right corner of the video thumbnail. Hover never opens the editor.
    # Select one prominent thumbnail; avoid global toolbar menus entirely.
    thumbs = []
    for frame in page.frames[:8]:
        try:
            media = frame.locator("video, img")
            info = await frame.locator("body").evaluate(r"""body => {
                const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);
                    return r.width>=220&&r.height>=120&&r.top>=100&&
                        s.display!=='none'&&s.visibility!=='hidden'};
                return [...body.querySelectorAll('video,img')].map((e,i)=>{
                    const r=e.getBoundingClientRect();return {i,w:r.width,h:r.height,
                        x:r.left,y:r.top,valid:visible(e)};
                }).filter(x=>x.valid);
            }""", timeout=4000)
            for item in info:
                thumbs.append((frame, media.nth(item["i"]), item))
        except Exception:
            continue
    if not thumbs:
        event("video_menu_not_unique")
        raise RuntimeError("flow_video_download_control_not_unique")
    # Largest thumbnail is the active candidate only if unambiguous;
    # multiple similar-size videos require the user to narrow the page.
    thumbs.sort(key=lambda row: row[2]["w"] * row[2]["h"], reverse=True)
    largest = thumbs[0][2]["w"] * thumbs[0][2]["h"]
    if len(thumbs) > 1 and thumbs[1][2]["w"] * thumbs[1][2]["h"] >= largest * 0.85:
        event("video_menu_not_unique")
        raise RuntimeError("flow_video_download_control_not_unique")
    frame, thumbnail, box = thumbs[0]
    # Moving the cursor onto the thumbnail is safe; DO NOT click the image.
    await thumbnail.hover(position={"x": max(1, box["w"] - 22),
                                   "y": min(22, box["h"] / 5)}, timeout=3000)
    await asyncio.sleep(0.35)

    # Find the revealed button strictly within the chosen thumbnail's
    # upper-right zone. A global More button cannot pass this geometry.
    evidence = await frame.locator("body").evaluate(r"""(body, bounds) => {
        const controls=[...body.querySelectorAll('button,[role="button"]')];
        const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);
            return r.width>0&&r.height>0&&s.display!=='none'&&
                s.visibility!=='hidden'&&s.opacity!=='0'};
        return controls.map((e,i)=>({e,i})).filter(({e})=>{
            const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
            const name=[e.getAttribute('aria-label'),e.getAttribute('title'),
                e.getAttribute('data-testid')].filter(Boolean).join(' ').trim();
            return visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&
                /^(mais|more|more options|mais op(?:ç|c)ões|op(?:ç|c)ões)$/i.test(name)&&
                cx>=bounds.x+bounds.w*.60&&cx<=bounds.x+bounds.w+8&&
                cy>=bounds.y-8&&cy<=bounds.y+bounds.h*.40;
        }).map(({i})=>i);
    }""", {"x": box["x"], "y": box["y"], "w": box["w"], "h": box["h"]},
        timeout=4000)
    if len(evidence) != 1:
        event("video_menu_not_unique")
        raise RuntimeError("flow_video_download_control_not_unique")
    menu_button = frame.locator("button, [role='button']").nth(evidence[0])
    await menu_button.hover(timeout=3000)
    await menu_button.click(trial=True, timeout=3000)
    await show_click(page, menu_button, "click_video_menu")
    await menu_button.click(timeout=3000)

    # Menus may be rendered as portals, outside the video card. Restrict discovery
    # to the opened flow-more-options-menu rather than matching global page text.
    opened = frame.locator("flow-more-options-menu:visible, [data-testid='flow-more-options-menu']:visible")
    if await opened.count() != 1:
        raise RuntimeError("flow_video_download_control_not_unique")
    download_items = opened.locator("[role='menuitem']").filter(
        has_text=re.compile(r"^\s*(?:Fazer o download|Download)\s*$", re.I))
    if await download_items.count() != 1 or not await download_items.first.is_visible():
        raise RuntimeError("flow_video_download_control_not_unique")
    # A submenu may open by hover alone, but click is supported in the manual trace.
    await download_items.first.hover(timeout=3000)
    await show_click(page, download_items.first, "click_video_download_menu")
    await download_items.first.click(timeout=3000)

    # Scope to the currently opened submenu. Only 720p original MP4 is accepted.
    resolution = frame.get_by_role("menuitem", name=re.compile(r"^720p(?:\s|$)", re.I))
    if await resolution.count() != 1 or not await resolution.is_visible() or not await resolution.is_enabled():
        raise RuntimeError("flow_video_download_control_not_unique")
    await show_click(page, resolution, "click_video_720p")
    await resolution.click(timeout=3000)

    for _ in range(40):
        await asyncio.sleep(0.5)
        new_files = [item for item in finished_mp4_files() if item["id"] not in before_ids]
        if len(new_files) == 1:
            event("video_download_detected")
            return {key: new_files[0][key] for key in ("id", "name", "bytes", "modifiedAt")}
        if len(new_files) > 1:
            raise RuntimeError("flow_video_download_control_not_unique")
    raise RuntimeError("flow_video_download_not_started")
