# Canonical data dictionary (proposed)
Every observation carries internal ID, source ID, external ID where present, observed UTC timestamp, original timezone/offset, imported timestamp, unit, quality status and raw-record reference. Use nullable fields for missing data; distinguish measured zero. Store original units and normalize explicitly.
| Entity | Core fields |
|---|---|
| sources | id, provider, capabilities, status |
| sync_runs | source, cursor, start/end, outcome, error, counts |
| raw_records | source, external ID, payload path/hash, import manifest |
| measurements | metric key, numeric value, unit, timestamp, quality |
| activities | type, start/end, duration, distance, HR, source |
| workouts / sets | session, exercise, set order, reps, resistance, unit |
| muscle_mappings | exercise, muscle, involvement weight, mapping version |
| sleep_sessions / stages | interval, stage, device attribution |
| nutrition | date or meal timestamp, energy, macros, nutrients, coverage |
| mood | timestamp, category, intensity if available, context |
| habits | external habit ID, scheduled date if known, completion |
| mobility | interval, duration, region if available |
| photos | local path, date, view, checksum |
| derived_metrics | definition version, window, inputs, value, confidence/completeness |
| analysis_runs | method, parameters, input IDs, software version, output |
| preferences / quality_issues | configuration; validation and reconciliation issues |
Use foreign keys, unique constraints, indexes and migration versioning. Define per-metric units, aggregation rules and valid ranges in a metric registry. Preserve source-specific fields in raw archive. Local day aggregation uses explicit timezone; handle DST and cross-midnight sessions.
