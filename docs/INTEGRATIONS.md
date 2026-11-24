# Integration feasibility and contracts
All statuses below are UNVERIFIED. Consult current official documentation and inspect actual exports before implementation. Record source URL, access date, authentication, scopes, fields, history, rate limits, costs, platform constraints and test evidence in INTEGRATION_FEASIBILITY.md.
| Source | Desired data | Key question |
|---|---|---|
| Lyfta | Sessions, exercises, sets, reps, weights, duration | Can detailed set records be exported or accessed officially? |
| Bend | Stretch sessions, duration, regions | Is a supported export available? |
| BetterMe | Workout and wellness activity | Which actual records are accessible? |
| How We Feel | Mood, time, categories, context | Authorized export and privacy controls? |
| FatSecret | Personal diary, macros, weight | Personal diary access, not merely public food database? |
| MDF | Habit completion and timestamps | Confirm exact app identity and export format |
| Strava | Activities, distance, pace, HR, elevation | Authorized API, scopes and rate limits |
| Zepp | HR, HRV, sleep, steps, workouts, SpO2 | Official export or authorized bridge? |
| Google Fit / Health Connect | Available Android health data | Verify current lifecycle; Health Connect is Android-side, not directly desktop-accessible |
## Adapter contract
Discover capabilities; validate connection; import file; historical/incremental sync where supported; preserve raw payload; normalize; report errors and cursor. Support idempotency, bounded exponential backoff, rate limits, atomic transactions and import manifests. Keep secrets in keyring. Never scrape private services or invent endpoints. No mobile bridge without approval.
## Status vocabulary
Unverified; verified automatic sync; supported file import; authorization required; external bridge required; unsupported. Mock tests do not establish real connectivity. Deduplicate overlapping activities using source IDs and conservative matching; preserve ambiguous records for review and never silently discard raw data.
