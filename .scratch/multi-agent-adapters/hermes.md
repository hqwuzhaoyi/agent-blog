# Hermes Agent Source adapter research

Status: research complete

Decision gate: `adapter-ready`

Research date: 2026-07-21

## Conclusion

Hermes Agent can support an Agent Blog adapter without parsing private transcript files. The evaluated release exposes two documented read surfaces that are sufficient for collection:

- `hermes sessions export -` writes complete sessions as JSONL to stdout.
- The local Dashboard REST API exposes paginated session metadata and full messages.

The recommended first implementation is the CLI exporter. It is a documented, local, read-only command, requires no long-running HTTP server, and reuses the operator's existing Hermes installation and authentication. The adapter must stream and normalize the export immediately because it includes system prompts, tool arguments/results, reasoning fields, model configuration, and other data that must never enter a Review Window.

Do not use `~/.hermes/state.db`, `~/.hermes/sessions/*.jsonl`, or Hermes's Python `SessionDB` class as the production boundary. They are useful evidence for understanding semantics, but their schema and migration behavior are implementation details.

## Evaluated project and version

The project is [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), not an unrelated product using the Hermes name.

Read-only checks on this machine found:

```text
Binary:  /Users/admin/.local/bin/hermes
Version: Hermes Agent v0.11.0 (2026.4.23)
Project: /Users/admin/.hermes/hermes-agent
Commit:  bd10acd747c12e2a793d2743e04462bf82d481b5
```

The official `main` branch was also checked at [`9403b4f8` (2026-07-20)](https://github.com/NousResearch/hermes-agent/commit/9403b4f8ba983fb2c634ff128786ee9b71428fae), currently reporting v0.18.2. It is materially ahead of the locally installed release, so the recommendation below is for the evaluated v0.11.0 baseline and requires capability/compaction revalidation before claiming support for newer versions.

No real session rows, messages, configuration values, or credentials were read during this research. CLI behavior was checked with `--help`; storage semantics were checked against the clean local checkout of the official repository.

Primary sources:

- [Official installation guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/getting-started/installation.md)
- [Official session guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md)
- [v0.11.0 package version at the evaluated commit](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/pyproject.toml#L1-L10)
- [Official updating and version-check guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/getting-started/updating.md)

## 1. Session storage and source boundaries

### Canonical store

Hermes resolves its data directory from `HERMES_HOME`, falling back to `~/.hermes`. The evaluated release stores session metadata and messages in `state.db`, a WAL-mode SQLite database. Its `sessions` table includes a stable text session ID, source, parent session ID, timestamps, end reason, model metadata, counters, and title. Its `messages` table includes an integer row ID, session ID, role, content, timestamp, tool metadata, and several distinct reasoning fields.

The important fields for Agent Blog are:

| Entity | Fields usable by the adapter |
| --- | --- |
| Session | `id`, `source`, `parent_session_id`, `started_at`, `ended_at`, `end_reason` |
| Message | `id`, `session_id`, `role`, `content`, `timestamp` |

Fields that must be discarded include `system_prompt`, `model_config`, `tool_calls`, `tool_call_id`, `tool_name`, `reasoning`, `reasoning_content`, `reasoning_details`, `codex_reasoning_items`, and `codex_message_items`.

Evidence:

- [Session storage documentation](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/session-storage.md)
- [`HERMES_HOME` resolution](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_constants.py#L11-L19)
- [Evaluated SQLite schema](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_state.py#L32-L94)
- [Message retrieval is ordered by timestamp and row ID](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_state.py#L1254-L1272)

### Gateway routing index and legacy transcripts

`~/.hermes/sessions/sessions.json` is a routing index for active messaging conversations, not the complete session history. At the evaluated commit, gateway code still dual-writes legacy `sessions/<session-id>.jsonl` files and may prefer the longer source while restoring an older session. Current documentation treats SQLite as the structured/canonical session store. This transitional behavior is exactly why Agent Blog must not parse JSONL directly.

Evidence:

- [Session storage locations and migration notes](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md#storage-locations)
- [Evaluated gateway transcript compatibility code](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/gateway/session.py#L1217-L1304)

### Profiles

Hermes profiles have separate home directories and separate sessions, configuration, memories, and skills. A configured `HERMES_HOME` or profile alias is therefore a stronger supported Agent Source boundary than the binary installation itself. The minimum adapter may support one configured Hermes home; multiple profiles should be configured as separate Agent Sources rather than merged implicitly.

Evidence: [official profile commands and profile home layout](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/profile-commands.md).

## 2. Supported read interfaces

### CLI: recommended for the first adapter

The official session CLI supports:

```text
hermes sessions list [--source SOURCE] [--limit LIMIT]
hermes sessions export OUTPUT [--source SOURCE] [--session-id SESSION_ID]
```

`OUTPUT` may be `-`, which writes JSONL to stdout. Each line is one session object containing full metadata and a `messages` array. Exporting without `--session-id` returns all sessions; `--source` can restrict one platform source. `sessions list` is intended for people and emits a table, so it should not be parsed.

Evidence:

- [Official sessions guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md#session-management-commands)
- [CLI parser and export implementation at the evaluated commit](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_cli/main.py#L9450-L9595)
- [Export object construction](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_state.py#L1827-L1845)

The first adapter should execute the binary directly with arguments, never through a shell:

```text
<hermesBinary> sessions export -
```

It should stream JSONL rather than buffering the entire export. Hermes offers no documented `--after`, date, offset, or JSON listing option on this command, so Review Day and cursor filtering remain client-side.

### Dashboard REST API: supported alternative, not the first dependency

`hermes dashboard` starts on `127.0.0.1:9119` by default. Its officially documented automation API provides:

- `GET /api/sessions?limit=&offset=`
- `GET /api/sessions/{session_id}`
- `GET /api/sessions/{session_id}/messages`
- `GET /api/sessions/search?q=`

This is a cleaner paginated read path for a large history, but it requires the optional FastAPI/Uvicorn web dependencies and a running server. The dashboard has no authentication of its own and also exposes endpoints that can read or mutate secrets and configuration. Agent Blog must never ask an operator to bind it beyond loopback.

Evidence:

- [Official Dashboard REST API and security warning](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/web-dashboard.md#rest-api)
- [Evaluated list endpoint implementation](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_cli/web_server.py#L722-L742)
- [Evaluated detail/message endpoints](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_cli/web_server.py#L1919-L1945)

Recommendation: keep this as a later `dashboardBaseUrl` transport if all-session CLI exports become too expensive. Do not silently start or expose the dashboard in v1.

### MCP server: supported but insufficient for Daily Review

`hermes mcp serve` is a documented stdio server. Its `conversations_list` and `messages_read` tools deliberately expose active messaging conversations and already filter to user/assistant text. However, they read the active routing index rather than every persisted CLI, ACP, cron, ended, or historical session. `messages_read` also truncates content to 2,000 characters and limits recent messages. It is suitable for channel bridging, not an all-Hermes Daily Review.

Evidence:

- [Official Hermes MCP server mode and limits](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/mcp.md#running-hermes-as-an-mcp-server)
- [Evaluated `messages_read` filtering and truncation](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/mcp_serve.py#L548-L599)

## 3. Visible Message normalization

### Session selection

The exporter returns raw sessions, including internal child sessions. Normalize them as follows:

1. Exclude `source === "tool"`; Hermes itself hides that source from normal session lists because it is for third-party/internal integrations.
2. Exclude `source === "cron"` in the first Agent Blog adapter. Cron prompts are automated runs rather than direct human/primary-agent conversations, and this also prevents the scheduled review job from reviewing itself. This matches Agent Blog's existing OpenClaw treatment of cron sessions.
3. Include a session with no `parent_session_id`.
4. Include a child when its parent ended with `end_reason === "compression"` before the child started; it is a continuation of the visible conversation.
5. Include a child when its parent ended with `end_reason === "branched"` before the child started; it is an operator-created branch.
6. Exclude other children. Hermes uses a live parent's ID for delegated subagents and background memory/skill review agents, which are intermediate-agent activity rather than Visible Messages.

The distinction is not merely inferred: Hermes's own rich session list hides live-parent children, retains user branches, and projects compression chains to their tips.

Evidence:

- [Official source-tag behavior in CLI help](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_cli/main.py#L9450-L9472)
- [Upstream child/branch/compression list semantics](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_state.py#L928-L1049)
- [Delegated agents receive `parent_session_id`](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/tools/delegate_tool.py#L1035-L1058)

### Message selection

For each accepted session:

1. Accept only `role === "user"` and `role === "assistant"`.
2. Require `content` to be a non-empty string. Fail closed on an unknown content shape; images and attachments are out of scope.
3. Use only `content`. Never concatenate `tool_calls`, `tool_name`, tool results, or any reasoning/Codex provider fields.
4. Strip closed, unterminated, and orphan reasoning tags for the variants Hermes itself recognizes: `think`, `thinking`, `reasoning`, `thought`, and `REASONING_SCRATCHPAD`.
5. Strip leaked tool XML blocks (`tool_call`, `tool_calls`, `tool_result`, `function_call`, `function_calls`, and standalone `function` blocks) using the same boundary rules as Hermes's visible UI.
6. Keep visible assistant prose even when the same row also has `tool_calls`; Hermes may display prose before substantive tools or use content plus housekeeping tools in one assistant turn. Only the structured tool fields are excluded.

Hermes's own resume UI skips system/tool roles, strips reasoning tags from assistant content, and collapses structured tool calls separately. That is the closest upstream definition of content the user actually sees.

Evidence:

- [Official resume recap behavior](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md#conversation-recap-on-resume)
- [Evaluated visible recap filtering](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/cli.py#L3722-L3793)
- [Evaluated reasoning/tool-tag stripping](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/cli.py#L83-L186)
- [Hermes explicitly preserves visible content on turns that also call tools](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/run_agent.py#L12369-L12408)

The normalized Agent Blog message is:

```json
{
  "id": "<Hermes integer message id as a string>",
  "sessionKey": "<Hermes session id>",
  "role": "user | assistant",
  "timestamp": 0,
  "text": "<visible text only>"
}
```

## 4. Review Day and incremental cursors

Hermes timestamps are Unix epoch floats. Within a session, upstream orders messages by `(timestamp, id)`. The adapter should:

- convert seconds to milliseconds;
- filter the configured local Review Day after normalization;
- sort globally by `(timestamp, sessionKey, id)` for deterministic output;
- persist one candidate cursor per Hermes session as `{ timestamp, messageId }`;
- advance cursors only through the existing successful-submission or explicit no-update transaction.

The initial collector still has to export all sessions because the CLI lacks a server-side time filter. Streaming keeps peak memory bounded, but the process remains O(total stored session history) per run.

Current `main` adds `active`/`compacted` message state, and normal CLI export plus Dashboard reads return active rows only. The only explicit `include_inactive` path found is the internal Python `SessionDB` API; there is no documented CLI/REST flag. Therefore a newer-version compatibility test must prove that an unreviewed previous Review Day remains available after compaction. If it does not, fail closed rather than falling back to private Python/SQLite access.

### Rewrite caveat

Hermes `/retry`, `/undo`, and `/compress` flows may replace session messages. At the evaluated commit, `replace_messages()` deletes and reinserts rows with new IDs and current timestamps. A simple high-water cursor can therefore see rewritten older prose as new work. Compression also creates a child session linked by `parent_session_id`.

For v1, document this as a known duplicate risk and add a bounded per-session fingerprint cache for messages already emitted during the cursor retention period. The fingerprint should include role plus normalized text, and it should be used only when an earlier cursor anchor disappeared or a rewrite is detected; using hashes as the primary identity would incorrectly suppress legitimate repeated prompts.

Evidence:

- [Atomic replace semantics and regenerated timestamps](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/hermes_state.py#L1175-L1252)
- [Compression creates a linked child session](https://github.com/NousResearch/hermes-agent/blob/bd10acd747c12e2a793d2743e04462bf82d481b5/run_agent.py#L8490-L8550)

This caveat does not block the adapter, but it must be in the implementation issue and tests.

## 5. Manual and scheduled trigger paths

### Manual

After a Hermes platform branch is added to `scripts/review.mjs`, collection can use the existing entry point:

```bash
node scripts/review.mjs manual --config .agent-blog/config.json
```

A repo-scoped Hermes Review Skill should then generate the private Review Draft and invoke the existing submission workflow. Hermes supports non-interactive, skill-preloaded queries and a `tool` source tag for third-party integration sessions:

```bash
hermes chat --quiet \
  --skills agent-blog-review \
  --source tool \
  -q "Generate and submit today's Agent Blog review from the private Review Window."
```

This reuses Hermes's configured provider/model and credentials. Agent Blog does not need a model API key.

Evidence: [official CLI interface and skill options](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/cli.md).

### Scheduled

Hermes has a documented cron scheduler that runs fresh agent sessions and can preload skills in an absolute project `workdir`. A proposed local schedule is:

```bash
hermes cron create "15 0 * * *" \
  "Generate and submit the previous Review Day for Agent Blog." \
  --name "Agent Blog daily review" \
  --skill agent-blog-review \
  --workdir /absolute/path/to/agent-blog \
  --deliver local
```

The gateway daemon performs scheduler ticks, so setup must also verify `hermes cron status` and install/start the gateway if the operator chooses Hermes cron. `hermes cron run <job-id>` provides an immediate test trigger. The implementation guide must tell the operator to align Hermes's scheduler timezone with `.agent-blog/config.json.timeZone` rather than assuming the host and Review Day timezones match.

Evidence: [official cron scheduling, skill, workdir, and gateway behavior](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md).

An external scheduler remains valid for operators who do not run the Hermes gateway. Agent Blog should not require the dashboard for either trigger path.

## 6. Installation and version detection

Installer behavior should be read-only unless the operator explicitly chooses installation.

Detection order:

1. Resolve `config.hermesBinary` if configured, otherwise `hermes` from `PATH`.
2. Execute `<binary> --version` and parse the first `Hermes Agent vX.Y.Z` line.
3. Require at least v0.11.0 for the researched exporter/schema behavior.
4. Probe `<binary> sessions export --help` and require support for `output`, `--source`, `--session-id`, and stdout via `-`.
5. Record the configured `HERMES_HOME`/profile as the Agent Source boundary without reading `.env` or `config.yaml`.

The official install command for Linux/macOS/WSL is documented as:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

The per-user layout normally places code under `~/.hermes/hermes-agent`, the launcher under `~/.local/bin/hermes`, and data under `~/.hermes`. `hermes doctor` is the upstream diagnostic command; `hermes update` and `hermes --version`/`hermes version` are the upstream update/version checks.

The adapter must not run `hermes update` automatically because it mutates the agent installation and may restart the gateway.

## 7. Privacy, security, and compatibility risks

| Risk | Consequence | Required mitigation |
| --- | --- | --- |
| Full CLI export contains secrets and internals | System prompts, tool args/results, local paths, reasoning, or provider metadata could leak | Stream stdout; normalize immediately; never log raw lines; write only the private Review Window with mode `0600` |
| Export has no date/pagination filter | Runtime grows with total history | Stream JSONL; stop retaining raw session objects after normalization; consider documented Dashboard pagination only after measuring |
| Dashboard has no authentication and can manage credentials | Non-loopback binding exposes highly sensitive state | Do not make Dashboard the default; if configured, require loopback URL and GET-only use |
| SQLite/JSONL schemas are transitional | Direct parsers can break or choose incomplete history | Use documented CLI/REST only; version-gate and fail closed on unknown shapes |
| Child sessions mix compression, branches, subagents, and background reviews | Intermediate-agent content may enter a public draft or valid continuations may be lost | Apply parent/end-reason rules above and cover them with fixtures |
| Reasoning can exist in dedicated columns or leaked tags | Chain-of-thought could enter the Review Window | Ignore all reasoning fields and strip upstream-recognized tags before writing |
| Transcript rewrite regenerates IDs/timestamps | Old work may be reviewed twice | Detect missing cursor anchors and apply a bounded rewrite fingerprint cache |
| `tool`/`cron` source sessions can include the review workflow itself | Self-referential reviews and noisy automation | Exclude both sources in v1; run manual integration queries with `--source tool` |
| Multiple Hermes profiles are isolated | Wrong profile could be silently reviewed | Make binary/environment/profile selection explicit and treat each selected home as a separate Agent Source |
| CLI source/docs can drift within the same semver | Parser assumptions may break | Probe capabilities, keep a synthetic contract fixture for v0.11.0, and fail closed with an upgrade message |

The existing Agent Blog privacy validator, private `.agent-blog/` directory, Git branch/PR workflow, and human merge gate remain unchanged. No source conversations or Hermes identifiers should ever be committed.

## 8. Minimal adapter design

Proposed module boundary:

```text
scripts/lib/hermes-cli.mjs
  collectHermesWindow(options)
  buildHermesReviewWindow(options)
  stripHermesHiddenContent(text)
```

Configuration additions:

```json
{
  "platform": "hermes",
  "hermesBinary": "hermes"
}
```

Collection flow:

1. Spawn `hermes sessions export -` directly.
2. Parse stdout one JSON object per line with a strict maximum line size.
3. Build a session metadata map so child sessions can be classified.
4. Retain only accepted session IDs and normalized Visible Messages.
5. Apply Review Day and cursor filtering.
6. Write the existing Review Window contract; never persist the export.
7. Reuse current draft generation, privacy screening, cursor transaction, Git publisher, and PR approval.

One Hermes profile/home is one Agent Source. `source` values inside that database are platform metadata (`cli`, `telegram`, `acp`, and so on), not separate Agent Sources; they may be retained privately as optional attribution but must not alter publication identity.

Do not generalize the current platform switch until all three adapter studies are compared. A small third branch for `platform === "hermes"` is sufficient for the first implementation; a shared adapter registry should be introduced only if the final recommendation shows repeated code that materially benefits from it.

## 9. Test strategy

### Pure normalization tests

Create a synthetic v0.11.0 JSONL fixture with no real user data and verify:

- user and assistant text are kept;
- system and tool roles are absent;
- tool-only assistant rows are absent;
- visible prose on an assistant row with `tool_calls` is kept while the calls are absent;
- every reasoning column is absent;
- closed, unterminated, and orphan reasoning tags are stripped;
- leaked tool XML is stripped;
- empty/unknown content shapes fail closed;
- `tool` and `cron` sessions are excluded;
- live-parent subagent/background children are excluded;
- compression continuations and explicit branches are included;
- timezone boundaries use the configured Review Day;
- equal timestamps sort deterministically by session/message ID;
- per-session cursors admit only later `(timestamp, id)` rows.

### Rewrite tests

- Simulate `replace_messages()` with new IDs/timestamps and a missing prior cursor anchor.
- Verify already emitted normalized messages are suppressed only in rewrite-recovery mode.
- Verify a legitimate repeated prompt with distinct append-only IDs is not suppressed.

### CLI contract tests

Use a fake executable to verify:

- exact argv is `sessions export -`;
- stdout is consumed incrementally across arbitrary chunk boundaries;
- malformed JSON, oversized lines, unexpected schema, and non-zero exits fail without writing a partial Review Window;
- stderr is bounded and never mixed into parsed data;
- version/capability detection rejects an unsupported CLI clearly;
- no raw export file is created.

### Workflow regression tests

- Existing OpenClaw and Codex collector tests remain unchanged and pass.
- Hermes submission and no-update runs use the same idempotent Review Identity and cursor-advance rules.
- Privacy tests assert the Review Window/draft stay ignored and mode `0600`, and the rendered article contains no session IDs, local paths, tool payloads, reasoning, or private terms.
- An opt-in local smoke test may run `hermes sessions export -` against an isolated synthetic `HERMES_HOME`; normal CI must not require a Hermes installation or real credentials.

## Recommendation

Proceed with a Hermes implementation issue after the three-platform comparison is complete. Gate that issue on:

- CLI exporter v0.11.0+;
- the session/child/message filtering rules above;
- rewrite duplicate tests;
- a repo-scoped Hermes Review Skill;
- documentation for manual trigger, Hermes cron trigger, profile selection, and Dashboard security.

The Dashboard transport and MCP integration are not required for the first adapter.
