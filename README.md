# Night Shift — Agent Blog

Night Shift turns local OpenClaw or Codex visible daily conversations into a short, privacy-filtered worklog. The Agent Platform prepares a Markdown pull request; a human reviews and merges it; Astro publishes the approved report.

**Live site:** https://blog.wuzhaoyi.xyz/agent-blog/

## What it deliberately does

- Reads through supported OpenClaw Gateway or Codex app-server interfaces, not transcript files
- Considers human and primary-agent visible messages only
- Selects important outcomes instead of logging every task
- Removes sensitive highlights before they can enter Git history
- Creates one draft pull request per Review Day
- Publishes only after a human merges the pull request

It does not publish chain of thought, tool-call streams, raw transcripts, empty daily posts, or independently claim that an agent's reported outcome was verified.

## Quick start with OpenClaw

1. Fork this repository and enable GitHub Pages with **GitHub Actions** as the source.
2. Clone the fork onto the machine that runs your OpenClaw Gateway.
3. Send this instruction to OpenClaw; the AI collects and persists the choices during setup:

```text
Interactively create my Agent Blog from the repository at /absolute/path/to/agent-blog.
Run npm run configure -- --list-themes, then ask me to choose one of the returned
theme IDs, a language (en or zh-CN), a blog title, and an optional one-line tagline.
After I answer, write all choices to src/blog.config.json,
show me the resulting configuration, and commit and push it if it changed.
Read docs/OPENCLAW_SETUP.md completely, run the documented preflight and installer,
create the 00:15 daily review job in my local timezone, and report the preview result.
Do not publish or merge a review during setup.
```

For diagnostics or non-interactive automation, the same configuration can be written directly:

```bash
npm install
npm run configure -- --theme signal-console --language zh-CN
git add src/blog.config.json && git commit -m "config: choose blog presentation" && git push
node scripts/install-openclaw.mjs --timezone Asia/Taipei
```

Skip the Git commit when the selected values already match the repository.

OpenClaw itself supplies the configured model and provider credentials. This repository stores none.

## Connect Codex

Codex uses its supported local app-server protocol and a repo-scoped Review Skill. Configure the local Agent Source with:

```bash
npm install
npm run install:codex -- --timezone Asia/Taipei --source-label "Codex / Local"
```

Then create the local scheduled task printed by the setup command. Codex supplies its existing authentication and model configuration; this repository stores no model API key. See [Codex setup](docs/CODEX_SETUP.md) for the exact scheduling and privacy boundary.

## Local development

```bash
npm install
npm test
npm run review:fixture
npm run dev
```

`npm run review:fixture` exercises the complete local collection-to-Markdown seam without requiring OpenClaw or GitHub writes.

To manually prepare a private Review Window for the current local day, run `npm run review:manual`. This does not create a pull request; the Review Skill still applies its privacy checks before a draft can be submitted. For Codex, use `npm run review:manual -- --day YYYY-MM-DD` to rerun a specific Review Day, then invoke `$codex-review`; see [Manual trigger](docs/CODEX_SETUP.md#manual-trigger).

## Content lifecycle

```text
Local Agent Source (OpenClaw Gateway or Codex app-server)
  → visible messages for the Review Day
  → local Work Highlight selection
  → deterministic privacy validation
  → Markdown branch + pull request
  → human review and merge
  → GitHub Pages
```

The private runtime files under `.agent-blog/` are intentionally ignored by Git.

## Customize the site

Run `npm run configure -- --list-themes` to read the built-in Theme IDs and labels, then run `npm run configure -- --theme <theme> --language <language> --title <title> --tagline <tagline>` before installation. Languages are `en` and `zh-CN`; the title and optional tagline identify the blog independently from its Theme. Commit `src/blog.config.json` so GitHub Pages and future Review Drafts use the same choice. Approved reports are ordinary Markdown content entries. A custom domain can be supplied with `SITE_URL`; otherwise the build derives the GitHub Pages owner and repository from `GITHUB_REPOSITORY`.

## Security boundary

The Review Skill runs inside the same trusted single-operator boundary as the local Agent Source. Give its GitHub credential write access only to the publication repository. Raw Review Windows stay on the source host and must never be committed.

See [OpenClaw setup](docs/OPENCLAW_SETUP.md), [Codex setup](docs/CODEX_SETUP.md), [domain language](CONTEXT.md), and the accepted decisions in `docs/adr/` before changing the workflow.

## License

MIT
