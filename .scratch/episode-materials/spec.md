# Episode materials feed

Status: ready-for-agent
Execution: in-progress

User accepted a selected-materials feed inside episode details, visually resembling a vertical X feed: author/platform/original date, Chinese editorial summary, original link, selected badge and real related chapter. Raw candidate feeds remain local; a standalone materials page is deferred.

Add optional structured materials to the existing episode JSON revision, validate public links and measured chapter references, and prepare only episode.sources from local feed metadata plus publication.materials editorial notes. Preserve old producers and episodes. Compose cards with existing beUI playback controls and source links, keeping one audio node and immediate chapter seeks.

Update existing morning-coffee reference instructions without touching unrelated SKILL.md edits. Verify preparation, API persistence/rejection, local ego interactions/responsiveness, deploy to established root origin, then enrich published episodes using existing public sources under the authorized podcast publication workflow. Backfill must preserve current body/audio/metadata and reject concurrent revision changes.

## Validation

- TypeScript; 13 files / 47 tests passed, including selected-only preparation, unknown dates/collection links, unsafe links/private notes, duplicate sources, measured chapter references, old producers and real SQLite API persistence.
- Publication dry-run passed using a copied October 3 artifact set; original publication receipts were preserved.
- Ego material checks passed on 390/1440: cards and provenance labels, true dates, original links, keyboard chapter playback without hash/scroll movement, shared audio across routes. Existing public playback/filter/Sheet regression and isolated runtime publication checks also passed.
- Three published episode revisions were read for a metadata-only backfill. Prepared twelve summaries against their stored feed snapshots; expectedRevision guards prevent overwriting concurrent edits. Deployment/backfill/production checks pending.
