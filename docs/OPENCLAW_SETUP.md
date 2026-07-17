# OpenClaw setup

Run these steps on the same host as the OpenClaw Gateway. The first release does not read a remote Gateway.

## Required software

- A current OpenClaw installation with a running local Gateway
- Node.js 24 or newer
- Git
- GitHub CLI authenticated for the Publication Repository

Use a fine-grained GitHub credential that can write only to the Agent Blog repository. The installer checks that repository access works but never reads or prints the token value.

## AI-led installation

The normal setup is conversational. The AI must:

1. run `npm run configure -- --list-themes`, present the returned Theme IDs and labels, and ask the operator to choose a theme and language;
2. write the answers to `src/blog.config.json` using `npm run configure`;
3. show the resulting configuration for confirmation;
4. commit and push the configuration when it changed; and
5. continue with the installer only from a clean working tree.

Available choices:

- Theme: one of the IDs returned by the Theme catalog command.
- Language: `en` or `zh-CN`. This controls the site interface, dates, RSS metadata, and the language requested from the Review Skill.

The operator does not need to run the configuration command manually.

## Direct installation

For diagnostics or non-interactive automation, run from the Publication Repository:

```bash
npm install
npm run configure -- --theme night-shift --language en
# Commit and push src/blog.config.json when the selection changed.
node scripts/install-openclaw.mjs \
  --timezone Asia/Taipei \
  --source-label "OpenClaw / Gateway 01"
```

Commit and push `src/blog.config.json` after configuration so the public GitHub Pages build receives the choice and the working tree is clean before installation. Use `--dry-run` with `npm run configure` to validate a choice without editing the file.

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

## Manual trigger

The scheduled job always collects the preceding Review Day. To prepare a current-day Review Window without creating a pull request, run:

```bash
npm run review:manual
```

To prepare a specific local date instead, run `npm run review:manual -- --day YYYY-MM-DD`. The command writes only the private `.agent-blog/review-window.json`; follow the installed `openclaw-review` skill to select highlights and then either submit a draft pull request or record a no-update.

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
