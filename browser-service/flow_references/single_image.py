"""Isolated Google Flow library selection routine; no settings or generation changes."""

async def select(page, names, library, observe, selection_log, ingredient_count,
                 baseline_chips, record_event, show_red_click):
    ordinal = 1
    name = names[0]
    target = library.locator('[role="option"]').filter(has_text=name)
    if await target.count() != 1:
        target = library.locator('[role="option"]').filter(
            has=library.locator('[title="' + name + '"], [alt="' + name + '"]'))
    if await target.count() != 1:
        raise RuntimeError("flow_reference_selection_unavailable")
    item = target.first
    await item.click(trial=True, timeout=2500)
    await show_red_click(page, item, "click_reference")
    await item.click(timeout=6000)
    record_event("reference_click_confirmed")
    for attempt in range(12):
        opened, chips, selected = await observe(ordinal)
        if chips == 1:
            record_event("reference_single_auto_included")
            selection_log("single_auto_included", ordinal=ordinal, chips_added=chips)
            return {"imagesSubmitted": 1, "referencesIncluded": True,
                    "referencesVerified": False}
        await page.wait_for_timeout(500)
    raise RuntimeError("flow_reference_selection_unavailable")
