# Architecture decision log

### 2026-11-24 — Daily registry and correlation

Reuse the core metric normalizers for daily charts and pairwise analysis. Align X on local day `t` with Y on `t + lag`; omit missing pairs and retain measurement IDs. Run exploratory calculations on demand in base R without persisting results or substituting a different engine when R is unavailable. See the [correlation build report](build-reports/2026-11-24-phase-04-correlation.md).

### 2026-11-24 — Cardio, overview and workout contract

- Cardio v1 uses positive `heart_rate` / `bpm` samples, averaging within local days before giving each observed day equal weight over 7/30 days. Do not pair scalar rows by timestamp to infer sessions, pace, or zones.
- Overview v1 reuses daily validators for weight, sleep duration, nutrition energy and HR. Adjacent seven-day windows end on the latest supported date among those metrics (even if missing). Retain the latest valid raw observation separately with original unit and import ID; ties use the larger measurement ID. No change is returned without both means.
- Lyfta validation keeps nested ordering, fields and sample flags as received. Defer canonical writes until an authorized sample establishes identity and revision behavior; do not interpret unitless load or undocumented set types.

For the Phase 03 nutrition slice, use per-day means of reported daily totals and expose per-nutrient coverage. Do not substitute zero for missing days or infer meal timing from daily totals.

### 2026-11-24 — Standalone companion archive

Accept the existing Android companion contract over USB `adb reverse` on a dedicated authenticated loopback port. Use a private XDG SQLite archive with exact BLOB uniqueness and commit-before-ACK; keep changed payloads for the same source key. Keep it separate from the canonical Store until reconciliation rules exist for companion windows and revisions. The receiver can be stopped and the reverse mapping removed without a Store migration. This desktop increment does not change Android; physical USB verification is outstanding.

### 2026-11-24 — Fixture sleep duration and provider discovery

Keep sleep duration on the canonical measurement path until real exports establish session semantics. Version 1 groups fixture totals by local timestamp date, normalizes to minutes, averages repeated totals within each day, and gives observed days equal weight in 7/30-day windows anchored to the latest supported row. Show coverage and valid sample counts alongside averages. Use the same timezone control for body and sleep; neither panel infers sleep stages or readiness.

Expose the expanded blocked registry without connection actions. YouTube remains optional and is excluded from default Sources. The legacy Fit mock and the separate Android Health Connect implementation do not establish a verified V2 import path; any bridge work requires approval and verification.

### 2026-11-24 — Deferred acquisition verification

Keep Strava visibly blocked until an actual export validates the adapter. Proceed with provider-independent Phase 03 calculations through the existing canonical fixture store, as requested. Body summaries use the latest recognized local date and compare adjacent non-overlapping windows; they give equal weight to observed daily means and disclose coverage. Version the method because changing these rules would change reported values.
## ADR-001 — Independent V2 foundation (accepted, 2026-11-24)

Use FastAPI and vanilla JS on the same loopback origin with independent SQLite storage. Extending the simulated legacy dashboard in place would couple V2 to existing browser state; the separate `origin/main` lineage was not run or adopted. Keeping the foundation in `V2/` preserves the legacy dashboard and requires no legacy data migration. V2 can be stopped without changing the legacy app or its storage.

## ADR-002 — Transactional raw archive (accepted, 2026-11-24)

Store exact import bytes as a SQLite BLOB in the same transaction as the related import records. This avoids coordinating a separate raw file write with a database commit and preserves source bytes without reserialization. Duplicate, rollback, restart, and backup/restore tests provide fixture-level evidence for this choice.

R, ECharts, optional D3/Anime.js, Tauri, OCaml, and encrypted remote backups remain proposals for later work, not verified Phase 01 components.
## ADR template
ID / date / status (proposed, accepted, superseded); context; options; decision; rationale; consequences; evidence; rollback; approval if required. Never silently replace an accepted decision.
