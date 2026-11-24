# TheWinterArc — master execution prompt
Act as senior software architect, data engineer, statistical analyst and UI engineer. Build a single-user Fedora desktop personal performance analytics workstation. It aggregates existing app data; it is NOT a logging application. Follow AGENTS.md and all specifications in docs/. Priority: data integrity, privacy, acquisition reliability, analytical correctness, functionality, performance, UX, polish.
## Execution
1. Audit repository, branches, existing schemas, tests and launch commands. Record findings in REPOSITORY_AUDIT.md; do not assume a greenfield project.
2. Reconcile existing implementation with the proposed architecture. Document conflicts and decisions; preserve working features.
3. Execute phases in ROADMAP.md, starting at the first incomplete gate. Implement, test, inspect actual behavior, fix and document each increment. Continue autonomously on safe work; stop at genuine approval or credential blockers, not merely after planning.
4. Verify integrations against official documentation and real exports. Implement supported adapters first; never invent endpoints or claim a mock is connected.
5. Keep living records current. Report files changed, commands, observed results, blockers, launch instructions and next action. Commit verified increments locally where authorized.
## Definition of done
Real imported data survives restart; repeated import is idempotent; raw provenance is recoverable; charts query actual stored records; offline operation, backup restoration, missing values and failure states are verified. No mandatory cloud, subscription or manual logging. Unsupported integrations remain explicitly blocked. See ACCEPTANCE.md.
