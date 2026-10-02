# Cloudflare deployment and content publication

The React/TanStack Start application runs on Worker `agent-blog` at `https://gitlog.si/`. D1 `agent-blog-content` is authoritative for live content. Private R2 `agent-blog-audio` stores final MP3s. Content publication is independent of application deployment.

## Application deployment

Use Node 24+, npm and Wrangler. The deployment host needs Workers deployment, domain and D1 configuration permissions. Local Wrangler OAuth credentials remain outside Git; refresh with `npx wrangler login` if D1 permission is missing.

```bash
npm ci
npm run deploy:check
npm run deploy
```

The wrapper builds the React/TanStack Start Worker using the production Wrangler configuration, strips private preview audio and generated local secret files from `dist-react`, verifies the generated production bindings, and deploys through that generated configuration. Development/build commands default to isolated preview bindings; only the deployment wrapper selects production. It does not restore, upload or replace content. GitHub Actions validates builds only. Code deployment and content publication can happen independently without overwriting a catalog.

## Database provisioning and migration

For a new installation, create D1 and private R2 resources and set their bindings in `wrangler.jsonc`. Set Worker secrets `SUBMIT_TOKEN` and `REVIEW_TOKEN` independently using Wrangler secrets; use long random values and keep them outside Git. Provision the schema before deploying:

```bash
npx wrangler d1 migrations apply agent-blog-content --remote
```

This installation migrated the three already-approved historical reviews and two already-published episodes. The import only reads legacy approved review Markdown and the R2 published catalog; it never imports the checked-in episode preview draft. Legacy R2 Markdown/catalog remain available as recovery backups and are no longer updated.

```bash
npm run content:migrate -- --remote
```

Migration uses insert-if-absent identities so retries do not replace current content or publication pointers. The ignored `.agent-blog/content-migration.sql` records the import; protect it as content data.

## Publisher authentication

Hermes/OpenClaw use only `SUBMIT_TOKEN`. Configure `BLOG_SUBMIT_TOKEN` and optional `BLOG_PUBLICATION_URL` (the origin), or a 0600 `.agent-blog/publication-client.json`:

```json
{ "url": "https://gitlog.si", "token": "YOUR_PRIVATE_SUBMISSION_TOKEN" }
```

The submit key can create/update private review drafts, upload final audio, and automatically publish validated episodes. It cannot approve a worklog. Keep the reviewer key out of agent credentials, messages and production materials. This host's reviewer key is stored privately at `.agent-blog/reviewer-key`; the operator can use it to log in at `/admin/`. Login creates a one-day signed HttpOnly, Secure, SameSite=Strict cookie. Approval is a same-origin POST, bound to the exact current draft revision.

## Worklog publication

Submit publication-safe frontmatter Markdown (title, summary, date, source, platforms, highlights):

```bash
npm run review:submit -- --file /absolute/path/to/draft.md --id hermes-YYYY-MM-DD
```

The JSON result contains `status: draft`, revision and a complete private preview URL. Preview capabilities permit viewing only. The operator logs in at `/admin/`, opens the draft, reads the complete preview, and clicks confirmation. The public article, lists and RSS then read the approved revision from D1. Edits remain drafts while the previous approved revision stays online. Stale confirmation returns 409 and requires reviewing the latest draft.

D1 holds immutable `content_revisions`, `content_heads` with separate draft/public pointers, and `publication_audit` with approval actor/time. Draft IDs use stable source-and-day identities. Body HTML is sanitized on rendering. The React workbench uses reviewer JSON APIs under `/admin/api/` for session/list/detail/revision/save/approval/audit/episode operations within the reviewer-cookie path. Unsaved editor state blocks approval and SPA navigation requires a discard decision. Public requests query only published pointers; private preview responses are no-store/noindex and never enter feeds.

## Automatic episodes

The existing Hermes morning-coffee job starts at 07:15 Asia/Shanghai, targeting completion before 08:00. It retains its source feed, TTS, mixing and single Telegram delivery. Website failure must not block Telegram audio delivery.

The directory must contain `episode.json`, final `episode.mp3`, measured `episode.parts/manifest.json`, public `shownotes.md` and `publication.json` with summary and four to six chapter section references. Chapter offsets come from measured synthesis parts, never estimates. Keep raw materials and production records local.

```bash
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD --dry-run
npm run episode:publish -- --directory /absolute/path/to/render-output --day YYYY-MM-DD
```

The command validates inputs, completely decodes/probes audio and measures chapters. A content-addressed MP3 uploads through the API to R2; then metadata and body are saved in D1 and automatically published. The Worker checks the object MIME type and actual byte size before publishing. Upload limit: 25 MiB. `publication-result.json` records the outcome. Dry-run validates locally without remote access or deployment.

## API contract

All `/api/` calls require `Authorization: Bearer SUBMIT_TOKEN`.

- `GET /api/reviews/:id` or `/api/episodes/:id`: current draft/public revision identifiers.
- `PUT /api/reviews/:id`: `{data, body, expectedRevision}` → private draft and preview URL.
- `PUT /api/audio/:day/:sha256`: final MP3 bytes with Content-Length; verifies hash before storage.
- `PUT /api/episodes/:day`: `{data, body, expectedRevision}` → validates uploaded audio, saves and publishes.

Use `null` expectedRevision for new content. Updates must match the current revision; identical content retries return the existing revision. Conflicting edits return 409. Content revision hashes identify complete metadata/body snapshots. Approval audit and published pointers update in the same D1 batch.

## RSS compatibility

Both `/rss.xml` and `/episodes/rss.xml` dynamically read published D1 content. Public content responses are no-store so a stale cached feed does not hide publications. Feed updates become visible on the reader's next fetch; this is not a subscriber notification service.

A zone rule named `Agent Blog RSS and audio clients` skips only Browser Integrity Check for GET/HEAD requests to the two feeds and audio paths. The rule is a zone setting separate from Worker deployments; other WAF checks remain active. See [Cloudflare BIC](https://developers.cloudflare.com/waf/tools/browser-integrity-check/).

Run `npm run check:rss` after publication to verify identities/dates and audio enclosure MIME, length, HEAD and Range with Python's default User-Agent.

## Local development and recovery

Use the isolated local configuration, dedicated test credentials and generated playable fixture:

```bash
npm run react:db:seed
npm run dev
# Open http://localhost:3100/
npm run test:runtime
npm run test:browser
```

The seeder refuses production bindings and remote origins. It creates `.dev.vars.react-preview` from the committed fixture example when absent. See [React preview](REACT_PREVIEW.md) for the default build/check commands. Unit tests use real SQLite and mocked HTTP audio resources; browser/runtime tests use the running isolated Worker and do not write live content.

Audio upload can leave an unreferenced object if the content write fails; retry the same episode. Database content publication never replaces the Worker deployment. Roll back application code through Worker version history; restore D1 content separately using D1 backups/export or retained immutable revisions. The pre-React D1-backed Worker version `39aaeb49-3178-4c13-a6c3-9532863d3332` remains a compatible application rollback target; rollback does not remove D1/R2 content. Preserve database and audio when retrying, and back up D1 before future schema migrations.


## Root domain migration (2026-10-03)

The canonical origin is `https://gitlog.si` with `/`, `/episodes/`, `/reviews/`, `/archive`, `/admin/`, `/rss.xml` and `/episodes/rss.xml`. `wrangler.jsonc` binds the new custom domain while retaining `blog.wuzhaoyi.xyz` for compatibility. Reader GET/HEAD requests on the old domain or old `/agent-blog` prefix return 308 to the corresponding root URL, preserving query parameters. Legacy submission API requests are normalized inside the Worker so bearer authorization and request bodies do not depend on cross-origin redirects.

D1/R2 resource identities and immutable content revisions are unchanged. Owned historical audio URLs are normalized when preparing public/admin/feed output; unrelated external URLs are untouched. Production RSS item GUIDs keep their established legacy identities while links and enclosures use the new origin, preventing existing subscriptions from treating the same entries as new episodes. New operator cookies use `Path=/admin/`; operators sign in on the new domain.

Browser acceptance uses ego-browser task spaces and CLI heredocs. Runtime/API tests still run against isolated local bindings; never seed or execute fixture publication checks against production.
