# Morning Coffee episodes

Audio and automatically published show notes are stored in Cloudflare R2. Cloudflare Workers serves pages, RSS, and audio. Morning Coffee publication is automatic under the operator's standing authorization; Daily Reviews retain their human review gate.

## Content

Each `src/data/episodes/<YYYY-MM-DD>.md` entry provides title, summary, date, measured duration in seconds, an AI voice disclosure, audio metadata (`url`, byte `length`, and `audio/mpeg` type), and ordered chapters (`title`, measured `start` in seconds).

Published entries require an HTTPS audio URL. Use the stable Workers audio URL on the blog domain rather than an expiring signed URL. The R2 bucket remains private. Store only the final mixed MP3; keep voice tracks, synthesis parts, and private production records locally. R2 credentials belong in private runtime configuration, never in content or Git.

A `draft: true` entry appears only in the development server and receives a noindex directive. Production pages and both RSS feeds exclude drafts. The checked-in October 1 seed remains a local preview draft. Its published counterpart is restored from R2 during deployment.

## Local preview

Run `npm ci` and `npm run dev`. The episode collection is at `/agent-blog/episodes/` and the seed page is at `/agent-blog/episodes/2026-10-01/`.

The seed's local preview MP3 is copied to `public/preview-audio/2026-10-01.mp3`, which is ignored by Git. These files are only for local preview. Remove `public/preview-audio/` before creating a production build intended for manual deployment. Clean CI checkouts contain no preview audio.

## RSS

`/agent-blog/episodes/rss.xml` contains only published podcast episodes. The site's `/agent-blog/rss.xml` also includes published episodes alongside Daily Reviews. Episode items include the stable audio URL, actual byte length, MIME type, and measured duration.

Chapter links seek the player to their measured offset, play on click, and preserve a shareable page anchor. Loading an anchored page seeks without autoplay.

## Automatic publication

The publisher uses `publication.json` (summary and chapter section references), public `shownotes.md`, and the completed renderer artifacts. It derives duration using ffprobe, completely decodes the MP3, computes chapter offsets from measured parts, uploads content-addressed audio, and deploys the entire site with the full R2 episode catalog.

See [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md) for commands, scheduling, and recovery. Telegram delivery remains exclusively owned by the existing Hermes cron.
