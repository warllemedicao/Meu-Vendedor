"""Isolated Google Flow library selection routine; no settings or generation changes."""

async def select(page, names, library, observe, selection_log, ingredient_count,
                 baseline_chips, record_event, show_red_click):
    for index, name in enumerate(names):
        # Never select an unrelated library asset by gallery position.
        target = library.locator('[role="option"]').filter(has_text=name)
        if await target.count() != 1:
            target = library.locator('[role="option"]').filter(
                has=library.locator('[title="' + name + '"], [alt="' + name + '"]'))
        if await target.count() != 1:
            raise RuntimeError("flow_reference_selection_unavailable")
        item = target.first
        await item.click(trial=True, timeout=2500)
        await show_red_click(page, item, "click_reference")
        # Every reference needs a deliberate press-and-hold, not only the first.
        # Keep Ctrl on subsequent images to preserve the existing multi-select.
        if index > 0:
            await item.click(modifiers=["Control"], delay=1100, timeout=6000)
        else:
            await item.click(delay=1100, timeout=6000)
        record_event("reference_click_confirmed")
        await page.wait_for_timeout(900)
    record_event("reference_selection_finished")

