# 13 — Configure scheduled Claude Code Daily Reviews

**What to build:** An Agent Operator can inspect and apply Claude Code setup without losing existing project customization, then run complete prospective Daily Reviews manually or on a local schedule.

**Blocked by:** 12 — Produce a manual Claude Code Review Draft.

**Status:** ready-for-agent

- [ ] Setup requires a Claude Code release with the display hook and a pinned, tested Agent SDK capability set.
- [ ] Dry-run setup reports hook, skill, coverage-start, retention, schedule, repository-access, and private-state changes without mutation.
- [ ] Applied setup requires explicit operator action and merges with existing project hooks, skills, and settings rather than replacing them.
- [ ] Repository-scoped Git access and Claude Code authentication status are verified without reading or printing credential values.
- [ ] Hooks perform capture only; a Desktop local task or OS scheduler runs the Review Skill from the main checkout at the configured Review Day boundary.
- [ ] Manual and scheduled runs share coverage reconciliation, privacy validation, Review Identity, cursor transactions, and self-review exclusion.
- [ ] A complete material interval creates or updates one proposal, an immaterial interval completes through no-update, and an incomplete interval creates neither.
- [ ] Installer preservation, scheduling, coverage start, retention, retries, attribution, privacy, and publication regressions are covered without reading real Claude Code transcripts.
