# Build report — 2026-11-24 / Phase 03 / metric registry and daily chart

Status: fixture slice verified; Phase 03 gate partial/blocked.

## Scope and changes

`backend/analytics.py` exposes the supported scalar registry and reuses existing normalizers for daily series. `backend/api.py` serves `GET /api/v1/metrics` and `GET /api/v1/metrics/{metric}/daily?timezone=…`. `frontend/index.html` and `frontend/app.js` add a metric selector, SVG daily scatter plot, and a fallback table with sample counts and measurement IDs. Points are not joined across gaps. No schema, import, or data migration.

## Verification

- `node --check frontend/app.js` succeeded. `python -m pytest -q` completed with **50 passed, 51 subtests passed** across both increments.
- The launcher-backed API fixture test verified the registry and an observation moving to the previous calendar date in New York; a stored missing value remained null.
- Live Chromium 153 smoke verified the initial empty daily state, uploaded 24 labeled synthetic observations through the UI, and saw 12 weight points and 12 provenance rows. Exact headless reproduction command is in the [Phase 04 report](2026-11-24-phase-04-correlation.md).

## Decisions, limitations and handoff

Reuse the summaries for normalization and calendar ownership rather than implementing a second set of unit and validity rules. Daily scatter uses the same canonical fixture store as the panels. The chart does not prove provider coverage. The repo's Lyfta sandbox evidence still does not establish weight units, canonical identity/revisions, or personal-data coverage. Strava sessions require the owner's export; sleep stages, RHR/HRV baselines, meal timing, and real rendering require validated inputs. Do not mark Phase 03 complete. Next: validate authorized exports/phone sync and establish structured contracts before exposing session metrics. No commit created.
