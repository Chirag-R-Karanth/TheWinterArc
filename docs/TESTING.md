# Verification strategy
Use pytest, R tests and Playwright or existing equivalents. Synthetic fixtures only in isolated test/demo storage. Record exact commands, exit codes and observed results; distinguish not run, blocked, failed and passed.
- Ingestion: repeat imports, malformed data, interrupted transaction, timezone/unit conversion, duplicates across sources, cursor retry, schema drift.
- Persistence: migrations on copies, foreign keys, rollback, restart persistence, concurrent reads, backup and restore checksums.
- Analytics: hand-computed expected values, missing/zero distinction, sample-size guards, lag direction, rolling windows, workload decay and reproducibility.
- Integration: expired credentials, rate limits, network failures, unsupported fields; live verification separately from mocks.
- UI: actual API-backed charts, navigation, date filtering, theme, keyboard, reduced motion, error and empty states.
- Security: path traversal, unsafe archives, token redaction, local API exposure, Git ignore coverage.
- Performance: measure startup, import throughput and chart query latency on representative multi-year synthetic data; optimize only after measurement.
