# Build report — 2026-11-24 / Phase 02 / USB companion archive

**Status:** Desktop receiver verified with synthetic companion-shaped requests over loopback. Actual phone and USB sync not run.

## Scope and changes

Added `healthconnect_receiver.py`, `tests/test_healthconnect_receiver.py` and the [USB runbook](../HEALTHCONNECT_USB.md); linked it from `README.md` and updated status, decisions and learnings. The receiver owns its own private XDG SQLite archive; no Android or canonical Store modifications or data migration.

## Verification

Inspected the local `origin/main` at `b2d41dc8ee405ce54f3bdb597fc6e8472fa73a7d` with `git show origin/main:android/app/src/main/java/com/winterarc/companion/ApiClient.kt origin/main:android/app/src/main/java/com/winterarc/companion/HealthRead.kt`, plus the worker, queue, preferences, manifest and activity/layout on that ref. Observed one JSON POST per queued item with `X-API-Key`, optional omitted value, UTC second-resolution timestamps and status-200-only acknowledgements. The activity supports **Save & sync now**, and the manifest allows HTTP.

| Command (from `V2`) | Actual |
|---|---|
| `python -m pytest -q` | Exit 0: 42 passed, 46 subtests passed in 8.80 s |
| `python healthconnect_receiver.py --help` | Exit 0; shows `--port` |
| `command -v adb` | Exit 0; `/usr/bin/adb` |
| `git diff --check` | Exit 0; tracked diff only, not the untracked V2 tree |

The tests started the receiver on loopback and verified byte preservation, visibility after ACK, duplicate ACK across restart, preserving changed payloads, rejection paths, deadline recovery, private archive paths and permissions, and a forced SQLite commit-time lock failure with rollback and successful retry.

## Launch and next action

Follow the [USB runbook](../HEALTHCONNECT_USB.md) and compare count-only archive results after a real companion sync. No physical handset, real records or live provider behavior were verified in this increment. No commit created.
