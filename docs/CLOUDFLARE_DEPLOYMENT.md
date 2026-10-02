# Cloudflare deployment

The blog is served by the `agent-blog` Cloudflare Worker at `https://blog.wuzhaoyi.xyz/agent-blog/`. The domain root redirects to the retained blog path. The private R2 bucket `agent-blog-audio` stores mixed MP3s and published episode Markdown; the Worker exposes only content-addressed audio paths. Static assets contain no local preview audio.

## Authentication and deployment

Use Node 24+, npm, ffmpeg, ffprobe, and Wrangler. The publisher host uses Wrangler OAuth credentials outside the repository; run `npx wrangler login` if access must be renewed. A CI publisher can instead receive a Cloudflare API token and account ID through private environment variables. The token must authorize Workers deployment, the R2 bucket, and the domain binding.

```bash
npm ci
npm run deploy:check
npm run deploy
```

Both commands first restore the complete published episode catalog from R2, then build the site. `deploy:check` performs no remote writes. Do not deploy raw `dist` output or run `wrangler deploy` directly after a local development build: that build excludes remotely published episodes. A local lock serializes publisher commands; use one publishing host and avoid simultaneous deployments from CI or other hosts.

The repository's deployment workflow validates the Cloudflare build only; it no longer deploys GitHub Pages. Application changes and approved Daily Reviews are deployed by running `npm run deploy` after updating the publisher checkout. Episode publishing itself has no dependency on Git commits, PRs, or merges.

## Automatic episodes

The existing Hermes morning-coffee job starts at 07:15 Asia/Shanghai, targeting completion before 08:00. It retains the existing feed, TTS, mixed audio, and single Telegram delivery. Website deployment failure must not block delivery of the new MP3 in Telegram.

The render directory must contain:

- `episode.json`: title, disclosure, original segments and sources.
- `episode.mp3`: final mixed audio.
- `episode.parts/manifest.json`: measured segment durations and pauses.
- `shownotes.md`: public content and attributed sources only.
- `publication.json`: a summary and four to six chapters referencing manifest sections.

```json
{
  "summary": "A short episode description",
  "chapters": [
    { "title": "Opening", "section": 0 },
    { "title": "Main story", "section": 2 },
    { "title": "Briefs", "section": 6 },
    { "title": "Editorial perspective", "section": 9 },
    { "title": "Closing", "section": 10 }
  ]
}
```

Section references must match that episode's actual manifest; these example sections are specific to the October 1 seed. Never estimate timestamps. Keep archive-only music information and production records in private `notes.md`.

```bash
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD --dry-run
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD
```

The command validates the inputs, completely decodes audio, measures the final duration, creates a content-addressed audio URL, restores previous episode Markdown, builds, uploads audio and publication metadata, and deploys Workers. Retries use the same date and hash rather than duplicating episodes. `publication-result.json` records the deployment outcome; verify the live page and audio before reporting publication success.

`publication/catalog.json` in R2 lists published episode dates. `publication/episodes/<day>.md` holds each episode's public Markdown, and `episodes/<day>/<sha256>.mp3` holds audio. These objects are not exposed through a public R2 domain.

## Recovery

A build or validation failure makes no remote changes. An upload/deployment failure can leave validated metadata in R2 while the existing live Worker version remains active; rerun the command or `npm run deploy` to converge. Do not delete past episodes or reset the R2 catalog when retrying.

Use Cloudflare's Worker version history to roll back a bad deployment. Restore old DNS only when intentionally returning to the former host; the previous record was a proxied CNAME `blog.wuzhaoyi.xyz → hqwuzhaoyi.github.io`, TTL auto. Private local backups of DNS and cron configuration are kept in `.agent-blog/`. To undo the scheduling change, pause the same Hermes job, restore the saved prompt/schedule, then resume it; do not create a second delivery job.
