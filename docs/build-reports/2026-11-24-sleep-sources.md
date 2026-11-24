# Build report — 2026-11-24 / Sleep duration and provider discovery

## Shipped

- `backend/api.py`: `GET /api/v1/sleep/summary?timezone=UTC` serves the existing versioned sleep calculation from stored synthetic measurements. Invalid IANA timezone names return HTTP 422, as with body summary.
- `frontend/index.html` and `frontend/app.js`: the dashboard shares one timezone control across body and sleep. The sleep panel shows the local window end, 7/30-day averages in minutes, observed days versus total days, sample counts, and empty/error states. The example fixture includes sleep rows. The panel explains that it summarizes daily fixture totals and does not report timing, consistency, stages, hypnograms, resting heart rate, HRV, or readiness.
- `backend/providers.py` and `tests/test_providers.py`: this increment includes the expanded blocked registry for Strava, Lyfta, Google Fit / Health Connect, FatSecret, How We Feel, Bend, BetterMe, MDF, and Zepp. YouTube is opt-in at the registry level and absent from the default API/dashboard. `tests/test_api.py` verifies default discovery over loopback.

## Fit lookup

The working-tree legacy `js/services/integrations.js` simulates Fit data. A local checkout search (`rg -il --hidden -g '!.git' -g '!*.zip' 'google[ _-]?fit|fitness\.googleapis\.com' ..`) and local-ref search (`git -C .. grep -il -E 'google[ _-]?fit|fitness\.googleapis\.com' origin/main`) found no standalone Google Fit script; the latter matched `README.md` only. The local `origin/main` tree at `android/app/src/main/java/com/winterarc/companion/` uses AndroidX Health Connect, as shown by `HealthRead.kt` and `SyncWorker.kt`. The companion was inspected, not run; no provider connection or import was verified.

## Verification

| Command from `V2/` | Exit | Result |
|---|---:|---|
| `PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider` | 0 | 37 passed, 46 subtests passed |
| `node --check frontend/app.js` | 0 | JavaScript syntax passed |
| `sh -n serve.sh` | 0 | Launcher syntax passed |
| `git diff --check` | 0 | Tracked diff passed; untracked V2 files are excluded |

The live test launches `serve.sh` on loopback with an isolated temporary SQLite store, checks the empty response, posts 6 h and 480 min totals plus a missing value, and queries both UTC and America/New_York. The average is 420 min in both 7/30-day windows. UTC ends on January 2 with one valid day; New York ends on January 1 with two valid days. An invalid timezone returns 422. The live server also serves the sleep panel markup; interactive browser rendering was not tested (no browser executable found on PATH).

## Launch and next action

Follow the [local launch instructions](2026-11-24.md#launch-and-reproduction), click **Import example fixture**, then apply `America/New_York` to see coverage change. Continue with the next Phase 03 slice. Phase 02 still needs an owner-provided real export kept outside Git; the sleep checks establish fixture-level behavior only.
