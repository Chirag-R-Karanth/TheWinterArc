import json
import unittest

from backend.providers import (
    _ADAPTERS,
    _OPTIONAL_ADAPTERS,
    ProviderBlockedError,
    sources,
)


class ProviderTests(unittest.TestCase):
    def test_sources_exposes_blocked_strava_with_export_handoff(self):
        source = json.loads(json.dumps(sources()))[0]
        self.assertEqual(set(source), {"id", "name", "status", "reason"})
        self.assertEqual(source["id"], "strava")
        self.assertEqual(source["name"], "Strava")
        self.assertEqual(source["status"], "blocked")
        self.assertIn("activity file", source["reason"])
        self.assertIn("outside Git", source["reason"])
        self.assertIn("https://support.strava.com/", source["reason"])

    def test_default_discovery_covers_documented_providers(self):
        records = json.loads(json.dumps(sources()))
        expected = {
            "strava": "real Strava export",
            "lyfta": "native export",
            "google_fit": "Android bridge",
            "fatsecret": "local retention",
            "how_we_feel": "without notes",
            "bend": "completed sessions",
            "betterme": "portability sample",
            "mdf": "identity unconfirmed",
            "zepp": "Zepp App portability sample",
        }
        self.assertCountEqual([record["id"] for record in records], expected.keys())
        for record in records:
            with self.subTest(provider=record["id"]):
                self.assertEqual(set(record), {"id", "name", "status", "reason"})
                self.assertEqual(record["status"], "blocked")
                self.assertIn(expected[record["id"]], record["reason"])

    def test_youtube_discovery_is_opt_in_and_blocked(self):
        default = sources()
        expanded = sources(include_optional=True)
        self.assertEqual(expanded[:-1], default)
        youtube = expanded[-1]
        self.assertEqual(youtube["id"], "youtube")
        self.assertEqual(youtube["status"], "blocked")
        self.assertEqual(sources(), default)

    def test_source_snapshots_cannot_change_adapter_status(self):
        expected = sources(include_optional=True)
        snapshot = sources(include_optional=True)
        for record in snapshot:
            record["status"] = "connected"
        snapshot.clear()
        self.assertEqual(sources(include_optional=True), expected)

    def test_import_rejects_payload_with_same_reason_as_discovery(self):
        for adapter in _ADAPTERS + _OPTIONAL_ADAPTERS:
            source = adapter.source()
            for payload in (b"", b"\xff", b"[]"):
                with self.subTest(provider=source["id"], payload=payload):
                    with self.assertRaises(ProviderBlockedError) as error:
                        adapter.import_export(payload)
                    self.assertEqual(str(error.exception), source["reason"])
