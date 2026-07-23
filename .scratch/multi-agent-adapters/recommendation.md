# Agent Platform adapter recommendation

Status: research-complete

Research date: 2026-07-21

## Outcome

Implement the new Agent Platforms in this order:

1. Hermes
2. Pi
3. Claude Code prospective capture

Hermes and Pi are `adapter-ready` through upstream-supported read interfaces. Claude Code is `extension-ready`: its supported historical API lacks the per-message time and provenance required to prove an exact Review Day, so strict coverage begins only after the local capture hooks are installed.

No platform should be integrated by directly parsing an undocumented transcript store.

## Evidence snapshot

| Platform | Local version verified | Decision | Supported production boundary | Main limitation |
| --- | --- | --- | --- | --- |
| Hermes | `0.11.0` | `adapter-ready` | `hermes sessions export -` | Full export contains sensitive internal fields and has no date filter; compaction behavior varies across releases |
| Pi | `@earendil-works/pi-coding-agent@0.80.3` | `adapter-ready` | Published `SessionManager` SDK | Opening legacy sessions may migrate them, so collection must use private snapshots and a pinned compatibility range |
| Claude Code | `2.1.208` | `extension-ready` | `UserPromptSubmit` and `MessageDisplay` hooks, with Agent SDK inventory | Historical `SessionMessage` has no documented message timestamp or complete synthetic provenance |

Detailed claims and primary-source links are in [Hermes](./hermes.md), [Pi](./pi-agent.md), and [Claude Code](./claude-code.md).

## Why this order

### 1. Hermes

Hermes has the smallest dependency and installation surface. Its documented CLI can export all persisted sessions to stdout, letting Agent Blog normalize in memory and reuse the current Review Window contract. It also has a native cron path and a local skill execution model.

The implementation must explicitly version-gate exporter behavior. The local `0.11.0` release is sufficient for the researched contract, while newer upstream code changes compaction and active-message behavior. A capability probe and synthetic compaction fixture are required before claiming a supported version range.

### 2. Pi

Pi exposes the strongest typed session model: stable session IDs, stable entry IDs, timestamps, explicit branches, and distinct text, thinking, tool, command, image, and summary types. The official SDK can enumerate all sessions and load entries without Agent Blog owning the JSONL parser.

It comes second because the SDK can migrate older session files on open. The collector must snapshot candidate files with restrictive permissions, load only the snapshots, and prove that source bytes and metadata are unchanged. The CLI and SDK versions also need an exact tested matrix.

This recommendation treats Pi as the installed `earendil-works/pi` coding agent, not Inflection's consumer assistant or the deprecated package scope.

### 3. Claude Code

Claude Code has an official SDK for session inventory and message reading, but the public historical message contract cannot reconstruct an exact Review Day. Its hooks provide a better semantic boundary than transcript parsing: `UserPromptSubmit` captures direct user prompts and `MessageDisplay` captures assistant text actually shown to the operator.

The tradeoff is prospective-only coverage. Installation starts a normalized private event journal; pre-install history is not backfilled. This is acceptable for new daily reviews but must be explicit in setup and tests. A Desktop local scheduled task or OS scheduler provides the clock; hooks only capture events.

## Shared implementation boundary

All adapters must return the existing private contract:

```text
{
  sourceId,
  reviewDay,
  timeZone,
  messages: [{ id, sessionKey, role, timestamp, text }],
  candidateCursors
}
```

Before adding platform collectors, replace the current implicit OpenClaw fallback with an explicit platform registry. Each supported platform ID must resolve to a collector, installer documentation, platform label, and default source label. Unknown IDs must fail closed. This prevents Hermes, Pi, or Claude Code content from being mislabeled as OpenClaw.

The rest of the workflow remains shared:

- Review Day filtering and per-session cursors
- private mode-`0600` Review Window and Review Draft
- local Work Highlight generation and privacy screening
- idempotent Review Identity
- Git branch and pull-request proposal
- human merge gate

## Implementation sequence

1. Add the explicit platform registry and contract tests without changing OpenClaw or Codex behavior.
2. Implement Hermes CLI collection, installer, Review Skill, setup documentation, and compaction/version contract tests.
3. Implement Pi SDK snapshot collection, installer, Review Skill, setup documentation, and CLI/SDK compatibility tests.
4. Implement Claude Code hook journal, SDK reconciliation, installer, project Review Skill, and prospective-coverage documentation.
5. Run the full existing test and Astro build suite after each adapter; add an isolated synthetic smoke test for each installed local CLI without reading real sessions.

## Explicit non-goals

- No historical Claude Code backfill until the SDK exposes documented per-message timestamps and sufficient provenance.
- No direct SQLite or legacy JSONL reads for Hermes.
- No hand-written Pi session parser when the supported SDK can load the format.
- No raw session, hook input, local path, session identifier, reasoning, tool data, or credentials in Git.
- No automatic merge or publication.
