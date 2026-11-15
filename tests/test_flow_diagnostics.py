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


if __name__ == '__main__':
    unittest.main()
