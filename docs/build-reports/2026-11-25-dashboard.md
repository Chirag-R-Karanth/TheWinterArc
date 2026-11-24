# Dashboard redesign — 2026-11-25

Reviewed the Lyfta screenshots and app list in the local `Inspirations/` folder. The V2 workspace now opens with latest measurements and a daily chart, then displays setup and detail panels. The dashboard uses system theme preferences, a desktop navigation rail and wrapped navigation on narrow screens. Metric tiles read the existing overview API and display a dash for missing values.

- `python3 -m pytest -q`: 51 tests and 51 subtests passed.
- `node --check frontend/app.js`: passed.
- With an isolated store and live headless Chromium, `node tests/browser_analytics.mjs http://127.0.0.1:18766/ http://127.0.0.1:19223` passed at desktop and compact viewport sizes. The smoke test checked the four tiles, the imported weight, navigation layout, fixture import, charts, CSV link, keyboard photo clearing and correlation. See the [browser launch command](2026-11-24-phase-04-correlation.md#launch-and-reproduction).
