"""Versioned analytics over canonical Store.series() measurements."""

from datetime import date, datetime
from statistics import mean
from zoneinfo import ZoneInfo


_UNITS = {
    "weight": {"kg": 1, "lb": 0.45359237},
    "body_fat": {"%": 1},
    "lean_mass": {"kg": 1, "lb": 0.45359237},
}


def _window(daily, end, days):
    if end is None:
        ordinals = range(0)
    else:
        ordinals = range(max(1, end - days + 1), end + 1)
    points = [daily[day] for day in ordinals if day in daily and daily[day]["value"] is not None]
    return {
        "start_date": date.fromordinal(ordinals.start).isoformat() if ordinals else None,
        "end_date": date.fromordinal(end).isoformat() if ordinals else None,
        "average": mean(point["value"] for point in points) if points else None,
        "observed_days": len(points),
        "total_days": days,
        "sample_count": sum(point["sample_count"] for point in points),
    }


def body_summary(rows, timezone="UTC"):
    """Summarize Store.series() rows using inclusive local calendar windows.

    All metrics share the latest local date with a supported body metric/unit
    pair, including missing values. Missing calendar dates have no daily point;
    dates with supported rows but no valid value have a null point. Windows
    weight observed days equally; change is current minus prior window mean.
    """
    zone = ZoneInfo(timezone)
    grouped = {metric: {} for metric in _UNITS}
    anchor = None
    for row in rows:
        metric = row["metric"]
        units = _UNITS.get(metric)
        if units is None or row["unit"] not in units:
            continue
        day = datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00")).astimezone(zone).date().toordinal()
        anchor = day if anchor is None else max(anchor, day)
        samples = grouped[metric].setdefault(day, [])
        value = row["value"]
        if value is None:
            continue
        if metric == "body_fat":
            if not 0 <= value <= 100:
                continue
        elif value <= 0:
            continue
        samples.append((row["id"], value * units[row["unit"]]))

    metrics = {}
    for metric, dates in grouped.items():
        daily = {}
        for day, samples in sorted(dates.items()):
            daily[day] = {
                "date": date.fromordinal(day).isoformat(),
                "value": mean(value for _, value in samples) if samples else None,
                "sample_count": len(samples),
                "measurement_ids": sorted(row_id for row_id, _ in samples),
            }
        windows = {}
        for days in (7, 30):
            current = _window(daily, anchor, days)
            previous = _window(daily, anchor - days if anchor is not None else None, days)
            a, b = current["average"], previous["average"]
            windows[f"{days}d"] = {
                "current": current,
                "previous": previous,
                "change": a - b if a is not None and b is not None else None,
            }
        metrics[metric] = {
            "unit": next(iter(_UNITS[metric])),
            "daily": list(daily.values()),
            "windows": windows,
        }
    return {
        "method_version": 1,
        "timezone": zone.key,
        "as_of_date": date.fromordinal(anchor).isoformat() if anchor is not None else None,
        "metrics": metrics,
    }


def sleep_duration_summary(rows, timezone="UTC"):
    """Summarize fixture daily sleep totals as minutes, not sleep intervals.

    The local fixture convention is `sleep_duration` in `min` or `h`, with
    observed_at falling on the intended reporting day in the requested zone.
    Multiple valid totals on one day are averaged, never summed. Supported
    rows with no valid value yield null daily points; absent days have no point.
    The latest supported row anchors inclusive 7/30-day windows, which give
    each observed day equal weight. No provider or session semantics are assumed.
    """
    zone = ZoneInfo(timezone)
    factors = {"min": 1, "h": 60}
    grouped = {}
    for row in rows:
        factor = factors.get(row["unit"])
        if row["metric"] != "sleep_duration" or factor is None:
            continue
        day = datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00")).astimezone(zone).date().toordinal()
        samples = grouped.setdefault(day, [])
        value = row["value"]
        if value is not None and 0 <= value <= 1500 / factor:
            # Allow up to 25 hours for a fall-back reporting day.
            samples.append((row["id"], value * factor))

    daily = {
        day: {
            "date": date.fromordinal(day).isoformat(),
            "value": mean(value for _, value in samples) if samples else None,
            "sample_count": len(samples),
            "measurement_ids": sorted(row_id for row_id, _ in samples),
        }
        for day, samples in sorted(grouped.items())
    }
    anchor = max(daily, default=None)
    return {
        "method_version": 1,
        "timezone": zone.key,
        "as_of_date": date.fromordinal(anchor).isoformat() if anchor is not None else None,
        "unit": "min",
        "daily": list(daily.values()),
        "windows": {f"{days}d": _window(daily, anchor, days) for days in (7, 30)},
    }


# Canonical synthetic daily totals. Each entry gives the display unit and
# accepted input units with their conversion factors. No meal records here.
_NUTRITION = {
    "nutrition_energy": ("kcal", {"kcal": 1, "kJ": 1 / 4.184}),
    "nutrition_protein": ("g", {"g": 1, "mg": 0.001}),
    "nutrition_carbohydrates": ("g", {"g": 1, "mg": 0.001}),
    "nutrition_fat": ("g", {"g": 1, "mg": 0.001}),
    "nutrition_fibre": ("g", {"g": 1, "mg": 0.001}),
    "nutrition_sodium": ("mg", {"mg": 1, "µg": 0.001, "ug": 0.001}),
    "nutrition_iron": ("mg", {"mg": 1, "µg": 0.001, "ug": 0.001}),
}


def nutrition_summary(rows, timezone="UTC"):
    """Normalize daily totals, then average repeated totals and observed days.

    Supported null or negative totals cannot contribute to an average; a day
    with only such rows has a null point. Absent dates have no point. Coverage
    counts days with valid rows, not completeness of food logging. The latest
    supported metric/unit row (even if missing) anchors all nutrient windows.
    """
    return _scalar_summary(rows, timezone, _NUTRITION, lambda value: value >= 0)


def cardio_summary(rows, timezone="UTC"):
    """Summarize measured HR samples, not continuous or session-average HR."""
    return _scalar_summary(rows, timezone, {"heart_rate": ("bpm", {"bpm": 1})},
                           lambda value: value > 0)


def _scalar_summary(rows, timezone, registry, valid):
    zone = ZoneInfo(timezone)
    grouped = {metric: {} for metric in registry}
    anchor = None
    for row in rows:
        metric = row["metric"]
        if metric not in registry:
            continue
        factor = registry[metric][1].get(row["unit"])
        if factor is None:
            continue
        day = datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00")).astimezone(zone).date().toordinal()
        anchor = day if anchor is None else max(anchor, day)
        samples = grouped[metric].setdefault(day, [])
        value = row["value"]
        if value is not None and valid(value):
            samples.append((row["id"], value * factor))

    metrics = {}
    for metric, dates in grouped.items():
        daily = {
            day: {
                "date": date.fromordinal(day).isoformat(),
                "value": mean(value for _, value in samples) if samples else None,
                "sample_count": len(samples),
                "measurement_ids": sorted(row_id for row_id, _ in samples),
            }
            for day, samples in sorted(dates.items())
        }
        metrics[metric] = {
            "unit": registry[metric][0],
            "daily": list(daily.values()),
            "windows": {f"{days}d": _window(daily, anchor, days) for days in (7, 30)},
        }
    return {
        "method_version": 1,
        "timezone": zone.key,
        "as_of_date": date.fromordinal(anchor).isoformat() if anchor is not None else None,
        "metrics": metrics,
    }


def overview_summary(rows, timezone="UTC"):
    """Compare two common calendar weeks and retain latest valid raw observations."""
    body = body_summary(rows, timezone)
    sleep = sleep_duration_summary(rows, timezone)
    nutrition = nutrition_summary(rows, timezone)
    cardio = cardio_summary(rows, timezone)
    selected = {
        "weight": body["metrics"]["weight"],
        "sleep_duration": sleep,
        "nutrition_energy": nutrition["metrics"]["nutrition_energy"],
        "heart_rate": cardio["metrics"]["heart_rate"],
    }
    daily = {
        metric: {date.fromisoformat(point["date"]).toordinal(): point for point in entry["daily"]}
        for metric, entry in selected.items()
    }
    anchor = max((day for points in daily.values() for day in points), default=None)
    by_id = {row["id"]: row for row in rows}
    metrics = {}
    for metric, points in daily.items():
        valid_ids = (row_id for point in points.values() for row_id in point["measurement_ids"])
        latest = max((by_id[row_id] for row_id in valid_ids),
                     key=lambda row: (row["observed_at"], row["id"]), default=None)
        current = _window(points, anchor, 7)
        previous = _window(points, anchor - 7 if anchor is not None else None, 7)
        a, b = current["average"], previous["average"]
        metrics[metric] = {
            "unit": selected[metric]["unit"],
            "latest": {key: latest[key] for key in
                       ("id", "observed_at", "value", "unit", "import_id")} if latest else None,
            "current": current,
            "previous": previous,
            "change": a - b if a is not None and b is not None else None,
        }
    return {
        "method_version": 1,
        "timezone": timezone,
        "as_of_date": date.fromordinal(anchor).isoformat() if anchor is not None else None,
        "metrics": metrics,
    }
