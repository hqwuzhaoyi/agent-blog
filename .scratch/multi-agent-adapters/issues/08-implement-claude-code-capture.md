# 08 — Capture Claude Code Visible Messages prospectively

**What to build:** Once capture is enabled, direct Claude Code prompts and assistant text displayed to the Agent Operator are recorded as a minimal private event journal suitable for a future exact Review Window.

**Blocked by:** 05 — Make Agent Platform selection explicit.

**Status:** ready-for-agent

- [ ] Direct user prompts are normalized from the supported prompt hook with an opaque session identity and local receipt time.
- [ ] Displayed assistant text is assembled by message and batch identity and committed only once when the display event is final.
- [ ] Hook retries are idempotent and concurrent sessions retain deterministic local sequencing.
- [ ] Tool, thinking, image, document, result, synthetic, subagent, malformed, empty, and unknown events are excluded before journal persistence.
- [ ] The journal stores only normalized visible text, opaque identifiers, receipt timestamps, sequencing, and minimum reconciliation metadata with restrictive permissions.
- [ ] Raw hook payloads are never retained, and partial or corrupt journal writes fail without presenting an interval as complete.
- [ ] Synthetic hook tests cover batching, retry delivery, concurrent sessions, self-review identifiers, provenance uncertainty, and private output without invoking real Claude Code sessions.
