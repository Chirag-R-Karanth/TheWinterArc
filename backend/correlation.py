"""Calendar-day alignment in Python; descriptive statistics in base R."""

from datetime import UTC, date, datetime
from math import isfinite
from pathlib import Path
from subprocess import DEVNULL, PIPE, SubprocessError, run

from .analytics import METRICS, daily_metric


LIMITATIONS = (
    "Exploratory, not causal. No p-values or confidence intervals: serial dependence, "
    "trends, outliers, confounding and repeated comparisons are not adjusted for. "
    "Missing or invalid observations are excluded without imputation. "
    "Correlation requires at least three pairs and variation in both metrics. "
    "LOESS requires at least 10 pairs and six distinct X values, and may be unavailable for unstable fits."
)
WORKER = Path(__file__).with_suffix(".R")


class StatisticsUnavailable(RuntimeError):
    pass


def _number(text):
    if text in {"NA", "NaN", "Inf", "-Inf"}:
        return None
    value = float(text)
    return value if isfinite(value) else None


def correlation(rows, x, y, timezone, lag, rolling_days, start_date=None, end_date=None):
    """Pair X at local date t with Y at t + lag. The range is on the X axis."""
    def points(metric):
        return {date.fromisoformat(p["date"]).toordinal(): p
                for p in daily_metric(rows, metric, timezone)["daily"]}

    def iso(day):
        return date.fromordinal(day).isoformat()

    xp, yp = points(x), points(y)
    end = end_date.toordinal() if end_date else max(
        [*xp, *(day - lag for day in yp if 1 <= day - lag <= date.max.toordinal())], default=None)
    if end is None and start_date:
        end = min(date.max.toordinal(), start_date.toordinal() + 89)
    start = start_date.toordinal() if start_date else (max(1, end - 89) if end else None)
    days = end - start + 1 if end is not None else 0
    if end is not None and not 1 <= days <= 366:
        raise ValueError("Choose an inclusive X date range of 1 to 366 days")
    pairs = []
    observed_x = observed_y = 0
    for day in range(start or 0, (end + 1) if end is not None else 0):
        a, b = xp.get(day), yp.get(day + lag)
        valid_x = a is not None and a["value"] is not None and isfinite(a["value"])
        valid_y = b is not None and b["value"] is not None and isfinite(b["value"])
        observed_x += valid_x
        observed_y += valid_y
        if valid_x and valid_y:
            pairs.append({"x_date": iso(day), "y_date": iso(day + lag), "x": a["value"],
                          "y": b["value"], "x_measurement_ids": a["measurement_ids"],
                          "y_measurement_ids": b["measurement_ids"]})
    result = {"method_version": 1, "engine": "base R", "engine_version": None,
              "computed_at": datetime.now(UTC).isoformat(),
              "timezone": timezone, "aggregation": "daily_mean", "x_metric": x, "y_metric": y,
              "x_unit": METRICS[x], "y_unit": METRICS[y],
              "lag_days": lag, "lag_convention": "X(t) paired with Y(t + lag days)",
              "rolling_days": rolling_days, "start_date": iso(start) if start else None,
              "end_date": iso(end) if end else None, "total_days": days, "x_observed_days": observed_x,
              "y_observed_days": observed_y, "paired_n": len(pairs), "pairs": pairs,
              "pearson": None, "spearman": None, "linear": None, "loess": [], "distributions": {},
              "rolling": [], "limitations": LIMITATIONS}
    if not pairs:
        result["rolling"] = [{"end_date": iso(day), "paired_n": 0, "pearson": None, "spearman": None}
                             for day in range((start or 1) + rolling_days - 1, (end or 0) + 1)]
        return result
    payload = "".join(f"{date.fromisoformat(p['x_date']).toordinal() - start}\t{p['x']}\t{p['y']}\n"
                      for p in pairs)
    try:
        output = run(["Rscript", "--vanilla", str(WORKER), str(days), str(rolling_days)], input=payload,
                     text=True, stdout=PIPE, stderr=DEVNULL, timeout=8, check=True).stdout
        for line in output.splitlines():
            key, *values = line.split("\t")
            if key == "version":
                result["engine_version"], = values
                continue
            if key == "distribution":
                axis, *quantiles = values
                result["distributions"][axis] = list(map(_number, quantiles))
                continue
            nums = list(map(_number, values))
            if key == "cor":
                result["pearson"], result["spearman"] = nums
            elif key == "linear" and None not in nums:
                result["linear"] = dict(zip(("intercept", "slope"), nums))
            elif key == "loess":
                result["loess"].append(dict(zip(("x", "y"), nums)))
            elif key == "rolling":
                offset, n, pearson, spearman = nums
                result["rolling"].append({"end_date": iso(start + int(offset)), "paired_n": int(n),
                                          "pearson": pearson, "spearman": spearman})
        if (not result["engine_version"] or set(result["distributions"]) != {"x", "y"}
                or len(result["rolling"]) != max(0, days - rolling_days + 1)):
            raise ValueError("Incomplete statistics worker output")
    except (OSError, SubprocessError, ValueError) as error:
        raise StatisticsUnavailable from error
    return result
