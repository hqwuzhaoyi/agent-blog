# 05 — Make Agent Platform selection explicit

**What to build:** An Agent Operator can select a supported Agent Platform and receive correctly attributed collection behavior, while an unknown or incomplete platform configuration stops safely instead of falling back to OpenClaw.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] OpenClaw and Codex are registered explicitly with their collector, fixture adapter, platform label, and default source label.
- [ ] Live and fixture collection resolve the platform through the same selection boundary.
- [ ] Unknown or incomplete platform configuration fails before a Review Window or cursor state is written.
- [ ] Review Submissions use the selected platform's attribution without a binary OpenClaw/Codex fallback.
- [ ] Existing OpenClaw, Codex, privacy, publication, and static-site behavior remains green.

## Prototype

**Question:** Can historical and prospective Agent Platforms share one fail-closed review lifecycle without committing cursors on incomplete or failed work?

**Verdict:** Yes. Platform-specific differences fit as explicit capability and coverage prerequisites before collection. Unknown platforms and incomplete prospective coverage enter a blocked state. Candidate cursors remain pending through Review Draft generation and failed publication; they commit only after a successful proposal update or explicit no-update. Review Identity remains stable across a publication retry.

**Primary source:** Local throwaway branch `codex/prototype-platform-routing`, commit `9b9c6ea`. Run it with `npm run prototype:platform-routing`; append `-- --demo` for the scripted edge-case walkthrough.

### UI follow-up

**Question:** How should five Agent Platforms appear after they are compressed into one Daily Review?

**Options:** A treats platforms as light attribution inside an editorial brief. B keeps source health visible in an operations cockpit. C maps platforms against shared workstreams before presenting the selected outcomes.

**Primary source:** Local throwaway branch `codex/prototype-platform-routing`, commit `1ee6735`. The local prototype route uses clickable `?variant=a`, `?variant=b`, and `?variant=c` views. Awaiting the Agent Operator's preferred direction before folding a visual decision into the product.
