# Claude Code setup

Claude Code support is prospective. Exact Daily Reviews begin only after the project hooks are applied; supported SDK history is used for inventory and reconciliation, never to invent historical message times or backfill a Review Day.

## Requirements

- Claude Code 2.1.166 or newer, because `MessageDisplay` first appears in that release.
- An authenticated Claude Code CLI. Setup treats the exit status of `claude auth status` as a capability probe and discards its output.
- Exact dependency pin `@anthropic-ai/claude-agent-sdk@0.3.217`. Do not use a caret or tilde range; upgrade only with the runtime contract tests.
- A GitHub Publication Repository with write access and `.agent-blog/` ignored by Git.
- Operator confirmation that the credential used by `gh` is restricted to this Publication Repository. GitHub's repository permission response proves write access, but cannot prove the credential's scope; setup therefore fails closed without this explicit confirmation.

Install the SDK pin before setup once the shared package integration lands:

```sh
npm install --save-exact @anthropic-ai/claude-agent-sdk@0.3.217
```

## Inspect and apply

Dry-run is the default and performs no writes:

```sh
node scripts/install-claude-code.mjs --repo . --timezone Asia/Taipei --confirm-repo-scope
```

The report covers the CLI and SDK capability matrix, capture hooks, project Review Skill, prospective coverage start, 30-day journal retention, private state permissions, local schedule plan, GitHub `viewerPermission`, and the operator's repository-scope confirmation. Credential output, SDK summaries, paths, prompts, and session identifiers are discarded. The confirmation is an operator assertion, not an upstream proof of token scope.

Apply requires explicit authorization:

```sh
node scripts/install-claude-code.mjs --repo . --timezone Asia/Taipei --confirm-repo-scope --apply
```

Apply structurally merges `.claude/settings.json`; it preserves unrelated settings and hooks, adds only `UserPromptSubmit` and `MessageDisplay` capture commands, and leaves other project skills untouched. It merges `.agent-blog/config.json`, records the first coverage timestamp and repository-scope confirmation once, and writes private configuration with mode `0600`. Retrying setup does not duplicate hooks or reset coverage.

The hooks only normalize Visible Messages into `.agent-blog/claude-visible-events.json`. Receipt sequence is append-only: a late receipt with an earlier `receivedAt` gets the next sequence and never renumbers an accepted event or cursor. A second, conflicting final display batch marks coverage incomplete instead of replacing the accepted final index.

The documented `UserPromptSubmit` payload has no invocation or delivery ID. Capture therefore uses the narrowest observable turn boundary: identical user deliveries in one session before another assistant message is accepted have one deterministic identity and retries are idempotent. After an intervening accepted assistant message, submitting the same prompt again produces a new identity and both legitimate prompts are retained. Two identical submissions before any assistant display are indistinguishable under the supported contract and share that boundary; capture does not invent a timestamp window or read the transcript to guess. See the [official hook payload](https://code.claude.com/docs/en/hooks#userpromptsubmit-input).

## Manual and scheduled reviews

Every review must run in a dedicated Claude process marked before startup. For a manual review from the main checkout, use:

```sh
AGENT_BLOG_CLAUDE_REVIEW_WORKER=1 claude -p "/claude-code-review"
```

The Review Skill refuses to proceed when the marker was not inherited. The capture hook process inherits the marker and ignores the entire worker before opening or creating the journal; normal user sessions without the marker continue to be captured. The skill reads only `.agent-blog/review-window.json`. An incomplete interval stops without a draft or cursor update; an empty or immaterial complete interval finishes through no-update.

The preferred schedule is a Claude Code Desktop local task at 00:15 in the configured time zone, with worktree isolation disabled, the main checkout selected, and `AGENT_BLOG_CLAUDE_REVIEW_WORKER=1` in the worker environment. Desktop must remain open and the machine awake. Setup reports the task plan but does not create it.

For a headless alternative, request `--scheduler os`. Setup emits the same marked local `claude -p /claude-code-review` worker plan but does not mutate launchd, cron, or systemd. Do not use hooks, `/loop`, or cloud Routines as the durable scheduler.

## Coverage and retention

The Agent SDK runtime returns only normalized session identity/provenance inventory and a reconciliation result. It does not retain raw SDK messages or use `lastModified`, `createdAt`, filesystem time, or transcript activity to assign a Review Day. Missing markers, pre-install history, journal gaps, pending display batches, malformed SDK pages, uncertain subagent provenance, or reconciliation mismatch remain incomplete with no candidate cursors.

The live adapter reads one validated journal snapshot. It closes a Review Day only when the installed coverage marker reaches its local start, the trusted run clock has crossed its local end, and that snapshot has neither gaps nor pending display batches. SDK reconciliation then compares documented message counts for each captured session with accepted journal events. Because the public SDK payload cannot reliably map every historical message to a hook event or Review Day, any count mismatch fails closed; text matching and indirect timestamps are forbidden. Synthetic fixture collection accepts only the closed `{ events, inventory, coverage }` contract.

The default normalized journal retention policy is 30 days and can be changed with `--retention-days`. This policy is separate from Claude Code's own transcript retention. Deleting `.agent-blog/` discards coverage and cursor state; do so only when intentionally starting prospective coverage again.
