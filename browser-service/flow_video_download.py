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
    await menu_button.click(trial=True, timeout=3000)
    await menu_button.click(timeout=3000)
    event("click_video_menu")
    menu = frame.get_by_role("menuitem", name=re.compile(r"^Fazer o download(?:\s.*)?$|^Download(?:\s.*)?$", re.I))
    if await menu.count() != 1 or not await menu.is_visible():
        raise RuntimeError("flow_video_download_control_not_unique")
    await menu.click(timeout=3000)
    event("click_video_download_menu")

    # Never select GIF 270p, paid 1080p or 4K.
    resolution = frame.get_by_role("menuitem", name=re.compile(r"^720p(?:\s|$)", re.I))
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
