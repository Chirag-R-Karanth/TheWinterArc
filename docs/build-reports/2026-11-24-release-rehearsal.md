# Build report — 2026-11-24 / Phases 05–07

## Changes

- Phase 05: `frontend/` adds side-by-side JPEG, PNG and WebP previews using browser object URLs. No upload, browser persistence, photo metadata extraction or backup inclusion. Manual comparisons are optional; mobility, mood and habit acquisition stay blocked on verified exports (and the identity of the MDF app).
- Phase 06: `backend/api.py` and the daily chart offer a CSV attachment for the selected metric and reporting timezone. Missing values are blank; dates, units, sample counts and measurement IDs accompany the means.
- Phase 07: Rehearsed a fresh Fedora 43 virtual-environment install and isolated fixture workflows. No SQLite schema changes. Reviewed the localhost and mutation guards, download types and policies, and the new `img-src` CSP allowance for object URLs. This is a scoped review, not a full security audit.

## Verification

| Command | Observed result |
|---|---|
| `python3 -m pytest -q` | 51 passed, 51 subtests passed, including restart, duplicate import, archive integrity, loopback guards, isolated restoration and CSV parity |
| `node --check frontend/app.js` | Passed |
| `time node tests/browser_analytics.mjs http://127.0.0.1:18766/ http://127.0.0.1:19223` | 2.101 s wall time for one smoke run, excluding server and browser startup; synthetic PNG preview, keyboard clear, chart, CSV link and lagged R fit passed. Not a scalability benchmark |
| `rpm -E %fedora` | 43 |
| `python3 -m venv "$tmp/venv"` followed by `"$tmp/venv/bin/python" -m pip install -q -r requirements.txt` and `"$tmp/venv/bin/python" -m pip check` | No broken requirements |
| `PORT=18767 PYTHON="$tmp/venv/bin/python" WINTERARC_DATA_DIR="$tmp/data" ./serve.sh` | `/api/v1/health` returned `{"status":"ok","mode":"fixture_only"}` |

Use `tmp=$(mktemp -d)` for an isolated Fedora installation. For browser reproduction, see the [correlation report](2026-11-24-phase-04-correlation.md#launch-and-reproduction). The recorded test blocks HTTPS after the initial load; a system-wide offline rehearsal is still open.

## Open gates

Real source imports, canonical workout sets and readiness inputs, a persistent gallery, periodic reports, wider keyboard and reduced-motion checks, scale benchmarks and packaging remain open. No real data or photo files were used for this rehearsal. No production data migration was needed or performed.
