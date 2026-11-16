"""Security and lifecycle tests for the isolated browser service."""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["MV_BROWSER_CONTROL_SECRET"] = "test-only-secret-not-for-production-0123456789"
os.environ["MV_BROWSER_PUBLIC_ORIGIN"] = "https://browser.example.test"
from fastapi.testclient import TestClient
import app as service

class BrowserApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(service.app)
        self.headers = {"Authorization": "Bearer " + service.SECRET}

    def tearDown(self):
        self.client.close()

    def test_health_requires_authorization(self):
        self.assertEqual(self.client.get("/health").status_code, 401)
        self.assertEqual(self.client.get("/health", headers={"Authorization": "Bearer invalid"}).status_code, 401)

    def test_session_routes_require_authorization(self):
        for path in ("/session/start", "/session/stop"):
            self.assertEqual(self.client.post(path).status_code, 401)
        self.assertEqual(self.client.get("/session/status").status_code, 401)

    def test_health_is_private_and_no_secret_leaks(self):
        response = self.client.get("/health", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "chromium")
        self.assertNotIn(service.SECRET, response.text)

    def test_ticket_requires_authentication(self):
        self.assertEqual(self.client.post("/session/view-ticket").status_code, 401)
        self.assertEqual(self.client.post("/session/view-ticket", headers=self.headers).status_code, 409)

    def test_ticket_is_single_use(self):
        import time
        service.view_tickets["test-token"] = time.monotonic() + 30
        self.assertTrue(service.consume_view_ticket("test-token"))
        self.assertFalse(service.consume_view_ticket("test-token"))
        service.view_tickets["expired-token"] = time.monotonic() - 1
        self.assertFalse(service.consume_view_ticket("expired-token"))

    def test_viewer_requires_ticket_to_connect(self):
        from starlette.websockets import WebSocketDisconnect
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect("/viewer/ws", headers={"origin": "https://browser.example.test"}):
                pass

    def test_viewer_rejects_untrusted_origin(self):
        from starlette.websockets import WebSocketDisconnect
        import time
        service.view_tickets["ticket-for-origin-test"] = time.monotonic() + 30
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect(
                "/viewer/ws?ticket=ticket-for-origin-test",
                headers={"origin": "https://evil.example.test"}
            ):
                pass
        service.view_tickets.pop("ticket-for-origin-test", None)

    def test_viewer_does_not_embed_secret(self):
        response = self.client.get("/viewer")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(service.SECRET, response.text)

    def test_status_when_stopped(self):
        response = self.client.get("/session/status", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["running"])

if __name__ == "__main__":
    unittest.main()
