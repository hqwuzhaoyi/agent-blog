# Agent Blog

Agent Blog publishes human-reviewed agent worklogs and automatically produced Morning Coffee podcasts. Astro builds the site, Cloudflare Workers serves pages and RSS, and a private Cloudflare R2 bucket stores podcast audio and published episode show notes.

**Live site:** [blog.wuzhaoyi.xyz/agent-blog/](https://blog.wuzhaoyi.xyz/agent-blog/)

**Morning Coffee:** [Episodes](https://blog.wuzhaoyi.xyz/agent-blog/episodes/) · [Podcast RSS](https://blog.wuzhaoyi.xyz/agent-blog/episodes/rss.xml)

## Deployment: Cloudflare Workers + R2

The production domain is connected to Cloudflare Workers. The existing `/agent-blog/` path is retained, and the domain root redirects to it.

- **Workers:** serves the Astro site, RSS, and audio requests, including byte ranges for playback seeking.
- **R2:** stores final mixed MP3s, published episode Markdown, and the episode catalog. Audio is accessed through the blog domain; the bucket remains private.
- **GitHub:** stores application code, reusable skills, and approved Daily Review Markdown. GitHub Actions checks the build; it does not deploy the production site.

### Deploy from the publisher host

Use Node.js 24+, npm, ffmpeg, ffprobe, and the project's Wrangler dependency. For the configured deployment:

```bash
npm ci
npx wrangler login
npm run deploy:check
npm run deploy
```

`deploy:check` restores the published episode catalog from R2 and validates the build without remote writes. `deploy` restores the same catalog, builds the site, and publishes it to Workers. This preserves previous episodes when application code or approved worklogs change.

After reviewing and merging a Daily Review, update the publisher checkout and run `npm run deploy`. A merge alone does not trigger a production deployment.

For a new installation, configure the Cloudflare account, Worker, domain, private R2 bucket, and initial episode catalog before using these commands. The checked-in deployment configuration describes this site's existing resources. See [Cloudflare deployment](docs/CLOUDFLARE_DEPLOYMENT.md) for configuration, authentication, publication commands, and recovery. Keep credentials in private environment variables or Wrangler's local login state.

Use the deployment commands above rather than uploading a normal local `dist` build: local development excludes remotely published episodes. The deployment wrapper also excludes local preview audio.

## Morning Coffee

Morning Coffee is an independently scripted, AI-voiced Chinese briefing based on attributed podcast transcripts, builder posts, and articles. Its production flow is:

```text
Material feed snapshot
  → topic selection and attributed Chinese script
  → IndexTTS narration and music mixing
  → complete audio validation and measured chapters
  → R2 audio and show notes
  → Cloudflare Workers pages and RSS
```

Episodes publish automatically under the operator's standing authorization, without a daily pull request or merge. The configured Hermes job begins at **07:15 Asia/Shanghai**, targeting availability before **08:00**, and delivers the final audio through its existing Telegram channel. Website publication failure does not block delivery of that episode's audio.

To validate and publish an already rendered episode:

```bash
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD --dry-run
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD
```

The input directory contains `episode.json`, `episode.mp3`, `episode.parts/manifest.json`, public `shownotes.md`, and `publication.json`. The publisher derives chapter offsets from measured segment durations, probes the final audio duration, uses actual file bytes in RSS enclosures, and restores previous episodes before deploying. Verify the resulting live page, audio, and RSS before reporting success.

The reusable [morning-coffee skill](skills/morning-coffee/SKILL.md) includes feed acquisition, editorial guidance, configurable IndexTTS rendering, mixing, and chapter validation. See [episode content](docs/EPISODES.md) for the content model and local preview behavior.

## Agent worklogs

OpenClaw prepares a concise, privacy-filtered Daily Review from one Gateway's visible conversations. A human reviews and merges the Markdown pull request before it can be deployed.

- Reads through the supported Gateway RPCs.
- Considers human and primary-agent visible messages.
- Selects important Work Highlights and removes private details before Git submission.
- Creates one draft pull request per Review Day.
- Preserves human approval for Daily Reviews independently of automatic podcast publication.

Worklogs describe reported outcomes, not independently verified execution. Raw transcripts, hidden reasoning, tool-call streams, and private Review Windows remain outside the public site.

```text
OpenClaw Gateway
  → visible messages for the Review Day
  → local Work Highlight selection and privacy validation
  → Markdown branch + pull request
  → human review and merge
  → publisher checkout update and npm run deploy
  → Cloudflare Workers
```

### Configure the worklog agent

Clone the repository onto the machine running your OpenClaw Gateway. Send this instruction to OpenClaw to collect and persist site preferences:

```text
Interactively configure my Agent Blog at /absolute/path/to/agent-blog.
Run npm run configure -- --list-themes, then ask me to choose a theme,
language (en or zh-CN), blog title, and optional one-line tagline.
Write the choices to src/blog.config.json and show the configuration.
Commit and push changed configuration, then read docs/OPENCLAW_SETUP.md,
run its preflight and installer, and report the collection preview.
Keep the Daily Review publication gate; do not publish or merge a review during setup.
```

For non-interactive setup:

```bash
npm ci
npm run configure -- --theme quiet-minimal --language zh-CN
# Commit and push src/blog.config.json if it changed.
node scripts/install-openclaw.mjs --timezone Asia/Shanghai
```

OpenClaw supplies its configured model and provider credentials. See [OpenClaw setup](docs/OPENCLAW_SETUP.md) for scheduling and collection details.

## Local development

```bash
npm ci
npm test
npm run check
npm run review:fixture
npm run dev
```

`review:fixture` exercises the local collection-to-Markdown workflow without OpenClaw or GitHub writes. `npm run review:manual` prepares a current-day private Review Window without creating a pull request. Draft episodes are visible in development and excluded from production pages and RSS.

## Customize the site

Use `npm run configure -- --list-themes` to inspect the built-in themes. Then configure the theme, language, title, and tagline with `npm run configure`. Commit `src/blog.config.json` so subsequent deployments use the selected presentation. The site address is configured through `SITE_URL`; the default URL prefix is `/agent-blog/`.

## Security boundary

The Review Skill runs within the same trusted operator boundary as the OpenClaw Gateway. Limit its GitHub credential to the publication repository. Keep private runtime files under `.agent-blog/`, and keep Cloudflare authentication outside Git. Only final audio and public show notes are uploaded by the episode publisher.

See [domain language](CONTEXT.md) and the accepted decisions in `docs/adr/` for publication boundaries.

## License

MIT
