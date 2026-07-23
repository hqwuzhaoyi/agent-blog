# Pi Agent Source adapter research

Status: research-complete

Decision: `adapter-ready`, with an exact SDK compatibility range and read-only snapshot loading.

## Identity evaluated

This document uses **Pi** to mean the local terminal coding agent currently maintained in
[`earendil-works/pi`](https://github.com/earendil-works/pi), distributed as
[`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent),
and documented at [`pi.dev`](https://pi.dev/docs/latest/quickstart). It does not refer to
Inflection's consumer assistant or another product named Pi.

The local read-only verification on 2026-07-21 found:

- binary: `/Users/admin/.volta/bin/pi`
- `pi --version`: `0.80.3`
- installed package: `@earendil-works/pi-coding-agent@0.80.3`
- package repository: `https://github.com/earendil-works/pi.git`
- current official repository package version at research time: `0.80.10`

Therefore this machine is not using the historical package name
`@mariozechner/pi-coding-agent`, even though older source links and examples may still use
that name. Setup and compatibility checks must inspect the installed package identity, not
infer it from the executable name alone.

No local session body, credential, or auth file was read during this verification.

## Findings

### 1. Session location and format

Pi documents sessions as versioned JSONL files under
`~/.pi/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl`. The header contains a session
UUID, creation timestamp, and working directory. Every following entry has a stable `id`,
`parentId`, ISO timestamp, and type; the parent links form a tree so one file can retain
multiple branches. The current documented format is version 3, and older versions are
automatically migrated when loaded. See the official
[Session File Format](https://pi.dev/docs/latest/session-format) and the official
[`SessionManager` source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts).

Storage can be moved through `PI_CODING_AGENT_DIR`,
`PI_CODING_AGENT_SESSION_DIR`, `--session-dir`, or Pi settings. A collector must accept an
explicit `piSessionDir` and use the same directory resolution as the local Pi installation;
scanning only `~/.pi/agent/sessions` would silently miss custom stores. The environment and
CLI options are documented in [Using Pi](https://pi.dev/docs/latest/usage).

### 2. Supported list and read interfaces

The production integration should use the published Pi SDK, not implement its own JSONL
parser. The official SDK exports `SessionManager` with:

- `SessionManager.list(cwd, sessionDir?)` for one working directory;
- `SessionManager.listAll(sessionDir?)` for all local Conversation Sources;
- `SessionManager.open(path)` for a persisted session;
- `getEntries()`, tree/path traversal, header, leaf, and session metadata access.

These APIs and examples are documented in the official
[SessionManager reference](https://pi.dev/docs/latest/session-format#sessionmanager-api) and
[SDK guide](https://pi.dev/docs/latest/sdk#session-management). `SessionInfo` supplies the
session UUID, path, cwd, created/modified dates, name, and message metadata, so candidates
can be bounded by Review Day before loading full entries.

Pi also exposes an RPC mode with `get_state`, `get_messages`, `get_entries`, `get_tree`, and
`switch_session`; `get_entries` supports an entry-ID cursor. See the official
[RPC Mode reference](https://pi.dev/docs/latest/rpc). RPC still has no global session-listing
command and is not the preferred collector boundary because it starts a Pi runtime for each
known session, loads more runtime state, and can trigger session migration. The SDK provides
both global discovery and the stable entry IDs needed for incremental cursors.

There is no dedicated headless CLI command that lists every session and emits their entries.
`pi -r` and `/resume` are interactive selectors, while `--session` chooses one session and
`--export` writes an export. Those commands are useful to operators but are not a reliable
collection protocol.

#### Read-only caveat

`SessionManager.open()` is a supported API, but its implementation rewrites a legacy
session when automatic migration is required. A supposedly read-only review must not open
the operator's source file directly. The adapter should:

1. list candidates with `SessionManager.listAll()`;
2. copy each candidate to a mode-`0600` temporary directory;
3. verify the source file did not change during the copy, retrying or deferring an active
   file if necessary;
4. call `SessionManager.open()` on the private snapshot;
5. remove the snapshot after normalization.

This still delegates parsing and migration to the supported SDK while guaranteeing that
the authoritative Pi session is not rewritten by Agent Blog.

### 3. Visible Message normalization

Pi's public schema separates message roles and content-block types. A user message contains
text or text/image blocks. An assistant message contains `text`, `thinking`, and `toolCall`
blocks. Tool results use role `toolResult`; Pi also defines `bashExecution`, `custom`,
`branchSummary`, and `compactionSummary` message roles. See the official
[message schema](https://pi.dev/docs/latest/session-format#message-types),
[`pi-ai` types](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts), and
[`pi-coding-agent` message types](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts).

The minimum normalization rule is deliberately allowlist-only:

1. retain only entries whose top-level type is `message`;
2. retain only embedded roles `user` and `assistant`;
3. for a user message, retain a string or blocks with `type: "text"` only;
4. for an assistant message, retain blocks with `type: "text"` only;
5. reject images, `thinking`, `toolCall`, `toolResult`, `bashExecution`, custom entries and
   messages, compaction summaries, branch summaries, labels, model changes, and extension
   state.

This rule keeps human and primary-agent text while excluding reasoning, tools, command
output, generated summaries, and extension traffic before the private Review Window is
written. It must not use `buildSessionContext()`, because that method intentionally adds
compaction, branch-summary, and custom context that is not a Visible Message.

The proposed first adapter should consider explicit user/assistant `message` entries from
the full session tree. Branch messages are preserved, individually visible through Pi's
tree UI, and have unique entry IDs; generated branch summaries remain excluded. If product
policy later chooses only the active branch, Pi exposes path traversal, but that would be a
separate domain decision and must be tested against branch switching.

Pi itself intentionally ships without built-in subagents. Its official example subagent
extension launches child Pi processes with `--no-session`, so those example children do not
appear in the session store; see the official
[subagent extension source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/subagent/index.ts).
Third-party extensions can behave differently, and Pi has no universal session field that
proves a persisted session came from an intermediate agent. This is the main residual
privacy limitation: installations with custom persistent subagents need an explicit
exclusion rule or cannot claim generic intermediate-agent filtering.

### 4. Review Day, ordering, and cursors

Use the session header UUID as `sessionKey`; never expose or persist the source filesystem
path as public metadata. Normalize each accepted entry to:

```text
{
  id: entry.id,
  sessionKey: header.id,
  role: "user" | "assistant",
  timestamp: Date.parse(entry.timestamp),
  text
}
```

The entry-level ISO timestamp is present for every session entry and is a safer ordering
source than optional/provider-shaped message metadata. Filter it to the configured local
Review Day, then order by timestamp and entry ID. Store one cursor per session UUID as
`{ timestamp, messageId }`, using the same timestamp/ID comparison already used by the
Codex adapter. Session file names, cwd values, and names must stay private.

`SessionManager.listAll()` returns sessions ordered by activity in current releases, but
the adapter should sort normalized messages itself and must not depend on listing order.

### 5. Manual and scheduled triggers

Collection itself needs no model and should run as the existing local
`npm run review:manual` / scheduled collector path with `platform: "pi"`.

For review generation, Pi supports non-interactive `-p`, JSON/RPC modes, explicit skills,
and `--no-session`; see the official [Quickstart](https://pi.dev/docs/latest/quickstart) and
[Using Pi](https://pi.dev/docs/latest/usage). The minimum safe worker is a repo-scoped Pi
Review Skill invoked by a non-interactive `pi -p --no-session` process. It reuses Pi's
configured provider/model credentials but does not create a synthetic session that would
be collected on the next run. Project extensions should be disabled for the unattended
worker unless explicitly required.

Pi does not document a built-in wall-clock scheduler. Use a local OS scheduler such as
`launchd`, cron, or a user timer to run the repository command at `00:15` in the configured
time zone. The scheduled command must use the main checkout so ignored `.agent-blog/`
cursor state persists.

For manual use inside an active Pi session, a small optional Pi extension can register an
`/agent-blog-review` command and pass `ctx.sessionManager.getSessionId()` as an exclusion to
the collector. Pi officially supports extension commands and session-manager access; see
the [Extensions reference](https://pi.dev/docs/latest/extensions). A terminal invocation
outside Pi needs no self-session exclusion.

### 6. Installation and version detection

The current official installation command is:

```text
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

The command and Node requirement are owned by Pi's
[Quickstart](https://pi.dev/docs/latest/quickstart) and
[`package.json`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/package.json).
An Agent Blog installer should verify all of the following:

- `pi --version` succeeds;
- the resolved installation's package name is
  `@earendil-works/pi-coding-agent` (with an explicit migration message for the historical
  `@mariozechner` name);
- Agent Blog can import `SessionManager` and the package `VERSION` from its pinned SDK
  dependency;
- CLI and SDK versions are inside an explicitly tested compatibility matrix;
- the configured/default session directory is readable;
- Git/GitHub publication access is valid, without reading or printing Pi credentials.

The collector itself does not need Pi provider authentication. The non-interactive review
worker reuses `/login`, environment keys, or Pi's existing local auth configuration. Agent
Blog must not copy those values into its config.

### 7. Privacy, security, and compatibility risks

- **Raw local sensitivity:** session files can contain prompts, thinking, tool arguments,
  command output, filesystem paths, images, and secrets. Only normalized Visible Messages
  may enter the mode-`0600` private Review Window; the existing local privacy filter must
  run before Git.
- **Migration writes:** direct `SessionManager.open()` can rewrite legacy source files.
  Snapshot before open and assert the source digest/mtime is unchanged.
- **Concurrent append:** Pi may be writing while the collector snapshots a session. Detect
  source changes across the copy and retry or defer; cursor advancement makes the next run
  safe.
- **SDK drift:** local `0.80.3` exposes `getBranch()`, while an online SDK example observed
  during this research uses `getPath()`. This documentation/API naming mismatch requires an
  exact tested package range, fixture-based contract tests, and feature detection instead of
  importing latest blindly.
- **Format evolution:** unknown future entry/content types must be rejected by default.
  Do not treat unknown blocks as text.
- **Custom stores:** `PI_CODING_AGENT_SESSION_DIR`, settings, and `--session-dir` can put
  sessions outside the default tree. Require explicit configuration when discovery is
  ambiguous.
- **Intermediate agents:** third-party extensions can persist child sessions without a
  standard provenance marker. Document supported extensions or require exclusion rules.
- **Runtime permissions:** Pi and extensions run with the invoking user's permissions and
  Pi has no built-in sandbox. The scheduled generation worker should load only the Review
  Skill/resources it needs and receive only repository-scoped Git authority. See Pi's
  official [Security guide](https://pi.dev/docs/latest/security).
- **No sharing path:** never invoke `/share` or upload session exports. Raw source and
  snapshots remain local and temporary.

## Minimal adapter boundary

Proposed module: `scripts/lib/pi-session-manager.mjs`.

```text
collectPiWindow({
  sourceId,
  reviewDay,
  timeZone,
  state,
  sessionDir?,
  excludeSessionIds?,
  sdk?,
  snapshotter?
}) -> {
  sourceId,
  reviewDay,
  timeZone,
  messages,
  candidateCursors
}
```

Keep two seams:

- `collectPiWindow` calls the official SDK, bounds candidates, snapshots sessions, and
  supplies normalized session entries.
- `buildPiReviewWindow` is pure and applies the role/block allowlist, Review Day, exclusion,
  ordering, and cursor rules.

Configuration additions should be limited to `platform: "pi"`, `piBinary`, optional
`piSessionDir`, and optional documented session exclusions. The existing Review Submission,
privacy validation, Git publisher, cursor commit rules, and human merge gate remain
unchanged.

## Test strategy

1. **Normalization fixture:** a v3 session tree containing user string/text/image content,
   assistant text/thinking/tool calls, tool results, bash messages, custom messages,
   compaction/branch summaries, labels, and multiple branches; assert only user/assistant
   text survives.
2. **Cursor contract:** equal timestamps with different entry IDs, per-session isolation,
   same-day retry, no-update advancement, and failed-publication retention.
3. **Time-zone boundary:** entries on both sides of midnight for `Asia/Taipei` and UTC.
4. **Tree behavior:** assert explicit messages on both branches are retained once and
   generated summaries are excluded.
5. **Snapshot safety:** open a legacy v1/v2 fixture through a temporary snapshot, verify the
   snapshot migrates if required, and assert the source bytes, mode, and mtime are unchanged.
6. **Concurrent-write safety:** mutate a fixture between pre/post-copy stats and assert the
   collector retries or defers instead of advancing a cursor.
7. **SDK contract smoke test:** use a temporary session directory with the pinned official
   package to exercise `listAll`, `open`, `getEntries`, header ID, and entry IDs without
   touching real user sessions.
8. **Compatibility test:** run against every declared CLI/SDK version pair; fail setup with
   an actionable message outside the matrix.
9. **Self-review exclusion:** verify excluded session IDs and the `--no-session` generation
   worker cannot enter the Review Window.
10. **Regression:** existing OpenClaw, Codex, privacy, idempotency, and publication tests
    continue to pass.

## Recommendation

Pi passes the `adapter-ready` gate because its official, published SDK can enumerate local
sessions and expose versioned entries with stable session and message IDs. Implement it
after fixing a tested SDK version range and the snapshot-before-open rule. Do not ship the
adapter as generic for arbitrary persistent subagent extensions until their sessions can be
identified or explicitly excluded.
