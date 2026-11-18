"""Isolated, conservative download action for an already rendered Google Flow video.

No prompt input, image upload, project creation or generation is permitted here.
"""
import asyncio
import re


async def download_existing_video(page, before_ids, finished_mp4_files, event):
    if not page.url.startswith("https://flow.google.com/project/"):
        raise RuntimeError("flow_video_project_not_unique")

    # The user must leave one completed video visible. Do not guess among cards.
    targets = []
    for frame in page.frames[:8]:
        buttons = frame.locator("button, [role='button']")
        for index in range(min(await buttons.count(), 200)):
            button = buttons.nth(index)
            try:
                if not await button.is_visible() or not await button.is_enabled():
                    continue
                hint = await button.evaluate("""e => [e.getAttribute('aria-label'),e.getAttribute('title'),
                    e.getAttribute('data-testid')].filter(Boolean).join(' ')""")
                if re.search(r"^(mais|more|more options|mais op(?:ç|c)ões|op(?:ç|c)ões)$", hint.strip(), re.I):
                    targets.append((frame, button))
            except Exception:
                continue
    if len(targets) != 1:
        event("video_menu_not_unique")
        raise RuntimeError("flow_video_download_control_not_unique")

    frame, menu_button = targets[0]
    # Hover the verified three-dot button, never the video thumbnail: clicking the
    # thumbnail would open the editor. The Flow renders this menu on hover.
    await menu_button.hover(timeout=3000)
    await menu_button.click(trial=True, timeout=3000)
    await menu_button.click(timeout=3000)
    event("click_video_menu")

    # Menus may be rendered as portals, outside the video card. Restrict discovery
    # to the opened flow-more-options-menu rather than matching global page text.
    opened = frame.locator("flow-more-options-menu:visible, [data-testid='flow-more-options-menu']:visible")
    if await opened.count() != 1:
        raise RuntimeError("flow_video_download_control_not_unique")
    download_items = opened.locator("[role='menuitem']").filter(
        has_text=re.compile(r"^\\s*(?:Fazer o download|Download)\\s*$", re.I))
    if await download_items.count() != 1 or not await download_items.first.is_visible():
        raise RuntimeError("flow_video_download_control_not_unique")
    # A submenu may open by hover alone, but click is supported in the manual trace.
    await download_items.first.hover(timeout=3000)
    await download_items.first.click(timeout=3000)
    event("click_video_download_menu")

    # Scope to the currently opened submenu. Only 720p original MP4 is accepted.
    resolution = frame.get_by_role("menuitem", name=re.compile(r"^720p(?:\\s|$)", re.I))
    if await resolution.count() != 1 or not await resolution.is_visible() or not await resolution.is_enabled():
        raise RuntimeError("flow_video_download_control_not_unique")
    await resolution.click(timeout=3000)
    event("click_video_720p")

    for _ in range(40):
        await asyncio.sleep(0.5)
        new_files = [item for item in finished_mp4_files() if item["id"] not in before_ids]
        if len(new_files) == 1:
            event("video_download_detected")
            return {key: new_files[0][key] for key in ("id", "name", "bytes", "modifiedAt")}
        if len(new_files) > 1:
            raise RuntimeError("flow_video_download_control_not_unique")
    raise RuntimeError("flow_video_download_not_started")
