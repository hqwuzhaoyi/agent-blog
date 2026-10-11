# Episode sources and spoken briefs

Status: ready-for-agent
Execution: completed

## Current accepted scope (2026-10-11)

- Render one「咖啡豆」list after shownotes, merging selected materials and captured timeline entries by normalized URL. Selected sources retain episode order and measured chapter actions; remaining updates follow. Show Chinese summaries first and expand original posts on demand. Preserve old source/timeline anchors and episodes with either metadata field absent.
- Move episode layout, shared cover/player, public navigation and footer styling into Tailwind while retaining theme tokens, prose styles and remaining page-specific CSS. Use a compact right-hand contents directory with chapters underneath; mobile contents stay in document flow. Footer is a single desktop row of brand, subscriptions and accessible contact icons.
- New morning-coffee productions declare `episode.briefs = {section, urls}` for normally 3–5 selected news items. Those summaries must actually occur in the narrated segment and in consecutive measured manifest parts. Link the source cards to one measured「短讯」chapter. Existing episodes without this contract remain publishable.
- Synchronize the local morning-coffee skill copy and existing Hermes task to load the new contract and run validation before and after synthesis. Keep its schedule and delivery target; do not re-record or re-send historical episodes as part of the UI change.

## Current verification and rollout

- 15 test files / 58 tests, TypeScript, review fixture and production deployment dry-run passed. Source merge tests cover differing legacy IDs, fragment normalization, missing feed entries and legacy-only episodes. Brief tests reject website-only summaries, missing chapter associations and stale or incomplete synthesis.
- Browser checks covered source expansion, real chapter seeks, one persistent audio node, history/deep links, right-sidebar anchors, and 320/390/1440 layouts. Shared playback and slider regression suites passed during migration.
- October 8 production page now renders 41 unique cards instead of 45 across two lists. Old anchors still resolve. Footer measures 69px on desktop and 113px on mobile, with bottom clearance reserved only when the player is visible.
- Latest application deployment: Worker `1d51ddbf-cdde-4174-9502-c4bdffd48ddf`, established origin `https://blog.wuzhaoyi.xyz`. Changes use existing D1 metadata; no historical audio rewrite was performed.
- The local Hermes task is enabled with the same 07:15 schedule and delivery target. Its skill files match the repository. Validator commands were exercised against synthetic measured parts; a complete scheduled synthesis/delivery run has not yet been exercised with the new contract.

## Known publication edge cases

The earlier timeline addition still rejects feeds with more than 80 entries or a post over 1,000 characters. Its API coverage rule also rejects a nonempty timeline missing a selected material URL. These findings remain open; the UI union does not change that producer/API contract.

## Original scope and October 3 rollout (historical)

User accepted a selected-materials feed inside episode details, visually resembling a vertical X feed: author/platform/original date, Chinese editorial summary, original link, selected badge and real related chapter. Raw candidate feeds remain local; a standalone materials page is deferred.

Add optional structured materials to the existing episode JSON revision, validate public links and measured chapter references, and prepare only episode.sources from local feed metadata plus publication.materials editorial notes. Preserve old producers and episodes. Compose cards with existing beUI playback controls and source links, keeping one audio node and immediate chapter seeks.

Update existing morning-coffee reference instructions without touching unrelated SKILL.md edits. Verify preparation, API persistence/rejection, local ego interactions/responsiveness, deploy to established root origin, then enrich published episodes using existing public sources under the authorized podcast publication workflow. Backfill must preserve current body/audio/metadata and reject concurrent revision changes.

## Validation

- TypeScript; 13 files / 47 tests passed, including selected-only preparation, unknown dates/collection links, unsafe links/private notes, duplicate sources, measured chapter references, old producers and real SQLite API persistence.
- Publication dry-run passed using a copied October 3 artifact set; original publication receipts were preserved.
- Ego material checks passed on 390/1440: cards and provenance labels, true dates, original links, keyboard chapter playback without hash/scroll movement, shared audio across routes. Existing public playback/filter/Sheet regression and isolated runtime publication checks also passed.
- Three published episode revisions were read for a metadata-only backfill. Prepared twelve summaries against their stored feed snapshots; expectedRevision guards prevent overwriting concurrent edits. Deployment and the backfill completed; production checks passed.


## Production result

Deployed application commit `0d3a7c9`, Worker `cefd92f3-450e-40dc-ad61-5b7c0cc23d43`, active established origin `https://blog.wuzhaoyi.xyz/`.

The published 2026-10-01, 2026-10-02 and 2026-10-03 episodes each now contain four selected material cards (12 total). D1 readback confirmed every pre-existing metadata field, audio object reference and body remained equal to the previous published revision. Writes used exact revision guards. Local publication.json material notes and receipts were synchronized so retries reproduce these source selections; the active Hermes skill entry points to the updated repository editorial rules. No raw feed or transcript was published and no delivery message or schedule was changed.

Production ego verification on October 3 found four real authors/dates/links, correct channel link labelling, four chapter actions, a single audio node seeking to 18.662s, no hash navigation and no mobile overflow. All 28 browser resources, reviewer guard, RSS 6/3 entries and three audio enclosures passed. The skill validators and archived-input reproduction check passed.
