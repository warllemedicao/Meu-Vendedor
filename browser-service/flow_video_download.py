"""Isolated, conservative download action for an already rendered Google Flow video.

No prompt input, image upload, project creation or generation is permitted here.
"""
import asyncio
import re


async def download_existing_video(page, before_ids, finished_mp4_files, event, show_click):
    if not page.url.startswith("https://flow.google.com/project/"):
        raise RuntimeError("flow_video_project_not_unique")

    # Find the *video thumbnail's* own three-dot control. Flow also has a
    # global More menu in the top toolbar; its label is similar but it must
    # NEVER be used. The button must sit on the upper-right of a sizable,
    # visible media thumbnail (img/video), not just anywhere on the page.
    targets = []
    for frame in page.frames[:8]:
        try:
            evidence = await frame.locator("body").evaluate(r"""body => {
                const visible = el => {
                    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
                    return r.width>0&&r.height>0&&s.display!=='none'&&
                        s.visibility!=='hidden'&&s.opacity!=='0';
                };
                const controls=[...body.querySelectorAll('button,[role="button"]')];
                const thumbs=[...body.querySelectorAll('video,img')].filter(visible)
                    .map(el=>el.getBoundingClientRect())
                    .filter(r=>r.width>=140&&r.height>=90&&r.top>=90);
                const indices=[];
                for (let i=0;i<controls.length;i++) {
                    const e=controls[i],r=e.getBoundingClientRect();
                    if(!visible(e)||e.disabled||e.getAttribute('aria-disabled')==='true')continue;
                    const label=[e.getAttribute('aria-label'),e.getAttribute('title'),
                        e.getAttribute('data-testid')].filter(Boolean).join(' ').trim();
                    if(!/^(mais|more|more options|mais op(?:ç|c)ões|op(?:ç|c)ões)$/i.test(label))continue;
                    const x=r.left+r.width/2,y=r.top+r.height/2;
                    if(thumbs.some(t=>x>=t.left&&x<=t.right+8&&
                        y>=t.top-8&&y<=t.top+t.height*0.40&&
                        x>=t.left+t.width*0.60))indices.push(i);
                }
                return {indices,mediaCount:thumbs.length};
            }""", timeout=4000)
            controls = frame.locator("button, [role='button']")
            for idx in evidence["indices"]:
                targets.append((frame, controls.nth(idx)))
        except Exception:
            continue
    if len(targets) != 1:
        event("video_menu_not_unique")
        raise RuntimeError("flow_video_download_control_not_unique")

    frame, menu_button = targets[0]
    # Only hover/click the already-verified button. Never click the thumbnail,
    # because that would open the video editor.
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
