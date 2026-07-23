# 10 — Produce a manual Pi Review Draft

**What to build:** An Agent Operator can manually turn safely loaded Pi sessions into a bounded, correctly attributed, Publication-Safe Review Draft while excluding Pi thinking, tools, execution, generated summaries, and uncertain intermediate-agent activity.

**Blocked by:** 07 — Read Pi sessions without modifying the source.

**Status:** ready-for-agent

- [ ] Only explicit user and assistant text from supported message entries becomes a Visible Message.
- [ ] Thinking, tool calls, tool results, shell execution, images, custom messages, branch summaries, compaction summaries, labels, model changes, extension state, and unknown types are excluded.
- [ ] Session and entry identities remain opaque, branch behavior is deterministic, and local paths never enter the Review Window or public attribution.
- [ ] Persistent third-party subagent sessions are excluded through a supported rule or cause collection to fail closed when provenance is uncertain.
- [ ] Review Day filtering, ordering, self-review exclusion, and per-session cursors produce the standard Review Window.
- [ ] The Pi Review Skill runs without session persistence and can turn the private Review Window into a Review Draft and safe dry-run submission.
- [ ] Synthetic tests cover multiple branches, time-zone boundaries, repeated entry times, cursor retries, privacy exclusions, and unknown future types.
- [ ] The supported Pi SDK boundary, snapshot rule, Agent Source identity, branch policy, and subagent limitation are captured in an accepted decision record.
