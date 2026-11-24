"""Smoke tests against the actual loopback launcher and an isolated store."""

import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = b'[{"metric":"weight","value":null,"unit":"kg","observed_at":"2026-01-01T01:00:00+01:00"}]'


class APISmokeTest(unittest.TestCase):
    def setUp(self):
        self.data = self.enterContext(tempfile.TemporaryDirectory())
        self.start_server()

    def start_server(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            self.port = sock.getsockname()[1]
        self.server = subprocess.Popen([str(ROOT / "serve.sh")], env={
            **os.environ, "PORT": str(self.port), "WINTERARC_DATA_DIR": self.data,
            "PYTHON": sys.executable,
        })
        self.addCleanup(self.stop_server, self.server)
        for _ in range(100):
            if self.server.poll() is not None:
                self.fail(f"Launcher exited with status {self.server.returncode}")
            try:
                if self.http("GET", "/api/v1/health")[0] == 200:
                    return
            except OSError:
                time.sleep(0.05)
        self.fail("Loopback server did not become ready")

    @staticmethod
    def stop_server(server):
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()

    def http(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            conn.request(method, path, body, headers or {})
            response = conn.getresponse()
            return response.status, response.headers, response.read()
        finally:
            conn.close()

    def read_json(self, path):
        status, _, body = self.http("GET", f"/api/v1/{path}")
        self.assertEqual(status, 200)
        return json.loads(body)

    def post(self, body=FIXTURE, **headers):
        return self.http("POST", "/api/v1/imports", body, {
            "Origin": f"http://127.0.0.1:{self.port}", "X-WinterArc-Local": "1",
            "Content-Type": "application/json", **headers,
        })

    def test_fixture_round_trip_and_restart(self):
        self.assertEqual(self.read_json("health"), {"status": "ok", "mode": "fixture_only"})
        self.assertEqual(self.read_json("series"), [])
        self.assertEqual(self.read_json("imports"), [])
        status, _, body = self.post()
        self.assertEqual(status, 200)
        manifest = json.loads(body)
        self.assertFalse(manifest.pop("duplicate"))
        self.assertEqual(manifest["source"], "synthetic_fixture")
        self.assertEqual(manifest["row_count"], 1)
        status, _, body = self.post()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {**manifest, "duplicate": True})
        self.stop_server(self.server)
        self.start_server()
        self.assertEqual(self.read_json("imports"), [manifest])
        row, = self.read_json("series")
        self.assertEqual((row["value"], row["quality"], row["unit"]), (None, "missing", "kg"))
        self.assertEqual(row["observed_at"], "2026-01-01T00:00:00.000000Z")
        self.assertEqual(row["import_id"], manifest["id"])

    def test_guards_and_payload_errors_leave_store_empty(self):
        self.assertEqual(self.http("GET", "/", headers={"Host": "example.test"})[0], 403)
        self.assertEqual(self.http("POST", "/api/v1/imports", FIXTURE)[0], 403)
        self.assertEqual(self.post(Origin="https://example.test")[0], 403)
        self.assertEqual(self.post(**{"X-WinterArc-Local": ""})[0], 403)
        self.assertEqual(self.post(**{"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.post(b"not JSON")[0], 422)
        self.assertEqual(self.post(b" " * (8 * 1024 * 1024 + 1))[0], 413)
        self.assertEqual(self.read_json("imports"), [])
        self.assertEqual(self.read_json("series"), [])

    def test_sources_and_body_summary_over_loopback(self):
        sources = {source["id"]: source for source in self.read_json("sources")}
        self.assertEqual(set(sources), {"strava", "lyfta", "google_fit", "fatsecret", "how_we_feel",
                                        "bend", "betterme", "mdf", "zepp"})
        self.assertTrue(all(source["status"] == "blocked" for source in sources.values()))
        self.assertIn("real Strava export", sources["strava"]["reason"])
        self.assertIn("Android bridge", sources["google_fit"]["reason"])

        empty = self.read_json("body/summary")
        self.assertEqual(empty["timezone"], "UTC")
        self.assertIsNone(empty["as_of_date"])
        self.assertEqual(empty["metrics"]["weight"]["daily"], [])

        rows = [
            {"metric": "weight", "value": value, "unit": "kg", "observed_at": stamp}
            for value, stamp in [(74, "2025-12-25T01:00:00Z"), (72, "2026-01-01T01:00:00Z"),
                                 (None, "2026-01-02T01:00:00Z")]
        ]
        self.assertEqual(self.post(json.dumps(rows).encode())[0], 200)
        self.assertEqual(self.read_json("body/summary")["as_of_date"], "2026-01-02")
        summary = self.read_json("body/summary?timezone=America%2FNew_York")
        self.assertEqual(summary["timezone"], "America/New_York")
        self.assertEqual(summary["as_of_date"], "2026-01-01")
        weight = summary["metrics"]["weight"]
        self.assertIsNone(weight["daily"][-1]["value"])
        week = weight["windows"]["7d"]
        self.assertEqual(week["current"]["average"], 72)
        self.assertEqual(week["previous"]["average"], 74)
        self.assertEqual((week["current"]["observed_days"], week["current"]["total_days"]), (1, 7))
        self.assertEqual(week["change"], -2)
        self.assertIsNone(summary["metrics"]["lean_mass"]["windows"]["30d"]["change"])

        for invalid in ("Not%2FA_Zone", "", "..%2FUTC", "%00"):
            with self.subTest(timezone=invalid):
                status, _, body = self.http("GET", f"/api/v1/body/summary?timezone={invalid}")
                self.assertEqual(status, 422)
                self.assertIn("valid IANA timezone", json.loads(body)["detail"])

    def test_sleep_summary_over_loopback(self):
        empty = self.read_json("sleep/summary")
        self.assertIsNone(empty["as_of_date"])
        self.assertEqual(empty["daily"], [])
        self.assertIsNone(empty["windows"]["7d"]["average"])

        rows = [
            {"metric": "sleep_duration", "value": value, "unit": unit, "observed_at": timestamp}
            for value, unit, timestamp in [
                (6, "h", "2026-01-01T01:00:00Z"),
                (480, "min", "2026-01-01T08:00:00Z"),
                (None, "min", "2026-01-02T01:00:00Z"),
            ]
        ]
        self.assertEqual(self.post(json.dumps(rows).encode())[0], 200)
        utc = self.read_json("sleep/summary")
        self.assertEqual((utc["method_version"], utc["timezone"], utc["unit"]), (1, "UTC", "min"))
        self.assertEqual(utc["as_of_date"], "2026-01-02")
        self.assertEqual([point["value"] for point in utc["daily"]], [420, None])
        local = self.read_json("sleep/summary?timezone=America%2FNew_York")
        self.assertEqual((local["timezone"], local["as_of_date"]), ("America/New_York", "2026-01-01"))
        self.assertEqual([point["value"] for point in local["daily"]], [360, 480])
        for summary, observed in [(utc, 1), (local, 2)]:
            for days in (7, 30):
                window = summary["windows"][f"{days}d"]
                self.assertEqual((window["average"], window["observed_days"], window["total_days"],
                                  window["sample_count"]), (420, observed, days, 2))

        status, _, body = self.http("GET", "/api/v1/sleep/summary?timezone=Not%2FA_Zone")
        self.assertEqual(status, 422)
        self.assertIn("valid IANA timezone", json.loads(body)["detail"])

    def test_nutrition_summary_over_loopback(self):
        empty = self.read_json("nutrition/summary")
        self.assertIsNone(empty["as_of_date"])
        self.assertIsNone(empty["metrics"]["nutrition_energy"]["windows"]["7d"]["average"])

        rows = [
            {"metric": f"nutrition_{metric}", "value": value, "unit": unit,
             "observed_at": f"2026-01-{stamp}:00:00Z"}
            for metric, value, unit, stamp in [
                ("energy", 1000, "kcal", "01T01"),
                ("energy", 8368, "kJ", "01T08"),
                ("energy", 2500, "kcal", "07T08"),
                ("energy", None, "kcal", "08T01"),
                ("energy", 500, "cal", "09T08"),
                ("fibre", 0, "g", "07T08"),
                ("protein", 45000, "mg", "07T08"),
                ("sodium", 200000, "µg", "07T08"),
                ("iron", -1, "mg", "07T08"),
            ]
        ]
        self.assertEqual(self.post(json.dumps(rows).encode())[0], 200)
        utc = self.read_json("nutrition/summary")
        self.assertEqual((utc["method_version"], utc["timezone"], utc["as_of_date"]), (1, "UTC", "2026-01-08"))
        metrics = utc["metrics"]
        energy = metrics["nutrition_energy"]
        self.assertEqual(energy["unit"], "kcal")
        self.assertEqual([point["value"] for point in energy["daily"]], [1500, 2500, None])
        energy_ids = [row["id"] for row in self.read_json("series")
                      if row["metric"] == "nutrition_energy" and row["observed_at"].startswith("2026-01-01")]
        self.assertEqual(energy["daily"][0]["measurement_ids"], sorted(energy_ids))
        week, month = (energy["windows"][period] for period in ("7d", "30d"))
        self.assertEqual((week["start_date"], week["average"], week["observed_days"], week["total_days"]),
                         ("2026-01-02", 2500, 1, 7))
        self.assertEqual((month["average"], month["observed_days"], month["total_days"], month["sample_count"]),
                         (2000, 2, 30, 3))
        for metric, unit, average, days in [
            ("fibre", "g", 0, 1), ("protein", "g", 45, 1), ("sodium", "mg", 200, 1),
            ("iron", "mg", None, 0), ("fat", "g", None, 0),
        ]:
            with self.subTest(metric=metric):
                entry = metrics[f"nutrition_{metric}"]
                window = entry["windows"]["7d"]
                self.assertEqual((entry["unit"], window["average"], window["observed_days"]), (unit, average, days))

        local = self.read_json("nutrition/summary?timezone=America%2FNew_York")
        self.assertEqual(local["as_of_date"], "2026-01-07")
        local_week = local["metrics"]["nutrition_energy"]["windows"]["7d"]
        self.assertEqual((local_week["average"], local_week["observed_days"]), (2250, 2))
        self.assertEqual(self.http("GET", "/api/v1/nutrition/summary?timezone=Not%2FA_Zone")[0], 422)

    def test_same_origin_assets(self):
        for path, media_type, marker in [
            ("/", "text/html", b"Synthetic fixtures only"),
            ("/app.js", "text/javascript", b'?? "Missing"'),
            ("/styles.css", "text/css", b"color-scheme"),
        ]:
            with self.subTest(path=path):
                status, headers, body = self.http("GET", path, headers={"Origin": "https://example.test"})
                self.assertEqual(status, 200)
                self.assertTrue(headers["Content-Type"].startswith(media_type))
                self.assertIn(marker, body)
                self.assertIn("default-src 'self'", headers["Content-Security-Policy"])
                self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertIn(b'id="sleep-windows"', self.http("GET", "/")[2])
        self.assertIn(b'id="nutrition-windows"', self.http("GET", "/")[2])
