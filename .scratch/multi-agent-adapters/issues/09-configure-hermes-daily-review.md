# 09 — Configure scheduled Hermes Daily Reviews

**What to build:** An Agent Operator can inspect and apply Hermes setup, run the review manually, and schedule the same end-to-end Daily Review so material work creates or updates one pull request and minor work produces a no-update result.

**Blocked by:** 06 — Produce a manual Hermes Review Draft.

**Status:** ready-for-agent

- [ ] Dry-run setup reports binary, capability, Agent Source, Review Skill, schedule, repository-access, and private-state changes without mutating configuration.
- [ ] Applied setup requires explicit operator action, preserves unrelated Hermes configuration, and treats one selected profile or home as one Agent Source.
- [ ] Repository-scoped Git access and Hermes authentication status are verified without reading or printing credential values.
- [ ] Manual and scheduled runs use the same collector, Review Skill, privacy validation, Review Identity, and cursor transaction.
- [ ] Hermes cron and OS-scheduler options are documented with time-zone, Gateway, main-checkout, and self-review exclusions.
- [ ] A material synthetic day creates or updates one proposal, while an immaterial day advances eligible cursors through no-update without creating content.
- [ ] Installer, schedule, retry, attribution, privacy, and publication regressions are covered without installing, updating, or reading a real Hermes profile in automated tests.
