# Functional requirements
| ID | Module | Required behavior |
|---|---|---|
| R01 | Overview | Latest measurements, weekly trends, activity heatmap, sync status, configurable panels |
| R02 | Body | Weight, 7/30-day averages, weekly/monthly changes, measured body fat/lean mass, goal trajectory |
| R03 | Strength | Sessions, sets, reps, volume, frequency, density, exercise progression, PRs, estimated 1RM |
| R04 | Muscle | Selectable anterior/posterior SVG map, primary/secondary exposure, time since training, workload and confidence |
| R05 | Sports | Distance, duration, pace, speed, elevation, HR, zones only with valid inputs; running, cycling, swimming and other sports |
| R06 | Sleep | Duration, timing, consistency, stages, hypnogram, RHR/HRV baselines, optional readiness |
| R07 | Nutrition | Calories, macros, fibre, available micronutrients and meal timing; missing logs not zero |
| R08 | Mobility | Frequency, duration, region coverage; no inferred range of motion |
| R09 | Mood | Timeline, category distribution, temporal patterns, privacy controls; no diagnosis |
| R10 | Habits | Calendar heatmap, completion rates, streaks, day-of-week patterns; no logging |
| R11 | Correlation | Metric selection, aggregation, lag, rolling window, Pearson/Spearman, regression, LOESS, sample count |
| R12 | Gallery | Local photos, thumbnails, timeline, side-by-side and slider comparison, optional body measurements |
| R13 | Reports | Weekly/monthly/quarterly/annual comparisons, charts, completeness and methodology; PDF/HTML/CSV/JSON exports |
| R14 | Sources | Validated connection status, sync/import controls, errors, counts, history, coverage, raw inspection |
| R15 | Settings | Themes, date ranges, source precedence, units, backup and privacy settings |
## Cross-cutting
Offline operation after ingestion; no fabricated values; source attribution and units; accessible keyboard navigation; reduced motion; responsive desktop layouts; chart zoom/filter/export; explicit empty/error/loading states; persistent preferences; incremental processing, indexed queries and lazy rendering.
