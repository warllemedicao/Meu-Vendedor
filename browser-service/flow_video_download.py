"""Download an already-completed Google Flow video using the editor toolbar.

Never create projects, send prompts/references, click Generate or use the
ambiguous global or thumbnail three-dot menus.
"""
import asyncio
import re


async def _locate_editor_download(page, diagnostic):
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
    diagnostic.update({"stage": "find_download_button", "toolbarCandidates": len(candidates),
                       "reason": "toolbar_button_count_not_one" if len(candidates) != 1 else "verified"})
    if len(candidates) != 1:
        raise RuntimeError("flow_video_download_control_not_unique")
    return candidates[0]


async def _open_completed_video(page, event, show_click, diagnostic):
    if re.search(r"/edit/", page.url):
        diagnostic.update({"stage": "editor_open", "editorOpen": True, "reason": "already_in_editor"})
        return
    if not page.url.startswith("https://flow.google.com/project/"):
        diagnostic.update({"stage": "project_check", "reason": "not_flow_project"})
        raise RuntimeError("flow_video_project_not_unique")

    # The user explicitly prioritizes the first completed video card in the
    # gallery, left-to-right in the top visible row. Decorative videos and
    # duplicate/nested video elements are excluded before ranking.
    candidates = []
    diagnostics = []
    for frame_index, frame in enumerate(page.frames[:8]):
        try:
            matches = await frame.locator("body").evaluate(r"""body => {
                const seen=new Set(), result=[];
                const elements=[...body.querySelectorAll('video,[role="video"]')];
                for (let i=0;i<elements.length;i++) {
                    const e=elements[i],r=e.getBoundingClientRect(),s=getComputedStyle(e);
                    const inView=r.bottom>100&&r.top<innerHeight&&r.right>110&&r.left<innerWidth;
                    if(s.display==='none'||s.visibility==='hidden'||!inView)continue;
                    if(r.width<220||r.height<120||r.width/r.height<1.3||r.left<110||r.top<85)continue;
                    const key=[Math.round(r.left/6),Math.round(r.top/6),
                        Math.round(r.width/6),Math.round(r.height/6)].join(':');
                    if(seen.has(key))continue;
                    seen.add(key);
                    result.push({index:i,width:r.width,height:r.height,
                        area:r.width*r.height, top:r.top,left:r.left});
                }
                return result;
            }""", timeout=3500)
            controls = frame.locator('video,[role="video"]')
            diagnostics.append({"frame": frame_index, "eligible": len(matches)})
            for item in matches:
                candidates.append((controls.nth(item["index"]), item))
        except Exception:
            diagnostics.append({"frame": frame_index, "eligible": -1})
    import json
    print("mv_video_preview_diagnostic " + json.dumps({
        "candidates": len(candidates), "frames": diagnostics
    }), flush=True)
    # Report *why* no click occurred, rather than showing zero captured clicks.
    diagnostic.update({"stage": "find_video_preview", "videoCandidates": len(candidates),
                       "frames": diagnostics, "reason": "no_eligible_video" if not candidates else "verified"})
    if not candidates:
        raise RuntimeError("flow_video_not_unique")
    candidates.sort(key=lambda item: (round(item[1]["top"] / 45),
                                      item[1]["left"], item[1]["top"]))
    video, chosen = candidates[0]
    print("mv_video_preview_selection " + json.dumps({
        "rule": "first_top_row_left_to_right",
        "candidates": len(candidates),
        "left": round(chosen["left"]),
        "top": round(chosen["top"])
    }), flush=True)
    diagnostic.update({"stage": "click_video_preview", "reason": "click_not_dispatched",
                       "selectedLeft": round(chosen["left"]), "selectedTop": round(chosen["top"])})
    await video.click(trial=True, timeout=3500)
    await show_click(page, video, "click_video_preview")
    await video.click(timeout=3500, position={"x": 25, "y": 25})
    diagnostic.update({"stage": "wait_for_editor", "previewClicked": True,
                       "reason": "editor_navigation_pending"})
    try:
        await page.wait_for_url(re.compile(r"^https://flow\.google\.com/project/[^/]+/edit/"),
                                timeout=12000)
    except Exception:
        diagnostic.update({"reason": "editor_url_not_confirmed"})
        raise RuntimeError("flow_video_editor_not_open") from None


async def download_existing_video(page, before_ids, finished_mp4_files, event, show_click, diagnostic):
    diagnostic.update({"stage": "start", "reason": "started", "videoCandidates": 0,
                       "toolbarCandidates": 0, "resolutionCandidates": 0,
                       "previewClicked": False, "editorOpen": False})
    await _open_completed_video(page, event, show_click, diagnostic)
    if not re.search(r"^https://flow\.google\.com/project/[^/]+/edit/", page.url):
        diagnostic.update({"stage": "editor_check", "reason": "editor_url_not_confirmed"})
        raise RuntimeError("flow_video_editor_not_open")
    diagnostic.update({"stage": "editor_open", "editorOpen": True, "reason": "verified"})

    frame, button = await _locate_editor_download(page, diagnostic)
    await button.click(trial=True, timeout=3500)
    await show_click(page, button, "click_video_download_menu")
    await button.click(timeout=3500)
    diagnostic.update({"stage": "find_720p", "downloadMenuClicked": True,
                       "reason": "resolution_not_verified"})

    # The open menu contains a single enabled "720p - Tamanho original"
    # option. Never choose 270p GIF or paid 1080p/4K.
    options = frame.get_by_role("menuitem", name=re.compile(r"^\s*720p(?:\s|$)", re.I))
    for _ in range(8):
        if await options.count() == 1 and await options.first.is_visible():
            break
        await asyncio.sleep(0.25)
    diagnostic["resolutionCandidates"] = await options.count()
    if diagnostic["resolutionCandidates"] != 1 or not await options.first.is_visible() or not await options.first.is_enabled():
        raise RuntimeError("flow_video_download_control_not_unique")

    await show_click(page, options.first, "click_video_720p")
    await options.first.click(timeout=3500)
    diagnostic.update({"stage": "wait_for_mp4", "resolutionClicked": True,
                       "reason": "mp4_not_confirmed"})

    # Verify a finished new MP4; the download directory excludes .crdownload.
    for _ in range(50):
        await asyncio.sleep(0.5)
        new_files = [item for item in finished_mp4_files() if item["id"] not in before_ids]
        if len(new_files) == 1:
            diagnostic.update({"stage": "completed", "reason": "mp4_confirmed"})
            event("video_download_detected")
            return {key: new_files[0][key] for key in ("id", "name", "bytes", "modifiedAt")}
        if len(new_files) > 1:
            raise RuntimeError("flow_video_download_control_not_unique")
    diagnostic.update({"reason": "download_timeout"})
    raise RuntimeError("flow_video_download_not_started")
