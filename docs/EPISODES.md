# Morning Coffee episodes

D1 stores published titles, summaries, show notes, ordered measured chapters and audio metadata. Private R2 stores final MP3s, served through Cloudflare Workers with stable content-addressed URLs and byte ranges. Publishing validates the uploaded audio and writes D1 without building or deploying the application.

The existing Hermes schedule automatically publishes after complete audio validation and measured chapter checks. Worklogs use a separate human confirmation gate. See [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md) for authentication, commands, API limits and recovery.

`src/data/episodes` remains a historical fixture source. Its October 1 seed is an unpublished local preview and is never imported into live D1. Local development normally reads the local D1 database; use the isolated preview seeder and playable local fixture. Private `public/preview-audio` files are stripped by the deployment wrapper.

`/agent-blog/episodes/rss.xml` includes only published episodes; `/agent-blog/rss.xml` combines published episodes and reviews. Enclosures use exact byte lengths, audio/mpeg MIME and measured duration. Chapter buttons seek and play without anchor navigation or page scrolling.
