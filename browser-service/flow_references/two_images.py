"""Isolated Google Flow library selection routine; no settings or generation changes."""

async def select(page, names, library, observe, selection_log, ingredient_count,
                 baseline_chips, record_event, show_red_click):
    # Two images: complete multi-selection inside the library before Include.
    # Never reopen the composer or try to attach images individually.
    selection_log("two_library_only_started")
    async def two_target(name):
        target = library.locator('[role="option"]').filter(has_text=name)
        if await target.count() != 1:
            target = library.locator('[role="option"]').filter(
                has=library.locator('[title="' + name + '"], [alt="' + name + '"]'))
        return target

    async def two_verified_targets():
        states = []
        for name in names:
            target = await two_target(name)
            if await target.count() != 1:
                return False
            states.append(await target.first.get_attribute("aria-selected"))
        return states == ["true", "true"]

    for index, name in enumerate(names):
        ordinal = index + 1
        selected_confirmed = False
        for attempt in range(4):
            opened, chips, _ = await observe(ordinal)
            if not opened:
                selection_log("two_library_closed_during_selection",
                              ordinal=ordinal, attempt=attempt + 1,
                              chips_added=chips)
                raise RuntimeError("flow_two_library_closed_before_selection")
            if chips != 0:
                selection_log("two_premature_auto_attach", ordinal=ordinal,
                              chips_added=chips)
                raise RuntimeError("flow_two_premature_auto_attach")
            target = await two_target(name)
            matches = await target.count()
            selection_log("two_target_observed", ordinal=ordinal,
                          attempt=attempt + 1, matches=matches,
                          target_selected=(await target.first.get_attribute("aria-selected")
                                           if matches == 1 else "unavailable"))
            if matches == 1:
                item = target.first
                selected = await item.get_attribute("aria-selected", timeout=1000)
                if selected == "true":
                    selected_confirmed = True
                    break
                if selected == "false":
                    await item.click(trial=True, timeout=2500)
                    await show_red_click(page, item, "click_reference")
                    # Ctrl on BOTH clicks keeps the gallery in multi-select mode.
                    # Preserve the proven 1100ms press duration.
                    await item.click(modifiers=["Control"], delay=1100,
                                     timeout=6000)
                    record_event("reference_click_confirmed")
                    await page.wait_for_timeout(500)
                    opened, chips, selected = await observe(ordinal, item)
                    if opened and chips == 0 and selected == "true":
                        selected_confirmed = True
                        break
            selection_log("two_selection_not_yet_confirmed",
                          ordinal=ordinal, attempt=attempt + 1)
            await page.wait_for_timeout(2000)
        if not selected_confirmed:
            raise RuntimeError("flow_two_selection_not_confirmed")
        selection_log("two_target_verified", ordinal=ordinal)
    # Wait for the gallery to settle, then verify BOTH specific references
    # again; global selected counts include unrelated UI options.
    for check in range(3):
        await page.wait_for_timeout(2000)
        if not await library.is_visible():
            raise RuntimeError("flow_two_library_closed_before_include")
        verified = await two_verified_targets()
        selection_log("two_pre_include_stability_check",
                      check=check + 1, both_targets_selected=verified)
        if not verified:
            raise RuntimeError("flow_two_target_selection_lost")
    # Never authorize Include solely on the global selected-option count.

    if await ingredient_count() != baseline_chips:
        raise RuntimeError("flow_two_premature_auto_attach")
    selection_log("two_both_selected_before_include", targets_verified=2)
    record_event("reference_selection_finished")

