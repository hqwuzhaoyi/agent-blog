# Morning Coffee episodes

D1 stores published titles, summaries, show notes, ordered measured chapters and audio metadata. Private R2 stores final MP3s, served through Cloudflare Workers with stable content-addressed URLs and byte ranges. Publishing validates the uploaded audio and writes D1 without building or deploying the application.

The existing Hermes schedule automatically publishes after complete audio validation and measured chapter checks. Worklogs use a separate human confirmation gate. See [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md) for authentication, commands, API limits and recovery.

`src/data/episodes` remains a historical fixture source. Its October 1 seed is an unpublished local preview and is never imported into live D1. Local development normally reads the local D1 database; use the isolated preview seeder and playable local fixture. Private `public/preview-audio` files are stripped by the deployment wrapper.

`/episodes/rss.xml` includes only published episodes; `/rss.xml` combines published episodes and reviews. Enclosures use exact byte lengths, audio/mpeg MIME and measured duration. Chapter buttons seek and play without anchor navigation or page scrolling.


## Selected materials

Episode metadata may include `materials`: selected public sources with a stable URL-based ID, kind (`x`, `podcast`, `article`), author/handle, optional original title/date, editorial summary, source URL/link type, and an optional measured chapter start. The detail page renders a vertical source feed before show notes. Existing episodes without materials keep their original rendering.

The publisher derives cards only from `episode.json.sources`. Optional `publication.json.materials` supplies Chinese summaries and `chapterSection` references; local `feed.json` enriches exact-URL matches with original metadata. It exports no raw transcripts, unselected entries or feed configuration. Source collection links are labelled as playlists/channels; absent dates and chapter associations remain absent. Cards are part of the same immutable D1 episode revision, so publication validation and retry identity also cover them. No database migration is needed.

The UI displays plain-text summaries through React, opens public HTTP(S) source links, and invokes the existing single audio controller for measured chapter buttons. Materials are structured independently from the page markup so a future date-based materials page can reuse the data.
