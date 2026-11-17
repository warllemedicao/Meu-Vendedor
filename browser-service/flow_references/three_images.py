"""Isolated three-image selection. Keep the gallery in Ctrl multi-select mode."""

async def select(page, names, library, observe, selection_log, ingredient_count,
                 baseline_chips, record_event, show_red_click):
    selection_log("three_multiselect_started")

    async def target_for(name):
        target = library.locator('[role="option"]').filter(has_text=name)
        if await target.count() != 1:
            target = library.locator('[role="option"]').filter(
                has=library.locator('[title="' + name + '"], [alt="' + name + '"]'))
        return target

    for index, name in enumerate(names):
        ordinal = index + 1
        confirmed = False
        for attempt in range(4):
            opened, chips, _ = await observe(ordinal)
            if not opened or chips != 0:
                selection_log("three_gallery_state_changed", ordinal=ordinal,
                              attempt=attempt + 1, gallery_open=opened,
                              chips_added=chips)
                raise RuntimeError("flow_three_gallery_closed_or_auto_attached")
            target = await target_for(name)
            matches = await target.count()
            if matches == 1:
                item = target.first
                selected = await item.get_attribute("aria-selected", timeout=1000)
                selection_log("three_target_observed", ordinal=ordinal,
                              attempt=attempt + 1, selected=selected)
                if selected == "true":
                    confirmed = True
                    break
                if selected == "false":
                    await item.click(trial=True, timeout=2500)
                    await show_red_click(page, item, "click_reference")
                    # Critical: Ctrl on the FIRST click as well. Without Ctrl,
                    # Flow sometimes immediately attaches the first image and
                    # closes the gallery (seen in 3/4 tests at 16:06-16:10).
                    await item.click(modifiers=["Control"], delay=1100,
                                     timeout=6000)
                    record_event("reference_click_confirmed")
                    await page.wait_for_timeout(500)
                    opened, chips, selected = await observe(ordinal, item)
                    if opened and chips == 0 and selected == "true":
                        confirmed = True
                        break
            await page.wait_for_timeout(1500)
        if not confirmed:
            selection_log("three_selection_unconfirmed", ordinal=ordinal)
            raise RuntimeError("flow_three_selection_not_confirmed")

    # Verify the identity of all three selected options, not only a global
    # selection count that can include unrelated controls.
    for check in range(3):
        await page.wait_for_timeout(1200)
        opened, chips, _ = await observe(3)
        if not opened or chips != 0:
            raise RuntimeError("flow_three_gallery_closed_before_include")
        states = []
        for name in names:
            target = await target_for(name)
            if await target.count() != 1:
                raise RuntimeError("flow_three_target_missing_before_include")
            states.append(await target.first.get_attribute("aria-selected"))
        selection_log("three_pre_include_check", check=check + 1,
                      selected_count=states.count("true"))
        if states != ["true", "true", "true"]:
            raise RuntimeError("flow_three_selection_lost")
    record_event("reference_selection_finished")
