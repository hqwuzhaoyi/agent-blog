# Codex setup

Run these steps on the same machine that stores the Codex threads to review. Collection uses the supported local `codex app-server` protocol and never parses Codex transcript or rollout files.

## Required software

- A current, authenticated Codex CLI
- The ChatGPT desktop app when using a scheduled task
- Node.js 24 or newer
- Git
- GitHub CLI authenticated for the Publication Repository

Use a fine-grained GitHub credential that can write only to the Agent Blog repository. The setup script checks repository access but never reads or prints the token value.

## Configure the Agent Source

From a clean Publication Repository checkout, run:

```bash
npm install
npm run install:codex -- \
  --confirm-repo-scope \
  --timezone Asia/Taipei \
  --source-label "Codex / Local"
```

This is a dry-run and performs no writes. After reviewing the plan, apply it explicitly:

```bash
npm run install:codex -- \
  --apply \
  --confirm-repo-scope \
  --timezone Asia/Taipei \
  --source-label "Codex / Local"
```

`--confirm-repo-scope` confirms that the GitHub credential is limited to this Publication Repository.

Optional arguments:

- `--source-id <slug>` changes the stable Agent Source identifier.
- `--private-terms "Customer A,Internal Project"` adds local terms that force whole-highlight omission.
- `--base-branch <branch>` changes the publication branch from `main`.
- `--codex-binary <path>` uses a non-default Codex CLI binary.
- `--dry-run` explicitly selects the default zero-write planning mode.

The script verifies Codex and GitHub access and writes `.agent-blog/config.json`. It does not collect a preview because setup does not have a safely scoped review thread. The repo-scoped `$codex-review` skill is already available under `.agents/skills/`.

## Create the daily scheduled task

Codex CLI does not manage scheduled tasks. In the ChatGPT desktop app, create a standalone scheduled task for `00:15` in the configured time zone, select this repository, and choose **local checkout** rather than a worktree. Use the exact prompt printed by `npm run install:codex`:

```text
Use the $codex-review skill to run the complete daily review for the Publication Repository at /absolute/path/to/agent-blog. Never merge the pull request.
```

The computer and desktop app must be running at the scheduled time. Keep the Publication Repository clean: the workflow creates or updates a review branch and then returns to the original branch. A worktree is unsuitable because the private cursor state under `.agent-blog/` must persist across runs.

## Collection boundary

The collector requests active and archived interactive threads updated on or after the Review Day from `thread/list`, then reads persisted turns with `thread/read(includeTurns: true)`. It excludes the Codex thread currently running the review so the workflow cannot review itself. It retains only `userMessage` text and `agentMessage` text. Reasoning, plans, commands, file changes, tool calls, images, subagent activity, and other thread items are excluded before the private Review Window is written.

The `$codex-review` skill obtains the current thread from the Codex runtime's `CODEX_THREAD_ID` and passes it explicitly as `--exclude-thread-id`. If that value is unavailable, collection fails before `codex app-server` starts and no Review Window or cursor is written.

The first run considers the selected Review Day. Later successful submissions and no-update runs advance a cursor independently for each Codex thread. Raw messages remain local and only Publication-Safe Markdown can enter Git.

## Manual verification

```bash
npm test
```

Then invoke `$codex-review` from an active Codex task. It writes `.agent-blog/review-window.json`, selects highlights, and either submits a pull request or records a no-update result.

## Manual trigger

Use this when you want to run the Codex review immediately instead of waiting for
the scheduled task.

From an active Codex task, ask Codex to run the repo skill:

```text
Use the $codex-review skill to run the complete daily review for the Publication Repository at /absolute/path/to/agent-blog. Never merge the pull request.
```

For direct diagnostics from the active Codex task, the equivalent collection command is:

```bash
npm run review:manual -- --exclude-thread-id "$CODEX_THREAD_ID" --day 2026-07-18
```

Do not run collection when `CODEX_THREAD_ID` is empty; the collector rejects it before starting `codex app-server`.

After the Review Window is collected, `$codex-review` must:

1. Read `.agent-blog/review-window.json` and `.agent-blog/config.json`.
2. Write `.agent-blog/review-draft.json` only with publication-safe highlights.
3. Run `npm run review -- submit` when there are highlights, or
   `npm run review -- no-update` when there is nothing worth publishing.

The collector reads Codex through `codex app-server`, not transcript files. It
loads candidate Codex threads through the supported API, then keeps only
normalized user and assistant text for the selected Review Day.
