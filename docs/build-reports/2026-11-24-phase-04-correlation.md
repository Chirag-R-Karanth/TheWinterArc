# Build report — 2026-11-24 / Phase 04 / correlation lab

Status: end-to-end synthetic correlation slice verified; Phase 04 gate partial/blocked.

Crash recovery re-verified the release checkout: `python3 -m pytest -q` passed 50 tests and 51 subtests, `node --check frontend/app.js` passed, and the live Chromium smoke below passed using a fresh temporary SQLite directory. This verifies the local fixture workflow, not real-provider readiness.

## Scope and changes

`backend/correlation.py` aligns normalized daily series on reporting-timezone calendar days; `backend/correlation.R` computes Pearson, Spearman, linear regression, LOESS (local linear, span .75), descriptive quartiles and rolling coefficients in base R. `backend/api.py` exposes same-origin `POST /api/v1/analysis/correlation`. `frontend/app.js` and `frontend/index.html` expose interchangeable metrics, dates, signed lag, rolling window, scatter/fits, distributions, pair provenance and missingness. `tests/test_api.py` and `tests/browser_analytics.mjs` exercise the launched app. Uses existing SQLite measurements; no migration or writes from analysis.

## Decisions and methodology

- Version 1 aligns X on date `t` with Y on `t + lag`; positive lag means Y occurs later. The inclusive range is on X and defaults to 90 calendar days through the latest aligned reporting date (when neither date is supplied). The API caps the range at 366 days and lag at ±90 days. Rolling windows contain calendar days, not a fixed number of pairs.
- Duplicate daily observations follow the core metric rules. No imputation. The result carries both observed-day counts, paired N, input measurement IDs, date and timezone, parameters, method version, computation timestamp and R version when executed. Results are returned on demand and are not saved as analysis history.
- A bounded `Rscript --vanilla` child receives only numeric pairs over stdin; no network, additional R packages or Python fallback. Missing/failed R returns 503 for nonempty requests. Verified with R 4.5.3; no general runtime version pin imposed.
- Exploratory only: no intervals or p-values, no autocorrelation/trend/confounding/multiple-comparison adjustment. Correlation requires at least three pairs and variation in both metrics; unstable or undersampled LOESS is unavailable.

## Verification and observed behavior

| Command | Observed result |
|---|---|
| `Rscript --version` | 4.5.3 |
| `node --check frontend/app.js` | Exit 0 |
| `python -m pytest -q` | 50 passed, 51 subtests passed |
| Live V2 launcher + Chromium smoke below | Health 200 (`fixture_only`); empty, fixture upload, daily plot, lagged correlation, fit/LOESS, tables, and invalid date validation passed |

The hand-calculated test pairs 60/62/64 kg with 300/360/420 min on the following local days: Pearson and Spearman 1, slope 30, intercept −1500, and rolling N 3/2/1. Reversing metric order and lag preserves N. Independent fixtures verified a constant series and LOESS predictions on an exact line. The first live attempt polled before startup; retrying readiness succeeded.

## Launch and reproduction

Run `./serve.sh` and open `http://127.0.0.1:8765/`. For a fresh browser smoke, run from V2:

```sh
tmp=$(mktemp -d /tmp/opencode/winterarc-analytics.XXXXXX)
CHROME="$HOME/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome"
(
  PORT=18766 WINTERARC_DATA_DIR="$tmp/data" ./serve.sh & server=$!
  "$CHROME" --headless --remote-debugging-port=19223 --user-data-dir="$tmp/chrome" about:blank > "$tmp/chrome.log" 2>&1 & browser=$!
  trap 'kill "$server" "$browser" 2>/dev/null || true' EXIT
  curl -fsS --retry 12 --retry-connrefused --retry-delay 1 http://127.0.0.1:18766/api/v1/health &&
  curl -fsS --retry 12 --retry-connrefused --retry-delay 1 http://127.0.0.1:19223/json/version &&
  node tests/browser_analytics.mjs http://127.0.0.1:18766/ http://127.0.0.1:19223
)
```

## Blockers and next action

Muscle exposure and anatomical map are not implemented: first establish canonical dated workout sets, comparable set types, and a versioned exercise-to-muscle mapping. Readiness is not implemented: first establish validated RHR/HRV, sleep and workload inputs and document baseline coverage/weighting. Real-provider and full Fedora desktop acceptance remain open. Parent owns the living-doc updates; use these findings and the [Phase 03 report](2026-11-24-phase-03-metric-registry.md) to aggregate status, decisions and learnings. No commit created.
