import json
from zoneinfo import ZoneInfoNotFoundError

import pytest

from backend.analytics import body_summary, sleep_duration_summary
from backend.store import Store


def stored_rows(tmp_path, *samples):
    store = Store(tmp_path / "analytics")
    store.import_fixture(json.dumps([
        dict(metric=metric, value=value, unit=unit, observed_at=observed_at)
        for metric, value, unit, observed_at in samples
    ]).encode())
    return store.series()


def test_weight_local_days_and_calendar_window_changes(tmp_path):
    rows = stored_rows(tmp_path,
        ("weight", 70, "kg", "2026-02-12T12:00:00Z"),
        ("weight", 76, "kg", "2026-02-13T12:00:00Z"),
        ("weight", 80, "kg", "2026-03-08T04:30:00Z"),  # March 7 locally
        ("weight", 90, "kg", "2026-03-08T05:00:00Z"),
        ("weight", 94, "kg", "2026-03-08T12:00:00-04:00"),
        ("weight", 88, "kg", "2026-03-14T03:59:59Z"),  # March 13 after DST change
        ("weight", None, "kg", "2026-03-14T04:00:00Z"),
        ("weight", 999, "stone", "2026-03-15T12:00:00Z"),
        ("steps", 9000, "count", "2026-03-16T12:00:00Z"),
    )
    summary = body_summary(reversed(rows), "America/New_York")
    assert summary["as_of_date"] == "2026-03-14"
    assert summary["timezone"] == "America/New_York"
    weight = summary["metrics"]["weight"]
    assert weight["unit"] == "kg"
    assert [(p["date"], p["value"]) for p in weight["daily"]] == [
        ("2026-02-12", 70), ("2026-02-13", 76), ("2026-03-07", 80),
        ("2026-03-08", 92), ("2026-03-13", 88), ("2026-03-14", None),
    ]
    assert weight["daily"][3]["measurement_ids"] == [rows[3]["id"], rows[4]["id"]]
    assert weight["daily"][-1]["sample_count"] == 0
    assert weight["windows"]["7d"] == {
        "current": dict(start_date="2026-03-08", end_date="2026-03-14",
                        average=90, observed_days=2, total_days=7, sample_count=3),
        "previous": dict(start_date="2026-03-01", end_date="2026-03-07",
                         average=80, observed_days=1, total_days=7, sample_count=1),
        "change": 10,
    }
    assert weight["windows"]["30d"] == {
        "current": dict(start_date="2026-02-13", end_date="2026-03-14",
                        average=84, observed_days=4, total_days=30, sample_count=5),
        "previous": dict(start_date="2026-01-14", end_date="2026-02-12",
                         average=70, observed_days=1, total_days=30, sample_count=1),
        "change": 14,
    }


def test_weight_and_direct_composition_units(tmp_path):
    rows = stored_rows(tmp_path,
        ("weight", 100, "lb", "2026-01-08T12:00:00Z"),
        ("weight", 50, "kg", "2026-01-08T13:00:00Z"),
        ("weight", 0, "kg", "2026-01-08T14:00:00Z"),
        ("body_fat", 20, "%", "2026-01-01T12:00:00Z"),
        ("body_fat", 18, "%", "2026-01-08T12:00:00Z"),
        ("body_fat", 0.18, "fraction", "2026-01-08T13:00:00Z"),
        ("body_fat", 101, "%", "2026-01-08T14:00:00Z"),
        ("lean_mass", 80, "lb", "2026-01-08T12:00:00Z"),
    )
    summary = body_summary(rows)
    metrics = summary["metrics"]
    assert metrics["weight"]["daily"][0]["value"] == pytest.approx(47.6796185)
    assert metrics["weight"]["daily"][0]["sample_count"] == 2
    assert metrics["body_fat"]["unit"] == "%"
    assert metrics["body_fat"]["windows"]["7d"]["current"]["average"] == 18
    assert metrics["body_fat"]["windows"]["7d"]["change"] == -2
    assert metrics["lean_mass"]["unit"] == "kg"
    assert metrics["lean_mass"]["daily"][0]["value"] == pytest.approx(36.2873896)
    assert metrics["lean_mass"]["windows"]["7d"]["change"] is None
    assert json.loads(json.dumps(summary, allow_nan=False)) == summary


def test_empty_and_null_only_summary(tmp_path):
    summary = body_summary([])
    assert summary["as_of_date"] is None
    assert summary["method_version"] == 1
    assert summary["timezone"] == "UTC"
    for metric in summary["metrics"].values():
        assert metric["daily"] == []
        assert metric["windows"]["30d"]["current"] == dict(
            start_date=None, end_date=None, average=None,
            observed_days=0, total_days=30, sample_count=0,
        )

    rows = stored_rows(tmp_path, ("weight", None, "kg", "2026-01-08T12:00:00Z"))
    summary = body_summary(rows)
    assert summary["as_of_date"] == "2026-01-08"
    assert summary["metrics"]["weight"]["daily"] == [
        dict(date="2026-01-08", value=None, sample_count=0, measurement_ids=[]),
    ]
    for name in ("weight", "body_fat", "lean_mass"):
        window = summary["metrics"][name]["windows"]["7d"]
        assert window["current"] == dict(start_date="2026-01-02", end_date="2026-01-08",
                                        average=None, observed_days=0, total_days=7, sample_count=0)
        assert window["change"] is None
    with pytest.raises(ZoneInfoNotFoundError):
        body_summary(rows, "Not/AZone")


def test_sleep_duration_uses_local_daily_totals_and_observed_day_coverage(tmp_path):
    rows = stored_rows(tmp_path,
        ("sleep_duration", 6, "h", "2026-03-07T12:00:00Z"),
        ("sleep_duration", 480, "min", "2026-03-08T04:30:00Z"),  # March 7 locally
        ("sleep_duration", 0, "min", "2026-03-09T12:00:00Z"),
        ("sleep_duration", None, "min", "2026-03-10T12:00:00Z"),
        ("sleep_duration", -1, "min", "2026-03-10T13:00:00Z"),
        ("sleep_duration", 26, "h", "2026-03-10T14:00:00Z"),
        ("sleep_duration", 28800, "s", "2026-03-11T12:00:00Z"),
        ("workout_duration", 60, "min", "2026-03-12T12:00:00Z"),
    )
    summary = sleep_duration_summary(reversed(rows), "America/New_York")
    assert summary["unit"] == "min"
    assert summary["as_of_date"] == "2026-03-10"
    assert summary["daily"] == [
        dict(date="2026-03-07", value=420, sample_count=2,
             measurement_ids=[rows[0]["id"], rows[1]["id"]]),
        dict(date="2026-03-09", value=0, sample_count=1, measurement_ids=[rows[2]["id"]]),
        dict(date="2026-03-10", value=None, sample_count=0, measurement_ids=[]),
    ]
    assert summary["windows"]["7d"] == dict(
        start_date="2026-03-04", end_date="2026-03-10", average=210,
        observed_days=2, total_days=7, sample_count=3,
    )


def test_sleep_duration_empty_and_missing_only(tmp_path):
    empty = sleep_duration_summary([])
    assert empty["as_of_date"] is None
    assert empty["daily"] == []
    assert empty["windows"]["30d"] == dict(
        start_date=None, end_date=None, average=None,
        observed_days=0, total_days=30, sample_count=0,
    )
    rows = stored_rows(tmp_path, ("sleep_duration", None, "h", "2026-03-01T12:00:00Z"))
    summary = sleep_duration_summary(rows)
    assert summary["windows"]["30d"] == dict(
        start_date="2026-01-31", end_date="2026-03-01", average=None,
        observed_days=0, total_days=30, sample_count=0,
    )
