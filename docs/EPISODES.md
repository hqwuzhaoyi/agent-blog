# Morning Coffee episodes

D1 stores published titles, summaries, show notes, ordered measured chapters and audio metadata. Private R2 stores final MP3s, served through Cloudflare Workers with stable content-addressed URLs and byte ranges. Publishing validates the uploaded audio and writes D1 without building or deploying the application.

The existing Hermes schedule automatically publishes after complete audio validation and measured chapter checks. Worklogs use a separate human confirmation gate. See [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md) for authentication, commands, API limits and recovery.

`src/data/episodes` remains a historical fixture source. Its October 1 seed is an unpublished local preview and is never imported into live D1. Local development normally reads the local D1 database; use the isolated preview seeder and playable local fixture. Private `public/preview-audio` files are stripped by the deployment wrapper.

`/episodes/rss.xml` includes only published episodes; `/rss.xml` combines published episodes and reviews. Enclosures use exact byte lengths, audio/mpeg MIME and measured duration. Chapter buttons seek and play without anchor navigation or page scrolling.


## Sources and short news

Episode revisions retain optional `materials` (editorial selections and measured chapter associations) and `timeline` (captured public updates). The detail page merges both by normalized URL into a single source list after shownotes. Selections come first in episode order, followed by remaining updates; each URL appears once even if legacy IDs differ. Timeline summaries take precedence over legacy topic labels, original posts are expandable, and measured chapter actions use the shared audio controller. Existing revisions need no migration or republication.

New production scripts declare `episode.briefs = {section, urls}`. The chosen short-news summaries must occur in that spoken segment; publication metadata includes a matching 短讯 chapter and source-to-chapter links. The morning-coffee validator runs before synthesis and again against the measured manifest. The publisher applies the same checks whenever briefs metadata is present, while retaining compatibility with historical recordings. The authoritative editorial and delivery workflow lives in `skills/morning-coffee/`.
