# Claude Code Agent Source research

Status: complete

Decision: `extension-ready`

Research date: 2026-07-21

Evaluated local installation: Claude Code `2.1.208` at `/Users/admin/.local/bin/claude`

## Executive conclusion

Claude Code now has an upstream-supported historical read interface. The TypeScript Claude Agent SDK exports `listSessions()` for enumerating sessions and `getSessionMessages()` for reading their user and assistant messages. Agent Blog therefore does not need to discover or parse private JSONL files directly.

However, the documented `SessionMessage` returned by `getSessionMessages()` exposes `type`, `uuid`, `session_id`, `message`, and `parent_tool_use_id`, but no per-message timestamp. Its raw `message` payload is typed as `unknown`, and the helper does not document a flag that distinguishes every synthetic user-role entry from direct human input. Those omissions prevent a historical-only collector from proving that each retained item belongs to an exact Review Day and is a Visible Message.

Claude Code also exposes two supported hooks that close this gap prospectively:

- `UserPromptSubmit` receives the direct prompt, `session_id`, and current working directory before model processing.
- `MessageDisplay` receives only assistant text shown to the operator, with a stable per-message ID, ordered batches, and a final marker. It does not receive tool results, and in non-interactive runs it emits one complete event per assistant message.

The minimum safe design is therefore a small Claude Code extension that records normalized Visible Messages with local receipt timestamps from those hooks, plus the Agent SDK for session discovery and controlled reconciliation. This earns `extension-ready`, not `adapter-ready`: supported historical reading exists, but exact historical Review Day reconstruction is not fully supported by the public message contract.

## Evidence summary

| Requirement | Supported surface | Finding |
| --- | --- | --- |
| Enumerate sessions | Agent SDK `listSessions()` | Supported across one directory or all local projects |
| Read persisted messages | Agent SDK `getSessionMessages()` | Supported; returns user and assistant messages with pagination |
| Exact historical message time | Agent SDK public `SessionMessage` | Not documented |
| Exclude tools/thinking | Content-block filtering | Keep only `text`; reject tool, thinking, image, document, and result blocks |
| Capture direct user text | `UserPromptSubmit` hook | Supported prospectively |
| Capture displayed assistant text | `MessageDisplay` hook | Supported prospectively; added in Claude Code 2.1.166 |
| Exclude the review task itself | Skill `${CLAUDE_SESSION_ID}` / Bash `CLAUDE_CODE_SESSION_ID` | Supported; pass the current session ID to collection |
| Manual review trigger | Project skill and CLI print mode | Supported |
| Durable local schedule | Claude Code Desktop local scheduled task | Supported; requires app open and machine awake |
| CLI in-session schedule | `/loop` and cron tools | Unsuitable for a durable daily review because it is session-scoped and expires after seven days |

Primary references:

- [TypeScript Agent SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Work with Agent SDK sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Manage Claude Code sessions](https://code.claude.com/docs/en/sessions)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Claude Agent SDK TypeScript changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)

## 1. Local session storage

Claude Code continuously stores local sessions as plaintext JSONL under:

```text
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

`<encoded-cwd>` is derived from the absolute working directory. The official session guide describes each line as a JSON object representing a message, tool use, or metadata entry. The application-data guide is more explicit: the transcript contains every message, tool call, and tool result. Large tool outputs can spill into a sibling `tool-results/` directory, and file checkpoints live under `~/.claude/file-history/`.

The default local retention period is 30 days and is controlled by `cleanupPeriodDays`. `CLAUDE_CONFIG_DIR` relocates the whole Claude configuration and data root. `CLAUDE_CODE_SKIP_PROMPT_HISTORY` disables transcript writes; `--no-session-persistence` and Agent SDK `persistSession: false` disable persistence for non-interactive sessions.

These locations are documented but remain storage details, not the proposed production adapter interface. Direct JSONL parsing would couple Agent Blog to entries whose complete schema and compatibility guarantees are not published, contradicting the parent specification's supported-interface requirement.

Sources:

- [Manage sessions: export and locate session data](https://code.claude.com/docs/en/sessions#export-and-locate-session-data)
- [How Claude Code works: local session persistence](https://code.claude.com/docs/en/how-claude-code-works#work-with-sessions)
- [Application data and plaintext storage](https://code.claude.com/docs/en/claude-directory#application-data)

## 2. Supported session enumeration and reading

### Agent SDK

For this Node repository, `@anthropic-ai/claude-agent-sdk` is the appropriate upstream interface:

```js
import {
  listSessions,
  getSessionMessages,
} from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions();
const messages = await getSessionMessages(sessionId, { limit, offset });
```

`listSessions()` supports:

- `dir` to scope discovery to a project;
- omission of `dir` to enumerate sessions across all projects;
- `limit` and, in current releases, pagination offset;
- `includeWorktrees`, enabled by default for repository worktrees.

It returns light metadata including `sessionId`, `summary`, `lastModified`, `fileSize`, `cwd`, `gitBranch`, and `createdAt`. Results are sorted by `lastModified` descending.

`getSessionMessages()` reads persisted user and assistant messages and supports `dir`, `limit`, and `offset`. Each documented `SessionMessage` contains:

```text
type: "user" | "assistant"
uuid: string
session_id: string
message: unknown
parent_tool_use_id: string | null
```

The TypeScript SDK added `listSessions()` in 0.2.53 and `getSessionMessages()` in 0.2.59. Its current package bundles a platform-specific native Claude Code binary, although these history helpers are read-only and do not need a model call.

### CLI

The CLI supports `--continue`, `--resume`, an interactive resume picker, `/export`, and resuming by session ID. These commands are designed to continue or export one chosen conversation, not to provide a machine-readable all-session history API. Resuming with a prompt mutates the session and can incur a model call, so it must not be used as the collector.

The local `2.1.208` binary exposes `--continue`, `--resume`, `--session-id`, `--print`, JSON/stream-JSON output, and `--no-session-persistence`, matching the official CLI reference.

Sources:

- [TypeScript SDK: `listSessions()` and `getSessionMessages()`](https://code.claude.com/docs/en/agent-sdk/typescript#listsessions)
- [SDK session enumeration and transcript viewers](https://code.claude.com/docs/en/agent-sdk/sessions#resume-across-hosts)
- [CLI reference](https://code.claude.com/docs/en/cli-usage)
- [SDK TypeScript changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)

## 3. Visible Message normalization

### Historical SDK messages

Apply a fail-closed normalizer to each `SessionMessage`:

1. Accept only outer `type` values `user` and `assistant`.
2. Reject `parent_tool_use_id !== null` to exclude identified subagent messages.
3. Validate `message` as an object before reading it.
4. For both roles, retain only string content or content blocks whose `type` is exactly `text` and whose `text` is a non-empty string.
5. Reject all other content blocks, including `thinking`, `redacted_thinking`, `tool_use`, server-tool blocks, `tool_result`, images, documents, and search results.
6. Never persist raw `message`, session summary, first prompt, tool content, `cwd`, or transcript paths into the Review Window.

Claude's Messages API embeds tool calls in assistant messages and tool results in user messages. Role alone is therefore insufficient; block-level filtering is mandatory. Thinking blocks are also distinct from text blocks and must be omitted.

Two documented gaps remain:

- `SessionMessage` has no public timestamp, so an exact historical Review Day cannot be derived from the supported type.
- The history helper's public return type does not expose all live `SDKUserMessage` provenance fields such as `isSynthetic` and `origin`. Text inside a synthetic user-role entry cannot always be proven human solely from the documented historical helper.

### Prospective hooks

Use hooks as the authoritative Visible Message feed after installation:

- `UserPromptSubmit`: record `prompt` as role `user`, keyed by `session_id`, with the local hook receipt time.
- `MessageDisplay`: append `delta` batches by `session_id` and `message_id`; finalize only when `final` is true, then record the assembled text as role `assistant` with the local receipt time.
- Ignore hook events from known subagent contexts; at minimum, fail closed when subagent metadata is present.
- Deduplicate hook retries by `(session_id, role, message_id)` for assistant messages and a locally assigned monotonic event ID for user prompts.

`MessageDisplay` receives assistant display text only; tool-call-only responses do not trigger it. It is display-only and cannot change the stored transcript or the model's context. This maps unusually well to the repository's definition of Visible Message.

Sources:

- [Hooks: `UserPromptSubmit`](https://code.claude.com/docs/en/hooks#userpromptsubmit)
- [Hooks: `MessageDisplay`](https://code.claude.com/docs/en/hooks#messagedisplay)
- [Anthropic tool-use message structure](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)
- [Extended thinking blocks](https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking)

## 4. Manual and scheduled triggers

### Manual

Install a project skill at `.claude/skills/claude-code-review/SKILL.md`. Claude Code discovers project skills and lets the operator invoke them directly with `/claude-code-review`. The skill should:

1. pass `${CLAUDE_SESSION_ID}` to the collector so the review session excludes itself;
2. run `npm run review:manual -- --day YYYY-MM-DD`;
3. read only `.agent-blog/review-window.json`;
4. produce a Publication-Safe draft;
5. submit or record no-update using the existing platform-independent workflow.

For shell processes launched by Claude Code 2.1.132 or later, `CLAUDE_CODE_SESSION_ID` is also present and matches the hook `session_id`.

CLI print mode can launch the same project skill non-interactively. The SDK also supports dispatching non-interactive slash commands. Restrict tools and permissions to the commands and Publication Repository paths the workflow actually needs.

Sources:

- [Claude Code skills and `${CLAUDE_SESSION_ID}`](https://code.claude.com/docs/en/slash-commands#available-string-substitutions)
- [Slash commands through the Agent SDK](https://code.claude.com/docs/en/agent-sdk/slash-commands)
- [CLI non-interactive mode](https://code.claude.com/docs/en/cli-usage)

### Scheduled

Preferred: a Claude Code Desktop **local scheduled task** running at 00:15 in the configured time zone, pointed at the main checkout with worktree isolation disabled. Desktop local tasks start a fresh session, run with local file access, and persist across app restarts. Keeping the main checkout is necessary because ignored state under `.agent-blog/` must survive runs.

Operational constraints:

- Desktop must remain open and the machine awake.
- Missed runs while the machine sleeps are skipped.
- Permission prompts can stall a run; validate the task once and save only narrow allow rules.
- Each scheduled review session must pass its own session ID to collection to prevent self-review.

An OS scheduler invoking `claude -p` is a viable headless alternative, but scheduling belongs to launchd/cron/systemd rather than Claude Code CLI itself.

Do not use `/loop` for the daily review. It requires an open session, has no catch-up for closed periods, and recurring tasks expire after seven days. Do not use cloud Routines: they run on Anthropic infrastructure with a fresh clone and cannot read local Claude Code transcripts.

Sources:

- [Desktop local scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- [Session-scoped scheduled tasks and limitations](https://code.claude.com/docs/en/scheduled-tasks)
- [Cloud Routines](https://code.claude.com/docs/en/routines)

### Hooks are not the scheduler

Hooks should only maintain the local normalized event journal and correlate the review session ID. Running the full daily review from `Stop` or `SessionEnd` would add latency to ordinary sessions, create concurrent reviews, and conflict with hook timeout behavior. The hooks are event capture; Desktop or the OS scheduler is the clock.

## 5. Installation and version detection

Setup should perform read-only checks before writing configuration:

1. Resolve the configured binary or `claude` on `PATH`.
2. Run `claude --version` and parse a semantic version.
3. Require Claude Code `>= 2.1.166`, the release that introduced `MessageDisplay`.
4. Run `claude auth status` with output discarded; the official CLI returns 0 when authenticated and 1 otherwise.
5. Import `listSessions` and `getSessionMessages` from the installed SDK and run a metadata-only probe without printing session summaries, paths, prompts, or IDs.
6. Verify the repository is the intended Publication Repository and `.agent-blog/` is ignored before installing project hooks or a skill.

Use the official native installer or Homebrew/WinGet/package-manager installation. Native builds auto-update unless disabled; package-manager builds require their manager's update command. For the adapter, pin the Claude Agent SDK to an exact version verified by tests rather than an open semver range, then upgrade deliberately.

Local verification on 2026-07-21 found Claude Code `2.1.208`, which satisfies the hook minimum.

Sources:

- [Claude Code installation and updates](https://code.claude.com/docs/en/installation)
- [CLI authentication status](https://code.claude.com/docs/en/cli-usage)
- [MessageDisplay introduction in 2.1.166](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

## 6. Privacy, security, and compatibility risks

### Privacy and security

- Local transcripts are plaintext and can contain source code, file contents, command output, credentials, and tool results. OS permissions are their only at-rest protection.
- The SDK history API returns raw message payloads. Filtering must happen in memory before `.agent-blog/review-window.json` is written with mode 0600.
- Raw transcripts, session IDs, `cwd`, summaries, first prompts, hook journal paths, and hook inputs must never enter Git or public Markdown.
- Hook journals must live outside tracked content, use restrictive permissions, and contain only normalized user/assistant display text plus opaque IDs and timestamps.
- The Claude review session sends the normalized Review Window to the operator's configured model provider. This reuses Claude Code authentication but is still a model inference data flow; it is not an offline summarizer.
- Concurrent or interrupted sessions can append while collection runs. Snapshot candidate metadata first, fail closed on malformed or partial data, and advance cursors only after a successful submission or explicit no-update.
- The scheduled task should receive repository-scoped GitHub authority only, matching ADR 0017.

Anthropic documents 30-day default local retention and different server-side retention policies by account type. Consumer training preferences and commercial/ZDR policy are account concerns outside Agent Blog, but setup documentation must point operators to them.

Sources:

- [Application data and plaintext risk](https://code.claude.com/docs/en/claude-directory#plaintext-storage)
- [Claude Code data usage and retention](https://code.claude.com/docs/en/data-usage)

### Compatibility

- `SessionMessage.message` is deliberately `unknown`; the normalizer must reject unknown shapes rather than guess.
- The SDK helper's documented lack of a message timestamp is a product-level limitation, not a parser omission to work around with private fields.
- Session compaction can change the effective message chain returned by session helpers. A cursor based only on numeric offset is unsafe; store message UUIDs and detect when a prior cursor is no longer present.
- Older sessions may not reliably identify subagent messages through `parent_tool_use_id`; conservative exclusion is required.
- Resuming one session in two terminals can interleave writes. Collection must order hook events by the adapter's monotonic receipt sequence, not assume file append order is one conversation turn.
- `cleanupPeriodDays`, `CLAUDE_CONFIG_DIR`, or disabled transcript persistence can remove or relocate history. The hook journal becomes the authoritative prospective source and must have an explicit, documented retention policy.
- Auto-updating CLI and separately versioned SDK can drift. Pin the SDK, record the detected CLI version in private config, and run a contract probe after upgrades.

## 7. Minimal adapter and tests

### Proposed boundary

Add only the Claude-specific pieces required by the existing review contract:

```text
.claude/skills/claude-code-review/SKILL.md
.claude/hooks/agent-blog-visible-message.mjs
scripts/install-claude-code.mjs
scripts/lib/claude-code-sessions.mjs
test/claude-code-collector.test.mjs
```

Private state remains under `.agent-blog/`:

```text
config.json
state.json
claude-visible-events.jsonl
review-window.json
review-draft.json
```

`scripts/lib/claude-code-sessions.mjs` should expose two pure seams and one I/O seam:

```js
normalizeClaudeHookEvent(input, receivedAt)
buildClaudeCodeReviewWindow({ events, sourceId, reviewDay, timeZone, state, excludeSessionId })
collectClaudeCodeWindow({ sourceId, reviewDay, timeZone, state, excludeSessionId, sdk })
```

The collector should:

1. read the normalized hook journal for the Review Day;
2. use `listSessions()` only for supported session inventory and reconciliation;
3. use `getSessionMessages()` to detect missed or corrupted hook coverage, not to assign undocumented timestamps;
4. exclude the current review session ID;
5. emit the existing `{ sourceId, reviewDay, timeZone, messages, candidateCursors }` shape;
6. leave cursor advancement, generation, publication, and no-update handling unchanged.

`review.mjs` should route `platform === "claude-code"` to this collector. `review-core.mjs` should replace its current binary Codex/OpenClaw platform label conditional with an explicit label map; this is the only shared-code adjustment implied by the adapter.

### Test strategy

Use fixtures and injected SDK functions; never read a developer's real `~/.claude` in automated tests.

Unit tests:

- `UserPromptSubmit` becomes one user Visible Message with an adapter receipt timestamp.
- Multi-batch `MessageDisplay` events assemble in index order and finalize once.
- Tool-only, thinking, image, document, tool-result, malformed, and empty content produce no Visible Message.
- Duplicate hook deliveries are idempotent.
- Subagent-marked events and `parent_tool_use_id !== null` messages are excluded.
- The scheduled review's own session ID is excluded.
- Time-zone boundaries place events into the correct Review Day.
- Saved per-session cursors exclude previously processed events and ties break on stable event ID.
- Missing or malformed cursor history fails closed instead of replaying an entire session.

SDK contract tests with injected fakes:

- paginate `listSessions()` across all projects without copying summaries, prompts, or paths into the Review Window;
- paginate `getSessionMessages()` and normalize only text blocks;
- assert that missing documented timestamps never silently fall back to filesystem mtime or `lastModified` as a message timestamp;
- verify active/compacted-session reconciliation reports coverage uncertainty without advancing a cursor.

Installer tests:

- reject absent, unauthenticated, or pre-2.1.166 Claude Code;
- accept an alternate binary path;
- preserve existing user/project settings and hooks;
- ensure hook and private state permissions are restrictive;
- dry-run reports planned changes without modifying Claude configuration.

Integration test:

- feed synthetic hook events through collection, Review Draft validation, no-update/submission, and Markdown rendering;
- assert no raw hook input, transcript path, session ID, tool content, or local path appears in rendered Markdown.

## Recommendation and implementation gate

Recommendation: implement only after accepting `extension-ready` semantics.

The implementation must state clearly that:

- supported Agent SDK history is available and used for inventory/reconciliation;
- exact, safely classified Review Windows begin when the hooks are installed;
- pre-install historical sessions are not backfilled into Daily Reviews unless Anthropic adds documented per-message timestamp and provenance fields;
- direct transcript JSONL parsing is not an allowed fallback.

If historical backfill on an exact Review Day is mandatory, keep Claude Code blocked until the Agent SDK publishes those fields. If prospective daily coverage is acceptable, this adapter can proceed with the hook-plus-SDK design above.
