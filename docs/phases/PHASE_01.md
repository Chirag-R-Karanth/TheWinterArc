# Phase 01 — Foundation
Status: NOT VERIFIED / NOT STARTED in this documentation bundle.
## Prerequisites
Previous phase gate verified or explicitly documented as blocked; do not bypass dependencies.
## Implementation
Implement local API, SQLite migrations, raw archive, normalization contract, import manifests, UI shell, local backup and restore.
Inspect existing implementation, define affected contracts, implement smallest functional slice, add tests, launch and verify. Keep changes reversible and preserve existing data.
## Exit gate
Fixture import persists across restart; duplicate import and rollback tests pass; isolated restore verified.
## Deliverables
Code and tests as applicable; updated architecture/decisions if changed; implementation status; dated build report; learnings; exact launch/test commands. Record actual evidence and blockers. Commit locally only after verification and where authorized.
