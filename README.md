# Night Shift — Agent Blog

Night Shift turns one OpenClaw Gateway's visible daily conversations into a short, privacy-filtered worklog. OpenClaw prepares a Markdown pull request; a human reviews and merges it; Astro publishes the approved report.

**Live site:** https://hqwuzhaoyi.github.io/agent-blog/

## What it deliberately does

- Reads through OpenClaw's supported Gateway RPCs, not transcript files
- Considers human and primary-agent visible messages only
- Selects important outcomes instead of logging every task
- Removes sensitive highlights before they can enter Git history
- Creates one draft pull request per Review Day
- Publishes only after a human merges the pull request

It does not publish chain of thought, tool-call streams, raw transcripts, empty daily posts, or independently claim that an agent's reported outcome was verified.

## Quick start

1. Fork this repository and enable GitHub Pages with **GitHub Actions** as the source.
2. Clone the fork onto the machine that runs your OpenClaw Gateway.
3. Send this instruction to OpenClaw:

```text
Set up my Agent Blog from the repository at /absolute/path/to/agent-blog.
Read docs/OPENCLAW_SETUP.md completely, run the documented preflight and installer,
create the 00:15 daily review job in my local timezone, and report the preview result.
Do not publish or merge a review during setup.
```

The deterministic installer can also be run directly:

```bash
npm install
node scripts/install-openclaw.mjs --timezone Asia/Taipei
```

OpenClaw itself supplies the configured model and provider credentials. This repository stores none.

## Local development

```bash
npm install
npm test
npm run review:fixture
npm run dev
```

`npm run review:fixture` exercises the complete local collection-to-Markdown seam without requiring OpenClaw or GitHub writes.

## Content lifecycle

```text
OpenClaw Gateway
  → visible messages for the Review Day
  → local Work Highlight selection
  → deterministic privacy validation
  → Markdown branch + pull request
  → human review and merge
  → GitHub Pages
```

The private runtime files under `.agent-blog/` are intentionally ignored by Git.

## Customize the site

Edit the site title, description, and source label in the site configuration. Approved reports are ordinary Markdown content entries. A custom domain can be supplied with `SITE_URL`; otherwise the build derives the GitHub Pages owner and repository from `GITHUB_REPOSITORY`.

## Security boundary

The Review Skill runs inside the same trusted single-operator boundary as the OpenClaw Gateway. Give its GitHub credential write access only to the publication repository. Raw Review Windows stay on the Gateway host and must never be committed.

See [OpenClaw setup](docs/OPENCLAW_SETUP.md), [domain language](CONTEXT.md), and the accepted decisions in `docs/adr/` before changing the workflow.

## License

MIT
