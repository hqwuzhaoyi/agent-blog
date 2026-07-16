# OpenClaw setup

Run these steps on the same host as the OpenClaw Gateway. The first release does not read a remote Gateway.

## Required software

- A current OpenClaw installation with a running local Gateway
- Node.js 24 or newer
- Git
- GitHub CLI authenticated for the Publication Repository

Use a fine-grained GitHub credential that can write only to the Agent Blog repository. The installer checks that repository access works but never reads or prints the token value.

## Install

From the Publication Repository:

```bash
npm install
node scripts/install-openclaw.mjs \
  --timezone Asia/Taipei \
  --source-label "OpenClaw / Gateway 01"
```

Optional arguments:

- `--source-id <slug>` changes the stable Agent Source identifier.
- `--private-terms "Customer A,Internal Project"` adds local terms that force whole-highlight omission.
- `--base-branch <branch>` changes the publication branch from `main`.
- `--dry-run` reports every planned action without writing configuration or changing OpenClaw.

The installer:

1. verifies the local OpenClaw Gateway;
2. verifies GitHub access to the current repository;
3. writes private configuration under `.agent-blog/`;
4. installs `openclaw-review` as a shared local skill;
5. creates an isolated `00:15` cron job in the configured time zone; and
6. collects a non-publishing Review Window preview.

## Scheduled behavior

The isolated cron turn follows the installed Review Skill. It collects the preceding local Review Day, writes a private draft JSON file, and either:

- submits one Publication-Safe Markdown pull request; or
- records a no-update result and advances session cursors.

The same Agent Source and Review Day always resolve to the same content path and branch. A retry updates the existing proposal. Session cursors advance only after a successful push, or after a successful no-update run.

## Manual verification

Preview deterministic behavior without OpenClaw:

```bash
npm test
npm run review:fixture
```

Inspect the installed job and recent runs:

```bash
openclaw cron list
openclaw cron runs --id <job-id> --limit 10
```

Do not edit OpenClaw session JSONL files. Collection uses the Gateway's `sessions.list` and display-normalized `chat.history` RPCs.

## Removal

Remove the scheduled job, then remove the shared skill:

```bash
openclaw cron remove <job-id>
rm -rf ~/.openclaw/skills/openclaw-review
```

Delete `.agent-blog/` only if you intentionally want to discard incremental cursors and local Review Windows.
