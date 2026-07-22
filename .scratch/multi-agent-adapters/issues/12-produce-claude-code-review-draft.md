# 12 — Produce a manual Claude Code Review Draft

**What to build:** An Agent Operator can manually turn a complete prospective Claude Code capture interval into a bounded, correctly attributed Review Draft, while incomplete or historical-only intervals stop without pretending to be complete.

**Blocked by:** 08 — Capture Claude Code Visible Messages prospectively.

**Status:** ready-for-agent

- [ ] The collector reads normalized journal events for the configured Review Day and produces the standard Review Window with deterministic ordering and per-session cursors.
- [ ] The Claude Agent SDK is used for supported session inventory and coverage reconciliation only.
- [ ] Missing historical message timestamps are never replaced with filesystem, session activity, or other indirect times.
- [ ] Pre-install history, malformed journals, missing capture intervals, and uncertain subagent provenance are reported as incomplete without cursor advancement or historical backfill.
- [ ] The current review session is excluded from collection.
- [ ] The Claude Code Review Skill can turn a complete private Review Window into a Review Draft and safe dry-run submission.
- [ ] Synthetic tests cover time-zone boundaries, hook coverage markers, concurrent sessions, reconciliation mismatch, retries, no-update, and private attribution.
- [ ] The prospective hook boundary, coverage semantics, Agent Source identity, exclusions, and no-backfill decision are captured in an accepted decision record.
