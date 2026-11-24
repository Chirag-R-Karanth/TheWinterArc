# Engineering learnings

### 2026-11-24 — Lifestyle and release rehearsal

- A synthetic PNG decoded from a browser object URL under the app CSP. Keyboard clearing removed both the preview and the selected file; the feature requires no upload or store changes.
- CSV comparison with the daily API distinguished a missing cell from zero and verified that measurement IDs survived export. Fedora 43 launched the app from a newly installed virtual environment.

### 2026-11-24 — Daily series and correlation

- A timezone shift can change which dates pair even when the underlying measurements are unchanged. Test calendar-day alignment and reverse the metric order and lag to check paired counts.
- Rolling windows count calendar days; sparse windows can have too few pairs to report a coefficient. Display paired counts rather than treating missing pairs as zero.

### 2026-11-24 — Cardio, overview and workout contract

- The same three fixture HR readings produced 85 bpm in UTC and 100 bpm in New York once grouped by local day. This is an observed-day sample summary, not a time-weighted HR measure.
- A recent sleep observation can advance the shared overview week without replacing the latest weight observation. The fixture verified the original `lb` latest value alongside normalized `kg` weekly averages.
- Lyfta's public sandbox returned two workouts and three sets. The separate Go client does not recognize the documented `workout_perform_date` field. Neither the OpenAPI nor sandbox gave a unit for `weight` or established personal-data coverage or revision behavior.

Nutrition coverage counts days with valid nutrient totals; it does not establish that all meals were logged. The fixture checks distinguish a reported zero from an absent total.

### 2026-11-24 — Companion USB receiver

- The inspected `ApiClient` reports success only on HTTP 200, and `SyncWorker` clears acknowledged entries. An interrupted response can therefore cause a retry after commit. The loopback restart test confirms exact retries receive 200 without adding another row. A held SQLite read transaction forced commit failure and produced 503 with no archived row.
- `HealthRead` outputs window totals and per-record/session summaries, not original Health Connect records. A phone cursor is not per desktop destination, and overlapping step windows cannot be safely summed. See the [USB runbook](HEALTHCONNECT_USB.md).

### 2026-11-24 — Sleep duration and Fit lookup

- A timezone change can split same-day fixture totals across two reporting dates. In the live loopback test, UTC and New York both averaged 420 minutes, but coverage changed from one observed day to two. An average alone would hide that difference.
- `js/services/integrations.js` simulates Google Fit. The local `origin/main` companion uses Health Connect (`HealthRead.kt` and `SyncWorker.kt`), and no standalone Fit script was found in the inspected checkout or local ref. Treat that as a scoped lookup result, not proof that no script exists elsewhere.

### 2026-11-24 — Provider scaffold and body analytics

The loopback tests verified that the blocked source state is visible without credentials, and that timezone selection can change the local day used in analytics. Sparse fixture windows still produce a comparison when both contain observations; coverage must be shown with that comparison. Empty windows remain missing, not zero.
## 2026-11-24 — Audit and Phase 01 foundation

- HTTP 200 responses establish that the legacy loopback server serves assets, not that the dashboard works in a browser. Browser behavior and Fedora compatibility remain unverified.
- Exact bytes stored in the same SQLite transaction as import records let the fixture tests check archive integrity alongside duplicate handling, rollback, restart persistence, and backup restoration.
- Fixture success verifies the local import path, not a provider integration. Phase 02 remains blocked until the owner supplies a real export.
- `git diff --check` covered tracked changes only; it did not validate untracked V2 files. See the [build report](build-reports/2026-11-24.md) for the exact commands and results.
## Entry template
- Date / phase / commit:
- Question or problem:
- Evidence (commands, source links, observed behavior):
- Root cause or finding:
- What worked / what failed:
- Reusable lesson:
- Follow-up and affected specifications:
Distinguish hypothesis from verified finding. Do not include secrets or personal data.
