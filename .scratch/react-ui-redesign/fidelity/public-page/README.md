# Public page redesign review

2026-10-02. Isolated local React Worker preview at `localhost:3100`; initial captures precede production deployment; production content is unchanged.

## Page composition

- Public layout is scoped by `.public-site` and `features/public/public.css`; admin layout, API and shared global styles are unchanged.
- Home features a fluid headline, actual published date and duration, beUI play action, compact chapter list, and a code-native branded episode cover. Cover circles and central bars are static identity graphics, not an audio waveform, analysis or measured playback state. Cover date comes from the selected public episode.
- Published episodes use a separate card grid. Worklogs use an editorial list with actual source/date and links to complete reading pages. Counts use the published content arrays; empty states remain available.
- Archive uses genuine beUI Tabs and combined type/keyword/month filters. Public query sources and URLs were preserved.
- Episode details, archive and worklog reading pages share a quieter heading and metadata scale. Markdown lists keep explicit disc/decimal markers; text/body sanitization remains unchanged.
- Header has active navigation pills, a working search/archive entry, actual two-feed subscription options, and a mobile menu. Compact player retains the root's single audio node; visual styling adds a small cover mark and translucent surface, without scroll animation or tweened seeks.
- Upstream beUI component details and exact adaptations remain in `src/app/features/public/beui/NOTICE.md` and its adjacent MIT license.

## Same viewport visual evidence

| Page | 1440 × 1000 | 390 × 844 |
| --- | --- | --- |
| Home before composition | [Before desktop](before-home-1440.png) | [Before mobile](before-home-390.png) |
| Home after composition | [After desktop](after-home-1440.png), [Full page](after-home-1440-full.png) | [After mobile](after-home-390.png) |
| Archive | [Desktop](after-archive-1440.png) | [Mobile](after-archive-390.png) |
| Episode detail | [Desktop](after-episode-1440.png) | [Mobile](after-episode-390.png) |
| Worklog reading | [Desktop](after-review-1440.png) | [Mobile](after-review-390.png) |

Additional controls: [compact mobile player](after-player-390.png), [mobile menu](after-mobile-menu.png), [desktop subscription options](after-subscribe.png), [mobile subscription options](after-subscribe-mobile.png).

The before captures come from the preceding beUI-source fidelity pass; both comparisons use the actual seeded episode title/date/duration and identical viewport sizes. The isolated content library also contains entries created by independent HTTP workflow tests, so total counts differ between captures. Those counts are genuine local published records, not production counts or fabricated UI statistics.

## Verification

- `npm run react:check` passes.
- `node test/public-player-browser.mjs` passes after the page redesign: initial no-autoplay, one audio instance, repeated chapter seek, no hash/page jump, public route continuity, archive filters/history, 390px no horizontal overflow, reduced motion, focus restore and handle-only Sheet drag dismissal.
- Actual browser screenshots above were inspected. The 390px home shows the featured title, actual date/duration and play action in the first viewport.
- Actual mobile menu opens with close-button focus and the selected route; Escape restores focus. Subscription options link to `/agent-blog/episodes/rss.xml` and `/agent-blog/rss.xml`.
- Root reviewer also checked the production-length Sam Altman headline and summary against the isolated fixture at 390px: play button bottom 491px, below the 844px viewport; no horizontal overflow. The local audio remains the isolated 30-second test tone.

Final CSS selector audit: every new selector starts with `.public-site`; portalled menu/player sheets use same-element `.public-site.public-navigation-sheet` / `.public-site.public-player-sheet` scoping. TypeScript and the full playback/browser regression pass after this scoping change. Mobile menu and subscription panel were rechecked with close-button focus, four functioning route links, two RSS URLs and no horizontal overflow.

## Production acceptance

Deployed on 2026-10-02 as Worker version `077bc206-8ab4-492e-903f-6047f5b2e209`. Final local runtime and playback/browser acceptance pass. Read-only production checks pass for 27 real CSS/JS resources, reviewer authentication guard, combined RSS (5 items), podcast RSS (2 items), and both audio files HEAD/Range. Actual production browser hydration was verified by opening the subscription Sheet and checking its two feed links. Pi was skipped at the user’s request; its incomplete runs are not acceptance evidence.
