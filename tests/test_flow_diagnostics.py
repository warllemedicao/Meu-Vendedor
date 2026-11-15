"""Simulated browser observations, without Modal, Google login or generation."""
import importlib.util
import ast
import json
from pathlib import Path
import re
import unittest

spec = importlib.util.spec_from_file_location('flow_diagnostics', Path(__file__).parents[1] / 'executors/google-flow/flow_diagnostics.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Browser:
    def __init__(self, observations):
        self.observations, self.index, self.now = observations, 0, 0
        self.frames = [self]

    def locator(self, selector):
        return self

    async def evaluate(self, script, **kwargs):
        observation = self.observations[min(self.index, len(self.observations)-1)]
        if isinstance(observation, Exception):
            raise observation
        return observation

    async def wait_for_timeout(self, milliseconds):
        self.now += milliseconds / 1000
        self.index += 1


class SettingsControl:
    def __init__(self, label='Configurações do agente', enabled=True, blocked=False):
        self.label, self.enabled, self.blocked, self.clicks = label, enabled, blocked, []

    async def is_visible(self):
        return True

    async def is_enabled(self):
        return self.enabled

    async def click(self, trial=False, **kwargs):
        self.clicks.append(trial)
        if self.blocked:
            raise TimeoutError('private-signed-url and private DOM text')


class SettingsPage:
    def __init__(self, controls, labels=None, read_error=False):
        self.controls, self.frames, self.read_error = controls, [self], read_error
        self.labels = labels if labels is not None else [{'label':'9:16','selected':'true'}, {'label':'x1','selected':'true'}]

    def get_by_role(self, role, name):
        self.matches = [control for control in self.controls if name.search(control.label)]
        return self

    async def count(self):
        return len(self.matches)

    def nth(self, index):
        return self.matches[index]

    def locator(self, selector):
        return self

    async def evaluate_all(self, script):
        if self.read_error:
            raise RuntimeError('private-read-error')
        return self.labels

    async def wait_for_timeout(self, milliseconds):
        pass


class Collection:
    def __init__(self, items): self.items = items
    async def count(self): return len(self.items)
    def nth(self, index): return self.items[index]
    def filter(self, has_text): return Collection([item for item in self.items if has_text.search(item.name)])


class AssetControl(SettingsControl):
    def __init__(self, name):
        super().__init__()
        self.name, self.selected = name, False
    async def get_attribute(self, name): return str(self.selected).lower() if name == 'aria-selected' else None
    async def evaluate(self, script): return False
    async def click(self, trial=False, **kwargs):
        self.clicks.append(trial)
        if not trial: self.selected = True


class ReferencePage:
    def __init__(self, names, has_form=True, uncertain=False):
        self.assets, self.has_form, self.uncertain = [AssetControl(n) for n in names], has_form, uncertain
        self.frames, self.include_clicks, self.included = [self], [], False
        self.include_button = SettingsControl('Incluir no comando')
        async def click(trial=False, **kwargs):
            self.include_clicks.append(trial)
            if not trial:
                self.included = True
                if self.uncertain: raise TimeoutError('private detail')
        self.include_button.click = click
    def get_by_role(self, role, **kwargs):
        return Collection([self] if role == 'listbox' else self.assets if role == 'option' else [self.include_button] if role == 'button' else [])
    async def evaluate(self, script, names, **kwargs):
        return {'composerForms': int(self.has_form), 'attachmentMatches': len(names) if self.included and self.has_form else 0}
    async def wait_for_timeout(self, milliseconds): pass


class FlowDiagnosticTests(unittest.IsolatedAsyncioTestCase):
    def trace(self, browser):
        self.logs = []
        return module.FlowDiagnostics('11111111-2222-4333-8444-555555555555', 'prepare-draft', 'abcdef123456', clock=lambda: browser.now, emit=lambda line, **kwargs: self.logs.append(line))

    async def test_waits_for_both_images_and_three_stable_reads(self):
        ready={'text':['produto-1.png','produto-2.png','private-account@example.com'], 'busy':False}
        browser=Browser([{'text':['produto-1.png'], 'busy':True},ready,{'text':['produto-1.png'], 'busy':False},ready,ready,ready])
        trace=self.trace(browser)
        await module.wait_for_images(browser,[{'name':'produto-1.png'},{'name':'produto-2.png'}],trace,clock=lambda: browser.now)
        events=trace.report('references_not_implemented')['events']
        self.assertEqual(events[-1]['metrics']['stable'],3)
        self.assertEqual(events[-1]['metrics']['polls'],6)
        self.assertEqual(events[-1]['metrics']['visible'],2)
        self.assertEqual(events[-1]['status'],'ok')
        text=json.dumps(events)+''.join(self.logs)
        self.assertNotIn('private-account',text)
        self.assertNotIn('produto-1.png',text)

    async def test_timeout_keeps_evidence_of_partial_upload(self):
        browser=Browser([{'text':['produto-1.png'], 'busy':False}])
        trace=self.trace(browser)
        with self.assertRaisesRegex(RuntimeError,'flow_images_not_ready'):
            await module.wait_for_images(browser,[{'name':'produto-1.png'},{'name':'produto-2.png'}],trace,clock=lambda: browser.now,timeout=2)
        report=trace.report('flow_images_not_ready')
        self.assertEqual(report['lastStage'],'images_wait')
        self.assertEqual(report['events'][-1]['metrics']['visible'],1)
        self.assertFalse(report['generationStarted'])

    async def test_unreadable_frame_is_not_treated_as_ready(self):
        browser=Browser([RuntimeError('private-session-url')])
        trace=self.trace(browser)
        with self.assertRaisesRegex(RuntimeError,'flow_images_not_ready'):
            await module.wait_for_images(browser,[{'name':'produto-1.png'}],trace,clock=lambda: browser.now,timeout=2)
        self.assertEqual(trace.events[-1]['metrics']['frameErrors'],1)
        self.assertTrue(trace.events[-1]['metrics']['busy'])
        self.assertNotIn('private-session-url',''.join(self.logs))

    def test_trace_is_bounded_and_unknown_properties_never_leave(self):
        browser=Browser([])
        trace=self.trace(browser)
        for _ in range(100):
            trace.event('upload',expected=2,prompt='secret',wsEndpoint='secret')
        self.assertEqual(len(trace.events),80)
        self.assertNotIn('secret',json.dumps(trace.report('unknown-secret')))
        self.assertEqual(trace.report('unknown-secret')['stopReason'],'navigation_failed')

    def test_actual_flow_selectors_match_visible_rights_and_upload_labels(self):
        source = (Path(__file__).parents[1] / 'executors/google-flow/modal_app.py').read_text()
        tree = ast.parse(source)
        patterns = [node.args[0].value for node in ast.walk(tree)
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and node.func.attr == 'compile' and node.args and isinstance(node.args[0], ast.Constant)]
        agree = next(pattern for pattern in patterns if 'Concordo' in pattern)
        upload = next(pattern for pattern in patterns if 'Fazer upload' in pattern)
        self.assertTrue(re.search(agree, 'Concordo'))
        self.assertTrue(re.search(agree, '  Concordo  '))
        self.assertFalse(re.search(agree, 'Não concordo'))
        for label in ('Fazer upload', 'Fazer upload...', 'Fazer upload…'):
            self.assertTrue(re.search(upload, label))

    async def test_settings_overlay_failure_preserves_prior_upload_and_reports_block(self):
        trace = self.trace(Browser([]))
        trace.event('images_wait', visible=2, stable=3)
        button = SettingsControl(blocked=True)
        result = await module.inspect_settings(SettingsPage([button]), trace)
        self.assertEqual(result['errorCode'], 'flow_settings_blocked')
        self.assertEqual(button.clicks, [True])  # Trial only; no forced real click.
        self.assertFalse(result['generationStarted'])
        self.assertEqual(trace.events[0]['metrics']['visible'], 2)
        self.assertTrue(trace.events[-1]['metrics']['clickTimedOut'])
        self.assertNotIn('private-', json.dumps(trace.report(result['errorCode'])))

    async def test_settings_ambiguous_does_not_click_arbitrary_button(self):
        trace = self.trace(Browser([]))
        buttons = [SettingsControl(), SettingsControl()]
        result = await module.inspect_settings(SettingsPage(buttons), trace)
        self.assertEqual(result['errorCode'], 'flow_settings_ambiguous')
        self.assertEqual([b.clicks for b in buttons], [[], []])

    async def test_settings_disabled_is_reported_without_clicking(self):
        trace = self.trace(Browser([]))
        button = SettingsControl(enabled=False)
        result = await module.inspect_settings(SettingsPage([button]), trace)
        self.assertEqual(result['errorCode'], 'flow_settings_blocked')
        self.assertTrue(trace.events[-1]['metrics']['disabled'])
        self.assertEqual(button.clicks, [])

    async def test_settings_exact_name_avoids_unrelated_project_configuration(self):
        trace = self.trace(Browser([]))
        unrelated = SettingsControl('Mais configurações do projeto')
        result = await module.inspect_settings(SettingsPage([unrelated]), trace)
        self.assertEqual(result['errorCode'], 'flow_settings_not_found')
        self.assertEqual(unrelated.clicks, [])

    async def test_settings_valid_button_is_trialed_then_read_without_enabling_generation(self):
        trace = self.trace(Browser([]))
        button = SettingsControl()
        result = await module.inspect_settings(SettingsPage([button]), trace)
        self.assertIsNone(result['errorCode'])
        self.assertEqual(button.clicks, [True, False])
        self.assertTrue(result['vertical916'])
        self.assertTrue(result['singleOutput'])
        self.assertFalse(result['readyToGenerate'])

    async def test_settings_read_failure_is_nonfatal_after_opening_panel(self):
        trace = self.trace(Browser([]))
        result = await module.inspect_settings(SettingsPage([SettingsControl()], read_error=True), trace)
        self.assertTrue(result['opened'])
        self.assertEqual(result['errorCode'], 'flow_settings_read_failed')
        self.assertNotIn('private-read-error', json.dumps(trace.report(result['errorCode'])))

    def test_batch_long_press_selection_and_single_include(self):
        source = (Path(__file__).parents[1] / 'executors/google-flow/flow_diagnostics.py').read_text()
        ast.parse(source)
        self.assertIn("await target.click(delay=950, timeout=4000)", source)
        self.assertIn("expectedSelected", source)
        self.assertIn("flow_reference_selection_unconfirmed", source)
        self.assertIn("await includes[0].click(timeout=3500)", source)
        self.assertNotIn("click_generate", source)

    def test_reference_verification_does_not_require_html_form(self):
        source = (Path(__file__).parents[1] / 'executors/google-flow/flow_diagnostics.py').read_text()
        self.assertIn("textbox.parentElement?.parentElement?.parentElement", source)
        self.assertIn("el.closest('[role=\"dialog\"],[role=\"listbox\"]')", source)


if __name__ == '__main__':
    unittest.main()
