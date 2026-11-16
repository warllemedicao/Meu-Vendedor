"""Security and lifecycle tests for the isolated browser service."""
import os
import sys
import unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["MV_BROWSER_CONTROL_SECRET"] = "test-only-secret-not-for-production-0123456789"
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

    def test_status_when_stopped(self):
        response = self.client.get("/session/status", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["running"])

if __name__ == "__main__":
    unittest.main()
