# Implementation status

Phase 03 also includes a fixture-verified nutrition summary (energy, macros, fibre, sodium and iron). Meal timing and real provider coverage remain open.
As of 2026-11-24. See the [repository audit](REPOSITORY_AUDIT.md) and [sleep and sources build report](build-reports/2026-11-24-sleep-sources.md).

| Phase | Status | Evidence | Blocker |
|---|---|---|---|
| 00 Audit | Repository baseline recorded | Legacy assets returned HTTP 200 on loopback; lineages and preservation plan documented | Browser not exercised; `origin/main` not run |
| 01 Foundation | Fixture exit gate verified | 25 passed, 3 subtests; live loopback, restart, duplicates, rollback, and backup restoration covered | Fedora and browser validation outstanding |
| 02 Acquisition | Scaffold and standalone USB receiver implemented; real acquisition unverified | [Companion archive loopback tests](build-reports/2026-11-24-healthconnect-usb.md); provider registry retained | Owner phone/real records for USB verification; real export for Strava |
| 03 Core analytics | In progress | Body, sleep duration, nutrition, [measured HR](build-reports/2026-11-24-cardio.md) and [overview](build-reports/2026-11-24-overview.md) verified with fixtures over loopback; [Lyfta page validation](build-reports/2026-11-24-workout-contract.md) verified against public sandbox | Browser, real-data rendering, structured import and session analytics |
| 04 Advanced analytics | Correlation lab verified with fixtures | [Correlation build report](build-reports/2026-11-24-phase-04-correlation.md); [daily metric registry](build-reports/2026-11-24-phase-03-metric-registry.md) | Canonical workout sets for muscle exposure; validated baseline inputs for readiness; real-data acceptance |
| 05 Lifestyle | Partial: local side-by-side photo comparison | [Build report](build-reports/2026-11-24-release-rehearsal.md) | Verified mobility, mood and habit exports; persistent gallery and timeline |
| 06 Refinement | Partial: daily CSV and keyboard smoke | [Build report](build-reports/2026-11-24-release-rehearsal.md) | Periodic reports, customization, broader accessibility and performance testing, packaging |
| 07 Release | Fixture release rehearsed on Fedora 43 | [Build report](build-reports/2026-11-24-release-rehearsal.md) | Real-provider acceptance, full offline and release gates |

## Next action
Verify an actual phone sync using the [USB runbook](HEALTHCONNECT_USB.md). When an owner-provided Strava export is available, keep it outside Git and use it to validate the acquisition adapter.

## Launch

Follow the [V2 launch instructions](build-reports/2026-11-24.md#launch-and-reproduction) to start the loopback shell.
## Feature tracking
- **R04 Anatomy:** Original front/back SVG with nine selectable regions. Workload and readiness remain unavailable pending validated inputs.
- **Dashboard:** Latest measurements and daily trends lead the workspace, with responsive navigation and light/dark styling. See the [dashboard build report](build-reports/2026-11-25-dashboard.md).
- **R11 Correlation:** Daily metric selection, signed calendar lag, rolling coefficients, Pearson/Spearman, linear and LOESS fits, and paired provenance. Results are exploratory and show sample counts; no inference or uncertainty intervals.
- **R01 Overview:** Latest weight, sleep duration, energy and HR with adjacent weekly comparisons and coverage; link to provider discovery. Heatmap, configurable panels and actual sync status remain open.
- **R03 Strength:** Offline Lyfta workout page validation only. Need an authorized real response and confirmed load semantics and revision rules.
- **R05 Sports:** Measured HR sample means and coverage only. Session distance/duration, pace, speed, elevation and zones remain unavailable.
- **R02 Body:** Weight, measured body fat and lean mass have fixture-verified averages, changes and coverage; goal trajectory remains open.
- **R06 Sleep:** Synthetic daily duration, 7/30-day averages, timezone and coverage are available. Timing, consistency, stages, hypnogram, resting heart rate, HRV and readiness are open.
- **R14 Sources:** Expanded discovery shows blocked status and next steps. The existing Android companion has a standalone USB archive path with fixture-verified HTTP behavior; the V2 Store and Sources UI do not consume it.
- **R15 Settings:** SQLite backup restoration was tested; this does not verify the full Settings UI.
