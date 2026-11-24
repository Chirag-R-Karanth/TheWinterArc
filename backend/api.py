"""Loopback-only Phase 01 API and same-origin shell."""

import csv
import io
import os
import re
import sqlite3
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from .analytics import (METRICS, body_summary, cardio_summary, daily_metric, nutrition_summary,
                        overview_summary, sleep_duration_summary)
from .correlation import StatisticsUnavailable, correlation
from .providers import sources
from .store import Store


FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
LOCAL_HOST = re.compile(r"(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?")
MAX_FIXTURE = 8 * 1024 * 1024


@asynccontextmanager
async def lifespan(app):
    root = os.environ.get("WINTERARC_DATA_DIR")
    if not root:
        xdg = Path(os.environ.get("XDG_DATA_HOME", ""))
        root = (xdg if xdg.is_absolute() else Path.home() / ".local/share") / "thewinterarc-v2"
    app.state.store = Store(Path(root))
    yield


app = FastAPI(title="TheWinterArc V2", version="0.1.0", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url="/api/v1/openapi.json")


@app.middleware("http")
async def local_only(request: Request, call_next):
    hosts = request.headers.getlist("host")
    if (not request.client or request.client.host != "127.0.0.1"
            or len(hosts) != 1 or not LOCAL_HOST.fullmatch(hosts[0])):
        response = JSONResponse({"detail": "Loopback requests only"}, status_code=403)
    elif request.method not in {"GET", "HEAD", "OPTIONS"} and (
        request.headers.getlist("origin") != [f"http://{hosts[0]}"]
        or request.headers.getlist("x-winterarc-local") != ["1"]
    ):
        response = JSONResponse({"detail": "Same-origin mutation required"}, status_code=403)
    else:
        response = await call_next(request)
    response.headers.update({
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; "
                                   "frame-ancestors 'none'; form-action 'none'",
    })
    return response


@app.exception_handler(sqlite3.Error)
@app.exception_handler(OSError)
async def store_unavailable(request, error):
    return JSONResponse({"detail": "Local store unavailable"}, status_code=503)


@app.get("/", include_in_schema=False)
def shell():
    return FileResponse(FRONTEND / "index.html")


@app.get("/app.js", include_in_schema=False)
def script():
    return FileResponse(FRONTEND / "app.js", media_type="text/javascript")


@app.get("/styles.css", include_in_schema=False)
def styles():
    return FileResponse(FRONTEND / "styles.css", media_type="text/css")


@app.get("/anatomy.js", include_in_schema=False)
def anatomy_script():
    return FileResponse(FRONTEND / "anatomy.js", media_type="text/javascript")


@app.get("/anatomy.css", include_in_schema=False)
def anatomy_styles():
    return FileResponse(FRONTEND / "anatomy.css", media_type="text/css")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "mode": "fixture_only"}


@app.get("/api/v1/series")
def series(request: Request):
    return request.app.state.store.series()


@app.get("/api/v1/sources")
def source_status():
    return sources()


def _timezone_key(timezone: str) -> str:
    try:
        return ZoneInfo(timezone).key
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise HTTPException(422, "Use a valid IANA timezone, such as UTC or America/New_York") from error


@app.get("/api/v1/metrics")
def metrics():
    return [{"id": key, "unit": unit, "aggregation": "daily_mean"} for key, unit in METRICS.items()]


@app.get("/api/v1/metrics/{metric}/daily")
def metric_daily(request: Request, metric: str, timezone: str = "UTC"):
    if metric not in METRICS:
        raise HTTPException(404, "Unknown metric")
    return daily_metric(request.app.state.store.series(), metric, _timezone_key(timezone))


@app.get("/api/v1/metrics/{metric}/daily.csv")
def metric_daily_csv(request: Request, metric: str, timezone: str = "UTC"):
    data = metric_daily(request, metric, timezone)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["metric", "timezone", "date", "unit", "daily_mean", "sample_count", "measurement_ids"])
    for row in data["daily"]:
        writer.writerow([metric, data["timezone"], row["date"], data["unit"], row["value"],
                         row["sample_count"], " ".join(map(str, row["measurement_ids"]))])
    return Response(output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="winterarc-{metric}-daily.csv"',
    })


class CorrelationRequest(BaseModel):
    x: str
    y: str
    timezone: str = "UTC"
    lag_days: int = Field(default=0, ge=-90, le=90)
    rolling_days: int = Field(default=14, ge=3, le=366)
    start_date: date | None = None
    end_date: date | None = None


@app.post("/api/v1/analysis/correlation")
def analyze_correlation(request: Request, spec: CorrelationRequest):
    if spec.x not in METRICS or spec.y not in METRICS:
        raise HTTPException(422, "Choose two registered metrics")
    zone = _timezone_key(spec.timezone)
    try:
        return correlation(request.app.state.store.series(), spec.x, spec.y, zone, spec.lag_days,
                           spec.rolling_days, spec.start_date, spec.end_date)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except StatisticsUnavailable as error:
        raise HTTPException(503, "R statistics engine unavailable. Verify Rscript is installed locally.") from error


@app.get("/api/v1/body/summary")
def summarize_body(request: Request, timezone: str = "UTC"):
    zone = _timezone_key(timezone)
    return body_summary(request.app.state.store.series(), zone)


@app.get("/api/v1/sleep/summary")
def summarize_sleep(request: Request, timezone: str = "UTC"):
    zone = _timezone_key(timezone)
    return sleep_duration_summary(request.app.state.store.series(), zone)


@app.get("/api/v1/nutrition/summary")
def summarize_nutrition(request: Request, timezone: str = "UTC"):
    """Return daily nutrition totals and 7/30-day observed-day averages."""
    zone = _timezone_key(timezone)
    return nutrition_summary(request.app.state.store.series(), zone)


@app.get("/api/v1/cardio/summary")
def summarize_cardio(request: Request, timezone: str = "UTC"):
    """Return daily heart-rate sample means and observed-day windows."""
    zone = _timezone_key(timezone)
    return cardio_summary(request.app.state.store.series(), zone)


@app.get("/api/v1/overview/summary")
def summarize_overview(request: Request, timezone: str = "UTC"):
    """Return latest valid observations and comparable weekly windows."""
    zone = _timezone_key(timezone)
    return overview_summary(request.app.state.store.series(), zone)


@app.get("/api/v1/imports")
def imports(request: Request):
    return request.app.state.store.imports()


@app.post("/api/v1/imports", openapi_extra={"requestBody": {"required": True, "content": {
    "application/json": {"schema": {"type": "array", "items": {"type": "object"}}},
}}})
async def import_fixture(request: Request):
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if media_type != "application/json":
        raise HTTPException(415, "Expected an application/json synthetic fixture")
    payload = bytearray()
    async for chunk in request.stream():
        if len(payload) + len(chunk) > MAX_FIXTURE:
            raise HTTPException(413, "Synthetic fixture exceeds 8 MiB")
        payload.extend(chunk)
    try:
        return await run_in_threadpool(request.app.state.store.import_fixture, bytes(payload))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
