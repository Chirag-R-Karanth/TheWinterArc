# Anatomy and motion — 2026-11-25

Added original front/back SVG anatomy views and subtle chart and control motion inspired by the Lyfta references. SVG color indicates the selected region. Muscle workload and readiness remain unavailable.

- `python3 -m pytest -q`: 51 tests and 51 subtests passed.
- `node --check frontend/anatomy.js`: passed.
- Live Chromium via `node tests/browser_analytics.mjs http://127.0.0.1:18766/ http://127.0.0.1:19223`: passed keyboard anatomy selection, reduced-motion chart checks, and the existing fixture/R workflow. See [browser launch instructions](2026-11-24-phase-04-correlation.md#launch-and-reproduction).
- `Rscript --version`: 4.5.3. `Rscript --vanilla backend/correlation.R 5 3` on tab-separated rows `0 60 300`, `1 62 360`, `2 64 420` returned Pearson and Spearman of 1, slope approximately 30, and rolling counts 3, 2, 1. Real provider analysis was not exercised.
