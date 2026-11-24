# Build report — 2026-11-24 / Phase 03 / Workout contract
Status: offline foundation verified against public sandbox; canonical import blocked.

`backend/lyfta.py` validates nested workout, exercise and set identities, offset-aware timestamps and explicit set completion while preserving input metadata and order. `tests/test_lyfta.py` covers preservation, ambiguous set IDs and missing timestamp offsets. No database changes, credentials, or app network requests.

Checked [Lyfta Developers](https://my.lyfta.app/community/api) and [OpenAPI](https://my.lyfta.app/openapi.json). The personal read API documents bearer keys, pagination, date filters and optional read-only OAuth. The separate `origin/main` Go client does not recognize `workout_perform_date` and is not a verified import path. The sandbox is public sample data, not an authorized account response; weight units and resistance semantics are not specified.

```sh
curl -fsS --max-time 10 https://my.lyfta.app/api/sandbox/v1/workouts | python -c 'import json,sys; from backend.lyfta import parse_workout_page; p=parse_workout_page(json.load(sys.stdin)); print(p["sandbox"], len(p["workouts"]), sum(len(e["sets"]) for w in p["workouts"] for e in w["exercises"]))'
python -m pytest -q && node --check frontend/app.js
```

Both commands exited 0: `True 2 3` for sandbox flag/workouts/sets, and 48 passed with 51 subtests passed; JS syntax check passed. No commit. Next: obtain an owner-authorized private response, verify identity/revision rules and load-unit provenance before canonical import and load-dependent analytics.
