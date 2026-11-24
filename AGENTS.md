# Agent instructions
Read MASTER.md, then docs/OVERVIEW.md, ARCHITECTURE.md, REQUIREMENTS.md, IMPLEMENTATION_STATUS.md, DECISIONS.md and LEARNINGS.md. Read the active phase specification before editing. Inspect the existing repository first; this bundle is a specification, not evidence of existing functionality.
- Preserve existing code and user data; never reset, clean, overwrite or migrate destructively. Inspect git status and protect unrelated changes. Work on a dedicated branch where permitted.
- Implement one verified vertical slice at a time. Do not stop at planning. Run tests and launch the app where possible.
- No fabricated integrations, data, test results or completion claims. Label fixtures and unsupported sources.
- Keep private data, photos, tokens and backups outside Git. No remote uploads or paid dependencies without approval.
- Update IMPLEMENTATION_STATUS, LEARNINGS, DECISIONS and a dated build report after each increment. Record exact commands and observed results.
- Ask before destructive operations, major stack changes, mobile companion development or protected-branch pushes. Never push automatically.
