# Pi setup

Run setup on the same machine and under the same operating-system account that owns the Pi Agent Source. Collection uses the published Pi SDK against private snapshots; it never gives the Review Skill access to Pi Conversation Sources.

## Compatibility

This adapter is validated against this explicit matrix:

| Component | Supported contract |
| --- | --- |
| npm SDK identity | `@earendil-works/pi-coding-agent` |
| repository package pin | `@earendil-works/pi-coding-agent@0.81.1` |
| Pi CLI | `0.81.x` with `--print`, `--no-session`, and `--skill` |
| SDK session format | `CURRENT_SESSION_VERSION === 3` |
| SDK session API | static `SessionManager.listAll()` and `SessionManager.open()` |
| Node.js | 22.19.0 or newer |

The package identity, exported `VERSION`, session version, and Session Manager capabilities are checked at runtime. A different package, SDK version, CLI line, or session contract fails closed. Keep the dependency exact rather than using a range; the main integration must add the pin above to `package.json`.

The identity and APIs come from Pi's upstream [coding-agent package](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/package.json), [SDK documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), and [CLI reference](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md#cli-reference).

## Review Skill location

The repository owns the Review Skill at `.agents/skills/pi-review/SKILL.md`. Pi officially discovers project skills from `.agents/skills/` while walking from the working directory to the repository root. Keeping the skill there avoids changing global Pi settings or copying files into the Agent Operator's Pi directory. See Pi's upstream [skill location rules](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md#locations).

## Dry run

From a clean Publication Repository checkout, run:

```bash
node scripts/install-pi.mjs \
  --confirm-repo-scoped-credential \
  --confirm-pi-auth-ready \
  --timezone Asia/Taipei \
  --pi-agent-dir "$HOME/.pi/agent"
```

Dry-run is the default. It verifies the Pi CLI, the repository-local SDK, `.agent-blog` Git-ignore coverage, and Publication Repository GitHub write access, then prints the source, compatibility, worker, and scheduler plans. It performs zero writes.

`--confirm-repo-scoped-credential` is the Agent Operator's assertion that the active GitHub credential can write only to this Publication Repository. Setup separately requires `gh repo view --json viewerPermission` to report `WRITE`, `MAINTAIN`, or `ADMIN`; GitHub CLI cannot prove repository-only credential scope, so both checks are required.

`--confirm-pi-auth-ready` is the Agent Operator's assertion that Pi authentication has already been configured and tested. Pi does not expose a reliable auth-only status command. Setup uses the official `pi --help` output to verify the offline model-status capability but does not execute `--list-models`: upstream model availability is based on configured-auth detection rather than a live credential validation, and starting that path may initialize auth storage. Setup never opens the Pi auth file or reads credential values. See the upstream [`listModels` implementation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/cli/list-models.ts) and a documented [`hasAuth()` false-positive case](https://github.com/earendil-works/pi/issues/4485).

Optional arguments include:

- `--source-id <slug>` and `--source-label <label>` for the Agent Source identity.
- `--pi-binary <path>` for a non-default Pi CLI.
- `--private-terms "Customer A,Internal Project"` and `--base-branch <branch>` for a new private config.
- Repeated `--exclude-session-id <id>` for sessions independently known to be subagents.
- `--scheduler manual|os`; `os` still only describes the schedule.

## Apply

Apply requires both explicit write authorization and an explicit provenance assertion:

```bash
node scripts/install-pi.mjs \
  --apply \
  --confirm-repo-scoped-credential \
  --confirm-pi-auth-ready \
  --confirm-no-persistent-subagents \
  --timezone Asia/Taipei \
  --pi-agent-dir "$HOME/.pi/agent"
```

`--confirm-no-persistent-subagents` means this selected Pi Agent Source does not use persistent subagent sessions. Known excluded session IDs are always classified as `subagent`; all other sessions are classified as `primary` only under this assertion. Without it, provenance is `unknown` and collection fails closed. Do not use the flag when the assertion is untrue.

Apply merges Pi fields and the non-sensitive confirmation booleans into `.agent-blog/config.json`, preserves unrelated configuration, and enforces mode `0600`. It does not record accounts, token scopes, providers, or credential contents. It does not modify Pi settings, extensions, provider credentials, model selection, or global skills.

## Trigger a review

The worker uses Pi's existing provider and model configuration in ephemeral print mode:

```bash
pi -p --no-session \
  --skill "$PWD/.agents/skills/pi-review/SKILL.md" \
  "Use the pi-review skill to run the complete Agent Blog daily review. Never merge the pull request."
```

The Review Skill runs the shared review lifecycle and reads only `.agent-blog/review-window.json` as conversation input. `--no-session` prevents the review itself from becoming another persistent Conversation Source.

For a manual Review Day preview, run the shared collector first:

```bash
npm run review:manual
```

Then invoke the one-shot Pi command above. A specific Review Day can be selected with `npm run review:manual -- --day YYYY-MM-DD`.

## Scheduler boundary

The setup result describes a daily `00:15` local-time OS schedule and its exact one-shot command. This installer does not call `launchctl`, `systemctl`, `crontab`, or another scheduler. The Agent Operator must review and install the descriptor separately.

## Registry integration

The live Pi registry wrapper should load the runtime facade from private config and pass it to the collector:

```js
const sdk = await loadPiSdkRuntime({
  provenancePolicy: config.piProvenance,
});

return collectPiReviewWindow({
  sdk,
  sourceId: config.sourceId,
  reviewDay,
  timeZone: config.timeZone,
  state,
  sessionDir: config.piSessionDir,
  excludeSessionId,
});
```

The wrapper must retain the collector's private `deferred` array for logging and cursor decisions. It must not expose defer reasons publicly or create a cursor for a deferred session.

Registry fixtures should call `buildPiReviewWindowFromSessions()` with synthetic SDK output in
the exact shape `{ sessionId, provenance, entries }`. Do not pass fixture paths, source paths,
or raw session text to that builder. It runs the same message normalization and cursor seam as
live collection but intentionally has no `deferred` output; concurrent-source deferral belongs
only to `loadPiSessionsReadOnly()`.
