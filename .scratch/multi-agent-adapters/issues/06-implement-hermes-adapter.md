# 06 — Produce a manual Hermes Review Draft

**What to build:** An Agent Operator can manually collect a bounded Hermes Review Window and turn it into a correctly attributed, Publication-Safe Review Draft without persisting raw Hermes exports.

**Blocked by:** 05 — Make Agent Platform selection explicit.

**Status:** ready-for-agent

- [ ] Hermes is detected through a read-only version and exporter-capability probe against an explicitly tested compatibility range.
- [ ] Collection invokes the documented exporter directly, consumes output incrementally, and never writes or logs the raw export.
- [ ] Only human and primary-agent Visible Messages survive; system, tool, cron, tool-source, reasoning, hidden markup, and live-parent delegated/background activity are excluded.
- [ ] User-created branches and supported compression continuations remain eligible without admitting inactive or rewritten content incorrectly.
- [ ] Review Day filtering, deterministic ordering, self-review exclusion, and independent per-conversation cursors produce the standard Review Window.
- [ ] The Hermes Review Skill can turn the private Review Window into a Review Draft and exercise submission safely in dry-run mode.
- [ ] Synthetic exporter tests cover malformed and oversized output, non-zero exits, rewrites, compaction differences, privacy exclusions, and failure atomicity without reading real sessions.
- [ ] The supported Hermes boundary, Agent Source identity, exclusions, and compatibility policy are captured in an accepted decision record.
