# 2026-11-24 — Strava scaffold and body analytics

Added the Strava adapter contract in `backend/providers.py`; the Sources panel shows that real export verification is blocked. To resume, use a small original activity export kept outside Git. Phase 02 remains unverified while Phase 03 proceeds against synthetic fixtures.

Added `backend/analytics.py` and `/api/v1/body/summary`. The dashboard shows 7- and 30-day means and comparisons for weight, directly reported body fat, and lean mass, with observed-day coverage and missing states. UTC is the default; the API accepts IANA timezones.

From `V2/`, `PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider` reported **32 passed, 10 subtests passed**. The tests launch `serve.sh` on loopback and exercise blocked source status, empty summaries, local date shifts and invalid timezone handling. `node --check frontend/app.js`, `sh -n serve.sh`, and `git diff --check` passed; the latter checks tracked changes only. Browser rendering was not tested. See the [foundation report](2026-11-24.md) for launch instructions.
