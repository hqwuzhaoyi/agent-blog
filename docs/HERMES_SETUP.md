# Hermes setup

The Hermes integration reads one selected Hermes profile or `HERMES_HOME` as one Agent Source. It supports only the v0.11.x session-export contract described in ADR 0021; setup fails closed for other versions.

## Prerequisites

- A configured Hermes v0.11.x installation whose existing provider and model can run a one-shot query.
- Git and GitHub CLI access to this Publication Repository. Setup checks `git remote`, active GitHub authentication, and repository `viewerPermission`; it never requests or prints credential values.
- A clean main checkout. Review state lives under ignored `.agent-blog/`, so scheduled runs must not use a temporary worktree.
- The Hermes profile's gateway must be running when Hermes cron is selected. An OS scheduler does not require the gateway.

The profile or home is mandatory. Setup never falls back to an ambient `HERMES_HOME` or the default Hermes directory.

## Inspect before applying

Select either an absolute Hermes home:

```sh
node scripts/install-hermes.mjs \
  --repo /absolute/path/to/agent-blog \
  --hermes-home /absolute/path/to/hermes-home \
  --timezone Asia/Taipei \
  --scheduler manual \
  --dry-run
```

or a named profile:

```sh
node scripts/install-hermes.mjs \
  --repo /absolute/path/to/agent-blog \
  --profile writer \
  --timezone Asia/Taipei \
  --scheduler hermes \
  --dry-run
```

Dry-run performs only read-only version, exporter-capability, redacted `hermes status --all`, Git, Git ignore, GitHub CLI, and—when selected—Hermes scheduler checks. It requires `.agent-blog` to be ignored and repository `viewerPermission` to be `WRITE`, `MAINTAIN`, or `ADMIN`. It reports the Agent Source, Review Skill, private configuration, credential confirmation state, manual worker, and both scheduling alternatives without writing a profile, skill, schedule, or runtime state.

## Apply setup

Mutation requires both `--apply` and `--confirm-repo-scope`. `--apply` and `--dry-run` cannot be combined.

```sh
node scripts/install-hermes.mjs \
  --repo /absolute/path/to/agent-blog \
  --hermes-home /absolute/path/to/hermes-home \
  --timezone Asia/Taipei \
  --scheduler manual \
  --confirm-repo-scope \
  --apply
```

`gh repo view` proves that the active credential can write this Publication Repository, but GitHub CLI cannot prove that the same credential has no authority over other repositories. Pass `--confirm-repo-scope` only after verifying that the scheduled Hermes environment uses credentials restricted to this repository. Apply records that operator confirmation in the private configuration.

Apply writes `.agent-blog/config.json` with mode `0600` and copies the repository's `agent-blog-review` skill into only the selected Hermes home. It does not directly read or modify Hermes `.env`, `config.yaml`, memories, sessions, other skills, provider selection, or model selection. A named profile is kept as a distinct Agent Source and is never merged with the default profile.

Use `--source-id`, `--source-label`, `--private-terms`, `--base-branch`, or `--hermes-binary` to override the corresponding private Agent Blog settings.

## Manual review

The installer output contains the exact manual one-shot worker command for the selected home or profile. Run that command from the main checkout. It starts Hermes with `--quiet`, preloads `agent-blog-review`, uses `source=tool`, does not resume a user conversation, and does not override the configured provider or model.

The skill enters `npm run review -- manual`, reads only `.agent-blog/review-window.json` plus the configured language, then invokes the shared `submit` or `no-update` action. The `tool` source is excluded by the Hermes collector, preventing the review worker from reviewing itself.

## Hermes cron

Choose `--scheduler hermes` during dry-run and apply. Setup verifies `hermes cron status`, then reuses the job named `Agent Blog daily review` or creates it at `15 0 * * *`. The job is pinned to the absolute main checkout, preloads the same Review Skill, and enters `npm run review -- collect` for the preceding Review Day.

Hermes cron ticks are performed by the selected profile's gateway. Start that gateway separately before setup. Hermes v0.11 does not provide the installer a per-job timezone override, so the gateway scheduler's local timezone must match `.agent-blog/config.json.timeZone`. After applying, use the selected profile or home to inspect `hermes cron list` and trigger the job once for an operator-observed smoke test.

## OS scheduler

Choose `--scheduler os` to receive a descriptor containing the exact one-shot Hermes worker command, main-checkout working directory, schedule, and timezone. The installer never writes launchd, cron, or systemd configuration automatically. Configure the local scheduler to run the descriptor at `00:15` in the same timezone as the Agent Blog.

Manual, Hermes-cron, and OS-scheduled workers all use the same Review Skill, deterministic privacy validator, Review Identity, cursor transaction, draft pull-request path, and no-update path. Raw Hermes exports are never inputs to the Review Skill.

## Security boundaries

- `.agent-blog/config.json`, Review Windows, and Review Drafts remain private local files.
- Only normalized human and primary-agent Visible Messages reach the Review Window.
- Export lines are normalized immediately. The live collector retains only minimal lineage metadata, current-day fresh Visible Messages, and cursor/rewrite state rather than a projected copy of every session.
- Exporter stderr is drained with constant retained memory and is never included in returned errors; raw session text and local paths are also excluded from errors.
- The Review Skill never reads Hermes session storage or raw exporter output.
- `cron` and `tool` sessions are excluded, as is the active review session when its ID is supplied by the shared runner.
- Setup does not install or update Hermes and does not expose GitHub, provider, or model credentials.
