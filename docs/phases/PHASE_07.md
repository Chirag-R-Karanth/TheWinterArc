# Phase 07 — Release
Status: [Fixture release rehearsed on Fedora 43](../build-reports/2026-11-24-release-rehearsal.md); the full release gate remains open.
## Prerequisites
Previous phase gate verified or explicitly documented as blocked; do not bypass dependencies.
## Implementation
Run full test suite, security review, migration/restore rehearsal and Fedora installation verification.
Inspect existing implementation, define affected contracts, implement smallest functional slice, add tests, launch and verify. Keep changes reversible and preserve existing data.
## Exit gate
All applicable acceptance gates evidenced; unresolved blockers listed; no unsupported completion claims.
## Deliverables
Code and tests as applicable; updated architecture/decisions if changed; implementation status; dated build report; learnings; exact launch/test commands. Record actual evidence and blockers. Commit locally only after verification and where authorized.
