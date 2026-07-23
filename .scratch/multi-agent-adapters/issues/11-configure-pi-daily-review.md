# 11 — Configure scheduled Pi Daily Reviews

**What to build:** An Agent Operator can inspect and apply Pi setup, run a non-persisted review worker manually, and schedule the same end-to-end Daily Review through the operating system.

**Blocked by:** 10 — Produce a manual Pi Review Draft.

**Status:** ready-for-agent

- [ ] Dry-run setup reports package compatibility, Agent Source, session directory, exclusions, Review Skill, schedule, repository access, and private-state changes without mutation.
- [ ] Applied setup requires explicit operator action and preserves unrelated Pi configuration and extensions.
- [ ] Repository-scoped Git access and Pi authentication status are verified without reading or printing credential values.
- [ ] Review generation reuses Pi's configured model and provider without creating a persisted session or storing model credentials.
- [ ] Manual and OS-scheduled runs use the same collector, privacy validation, Review Identity, and cursor transaction from the main checkout.
- [ ] Custom session directories and persistent-subagent exclusions are documented and validated during setup.
- [ ] A material synthetic day creates or updates one proposal, while an immaterial day completes through no-update without duplicate or skipped messages.
- [ ] Installer, schedule, retry, attribution, snapshot safety, privacy, and publication regressions are covered without touching real Pi sessions.
