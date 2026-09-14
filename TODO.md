# TheWinterArc — Build TODO

**Last updated:** 2026-09-14  
**Status basis:** Backend (Phases 1, 2, 4, 5) and the Phase 3 Android app are implemented and verified — the Android APK now builds against Health Connect `1.0.0-alpha11`. Remaining gaps are external dependencies (device install, real credentials, HDD decision, Tailscale serve enable) and runtime hardening. **Strava has been dropped** per plan revision; README will be updated separately by the user.

## Status legend

- `[x]` Done / decided
- `[ ]` Must be done
- `[!]` Must be investigated or confirmed before implementation
- `[-]` Dropped / no longer in scope

## Completed decisions and planning

- [x] Define the product: a local-first, self-hosted personal health and fitness aggregation dashboard.
- [x] Choose the hosting target: existing Fedora desktop, not a Raspberry Pi or cloud deployment.
- [x] Choose local-first remote access: Tailscale with no public ports exposed.
- [x] Choose storage: Postgres with TimescaleDB, using the 1 TB HDD for the data directory.
- [x] Choose backend: Go for ingestion, sync jobs, and the unified API.
- [x] Choose analysis service: R with Plumber, kept separate from core CRUD.
- [x] Choose reverse proxy and access gate: Caddy, basic auth, and local HTTPS.
- [x] Choose frontend approach: Go templates, htmx, Observable Plot/D3, and Leaflet.
- [x] Set sync expectation: hourly batch sync is acceptable; true real-time sync is not required.
- [x] Define source-of-truth precedence by metric type.
- [x] Decide to retain raw source payloads for debugging and audit.
- [x] Decide to store timestamps in UTC and convert only for display.
- [x] Decide to retain duplicate records but exclude non-primary overlaps from aggregate queries.
- [x] Define the Android companion approach: Kotlin, Health Connect, SQLite queue, WorkManager, and Tailscale API-key submission.
- [x] Define the visual direction: Catppuccin Macchiato, one accent hue per category, numbers-first overview, minimal motion.
- [x] Cut the natural-language agent/chat query page from v1.
- [-] Strava integration dropped (cardio source revisited in the revised plan).
- [x] Identify the main risks: desktop downtime, Health Connect backfill, source API availability, token expiry, schema drift, timezone/DST errors, and R-service failure.

## Phase 0: Environment setup

- [x] Docker and Docker Compose are installed and running (Docker 29.6.2, Compose 5.3.1).
- [!] 1 TB HDD (`sda1`) is still NTFS and mounted at `/run/media/neo_phantom_byte/TheSandiskVoid`. NTFS is unsuitable for Postgres. **User decision needed:** reformat ext4 + mount, or keep Postgres data on the system disk.
- [x] Postgres data-directory path is configurable via `PGDATA_HOST_PATH` in `.env` (defaults to `./data/postgres`, bind mount `pgdata` in `docker-compose.yml`).
- [x] Tailscale installed and running on the desktop (`thesius` 100.107.249.70); phone `redmi-15-5g` on the tailnet.
- [x] Base Docker Compose skeleton created with stubs for Go backend, R/Plumber, Postgres/TimescaleDB, and Caddy.
- [x] Caddy basic auth configured (hash in `CADDY_BASIC_AUTH_HASH`, `:8081`) and verified 401→200 locally and over the tailnet IP.
- [x] Backend no longer host-mapped on 8080 (expose-only behind Caddy; active on next compose recreate).
- [ ] Tailscale Serve enabled on the tailnet (**user action**: https://login.tailscale.com/f/serve?node=nfz3iorfoR11CNTRL) then `tailscale serve --bg https://localhost:8081`.
- [ ] Confirm the dashboard is reachable from the phone over Tailscale HTTPS.

## Phase 1: Data model and core backend

- [x] Unified `metrics` hypertable schema designed and migrated (TimescaleDB requires composite PRIMARY KEY `(id, ts_start)` and unique index `(source, source_key, ts_start)`).
- [x] Per-source detail tables: `lyfta_sessions` (stub table); Strava detail table removed with Strava.
- [x] Migrations runner embedded in the Go binary (`backend/internal/db`) with `schema_migrations` tracking; seed policy: api key from env, ingests are keyed only.
- [x] `metrics` configured as a TimescaleDB hypertable.
- [x] Go project skeleton (`backend/cmd/server`, `backend/internal/*`).
- [x] Configuration loading and env validation (`backend/internal/config`).
- [x] pgx connection pool (`backend/internal/db`).
- [x] Health-check endpoint `/healthz`.
- [x] Source-precedence and deduplication logic (`backend/internal/ingest`), verified live.
- [x] Overlap detection sets `is_primary` correctly (non-primary overlapping records retained).
- [x] Duplicate records remain queryable for audit/debugging (`status`/`is_primary` on `metrics`).
- [x] Aggregate-query helpers exclude non-primary duplicates (`metric_series` SQL + API filter).
- [x] Complementary overlays supported by keying on timestamps and metric type (e.g. HR over workout).

## Phase 2: Direct API integrations

- [-] Strava OAuth, activities pull, rate-limit polling removed with Strava drop.
- [x] FatSecret auth (OAuth1 HMAC-SHA1 signature) and nutrition-log ingestion (`diet_entries.get_month`), weight (`weight.get_month`).
- [!] Lyfta usable API unconfirmed — stubbed as unconfigured; credentials go in gitignored `secrets/api-keys.txt`.
- [ ] Lyfta ingestion once access method confirmed / export imported.
- [!] Bend usable API unconfirmed — stubbed as unconfigured.
- [ ] Bend ingestion once access method confirmed / export imported.
- [!] How We Feel usable API unconfirmed — stubbed as unconfigured.
- [ ] How We Feel ingestion once access method confirmed / export imported.
- [x] Hourly Go scheduler for all sources (`sync/manager.go`), interval configurable.
- [x] Per-source sync-health tracking (`sync_state` + `source_health`; error state persisted).
- [x] Sync-health exposed through API (`GET /api/v1/source-health`) and rendered by the frontend.

## Phase 3: Android companion app

- [x] Native Kotlin Android project scaffold (`android/`, Gradle Kotlin DSL), wrapper + SDK 35 toolchain verified.
- [x] Health Connect SDK integrated — connect-client `1.0.0-alpha11` (last alpha for compileSdk 35; 1.1.0 needs SDK 36).
- [x] Permission set + runtime grant flow (string permissions via `HealthPermission.getReadPermission`).
- [x] Reads steps (raw records summed), heart rate (sample avg), sleep (session duration) from Health Connect.
- [x] Local SQLite queue (`QueueStore.pending`).
- [x] WorkManager hourly background job (`SyncWorker`).
- [x] Flow implemented: read Health Connect → queue locally → POST to backend.
- [x] Long-lived API-key auth over Tailscale (`X-API-Key`; server URL + key editable in app).
- [ ] Retry with exponential backoff — currently WorkManager default backoff; verify against queue semantics.
- [x] Clear queued record only after HTTP 200 acknowledgement.
- [x] Backfill from `lastSyncMs` when desktop was offline.
- [x] In-app status screen: last sync time, queued count, server/server key fields, sync-now button.
- [x] APK builds successfully (`assembleDebug`) — `android/app/build/outputs/apk/debug/app-debug.apk`; install/verification on a device pending.

## Phase 4: R/Plumber analysis service

- [x] R/Plumber container (`analysis/Dockerfile`, rocker/r-ver:4.4 + plumber/jsonlite/RPostgres/DBI/lubridate; build verified with dev libs).
- [x] Plumber exposed only on internal Docker network (compose `expose: 8002`), consumed by backend via `WINTERARC_PLUMBER_URL`.
- [x] Correlation analysis endpoints: `/correlate` (sleep vs next-day performance; mood vs training load) over primary metrics.
- [x] Input/output contract: JSON payload `{xMetric, yMetric, from, to}` → `{n, r, p, slope, intercept, points}`.
- [x] `insights` table for precomputed analysis results.
- [x] Go calls Plumber on startup/6-hour schedule (`plumber` client) and on demand via `POST /api/v1/correlations/run`.
- [x] Timeout handling in Go client (2s dial / 30s request).
- [x] Retry: failed insights recorded in `insights` with status `failed`; on-demand runs re-attempt.
- [x] Graceful "insight unavailable" fallback — dashboard and correlation endpoint return a `503` hint, never crash (verified live with the service down).

## Phase 5: Frontend and dashboard

- [x] Go templates + htmx wiring; layout with Catppuccin Macchiato (`base.html`, `app.css`).
- [x] Overview page: calories, sleep, strain, mood, last workout, compact cards + sparklines relative to trailing 30-day baseline.
- [x] Training trends: volume/tonnage per lift, strength progression, workout-frequency heatmap.
- [x] Cardio trends: pace/distance, weekly mileage, route maps (Leaflet maps, Stadia tiles) + elevation profile.
- [x] Nutrition trends: daily calorie bars, trailing average overlay, stacked macro area, weight trend.
- [x] Recovery/Sleep trends: sleep-staged bars, heart-rate trend, HRV trend.
- [x] Mental Health trends: mood over time.
- [x] Flexibility trends: Bend session frequency/duration.
- [x] Correlations page with scatter plots and trendlines.
- [x] Correlation views read from `insights` table (stale-results fallback).
- [x] Leaflet integrated for route maps with live tile service (no caching).
- [ ] Verify responsive behavior in a phone browser over Tailscale (needs Tailscale serve enabled).
- [x] Visible per-source sync-health indicators (JS dots built from `/api/v1/source-health`).

## Phase 6: Hardening and polish

- [ ] Verify UTC storage and display behavior across timezone/DST boundaries.
- [ ] Test desktop downtime and Health Connect backfill behavior end-to-end (phone required).
- [ ] Test duplicate/overlapping records across multiple sources with real data.
- [ ] Test source-precedence rules against real captured data.
- [ ] Load-test Postgres/Go/R concurrently; confirm normal desktop use stays responsive.
- [ ] Backup strategy for the 1 TB HDD data + restore test.
- [ ] Review/tighten Caddy basic auth and Tailscale ACLs.
- [ ] Verify token-expiry and per-source auth-failure handling with real credentials.
- [x] Verified dashboard still renders when the R service is unavailable (503 + hint path).

## Future / not blocking v1

- [ ] Revisit a natural-language query layer only if fixed deterministic charts prove insufficient.
- [ ] Re-evaluate cardio source options under the revised plan (Strava dropped).
- [ ] Expand the R correlation set as more historical data accumulates.

## Recommended execution order

1. Reserve/provision Tailscale Serve (click the serve-enable link) and finalize the HDD data-directory decision.
2. Dump real provider credentials into `secrets/api-keys.txt`, copy into `.env`, confirm live sync (FatSecret first; investigate Lyfta/Bend/How We Feel access).
3. Build + validate the Android APK on a device and walk through a real Health Connect backfill over Tailscale (serve must be enabled).
4. Finish Phase 6 hardening against real overlapping data before calling v1 complete.

## Current implementation status

**Implemented and locally verified:** TimescaleDB schema + migrations, Go backend (ingest precedence/dedup, FatSecret client, sync scheduler + sync-health, insights + graceful R fallback), fully rendered dashboard pages, Docker Compose stack running end-to-end in containers (postgres/backend/analysis/caddy), Android companion builds (`app-debug.apk`).  
**Pending user/device actions:** Tailscale serve enable (admin link), HDD format decision, real source credentials, phone install of the APK + over-network verification.