# Phase 02 — Acquisition
Status: NOT VERIFIED / NOT STARTED in this documentation bundle.
## Prerequisites
Previous phase gate verified or explicitly documented as blocked; do not bypass dependencies.
## Implementation
Implement verified export adapters first, then authorized API sync; cursor, retries, deduplication, source precedence and sources dashboard.
Inspect existing implementation, define affected contracts, implement smallest functional slice, add tests, launch and verify. Keep changes reversible and preserve existing data.
## Exit gate
At least one real import verified if user supplies data; otherwise mark gate blocked. No fake connection states.
## Deliverables
Code and tests as applicable; updated architecture/decisions if changed; implementation status; dated build report; learnings; exact launch/test commands. Record actual evidence and blockers. Commit locally only after verification and where authorized.
