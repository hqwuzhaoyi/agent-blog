# React/beUI 前台与 shadcn-admin 审核后台

Status: ready-for-agent

## Problem Statement

Agent Operator 希望 Agent Blog 成为体验统一的阅读、收听与人工审核应用。当前公开页面由 Astro 渲染，审核后台由 Worker 拼接基础 HTML 表单，两者缺少共享的组件体系，后台也没有完整的列表、编辑与修订对比体验。

读者需要快速找到最新 Morning Coffee Episode、连续收听并阅读 Daily Review，而无需关注制作记录或部署细节。现有播放器曾出现动画卡顿、滚动跟手不佳及章节点击触发页面滚动的问题，框架迁移必须保留已修复的行为。

Agent Operator 已决定移除 Astro：公开前台使用 React + beUI，审核后台采用 shadcn-admin。迁移不能重新引入内容 PR、全站重建或每日人工批准播客，也不能破坏已经上线的 D1/R2 内容、稳定链接与 RSS 订阅。

## Solution

建立一个运行在 Cloudflare Workers 上的 React 应用，公开内容页使用服务端渲染，后台使用独立管理布局并按路由加载。统一 Tailwind CSS、基础组件与设计变量：前台采用现代编辑版式和 beUI 交互组件，后台以 shadcn-admin 的导航、表格和表单为基础，默认进入待确认工作台。

首页突出最新一期播客，最近节目和工作日志分别呈现。文章阅读保持清晰中文排版；播放器跨公开页面持续播放，章节操作仅定位音频。动效集中在播放器主动展开、筛选状态切换与发布结果反馈，普通滚动和滑块操作保持直接响应。

工作日志继续采用“生成 Publication-Safe Review Draft → 完整预览 → Agent Operator 确认具体版本 → 发布”的流程。后台可保存新草稿版本、查看修订差异并确认发布；保存草稿不会自动公开。Morning Coffee Episode 沿用 Hermes 的校验后自动发布流程，D1 保存内容与发布状态，R2 保存最终音频，页面和 RSS 动态读取已发布内容。

## User Stories

1. As a reader, I want the home page to feature the latest available Morning Coffee Episode, so that I can start listening quickly.
2. As a reader, I want to see an episode's actual date, measured duration, title and concise summary, so that I can decide whether to listen without misleading freshness claims.
3. As a reader, I want to play an episode directly from its card without navigating away, so that listening starts with one intentional action.
4. As a reader, I want recent episodes and Daily Reviews presented as distinct sections, so that I understand whether an item is for listening or reading.
5. As a reader, I want public pages to focus on content and useful actions, so that production records and deployment details do not interrupt my experience.
6. As a reader, I want episode pages to show chapters, show notes, attributed sources and an AI voice disclosure, so that I understand the recording and can verify its context.
7. As a listener, I want chapter selection to seek and play without scrolling the page or changing its hash, so that I keep my reading position.
8. As a listener, I want playback to continue across public routes and browser history navigation, so that exploring the site does not restart the episode.
9. As a listener, I want playback position, volume and muted state preserved during route changes, so that the player behaves consistently.
10. As a listener, I want play/pause, ten-second skip controls and a seek slider, so that I can control the episode precisely.
11. As a listener, I want the seek slider to follow pointer and keyboard input immediately, so that dragging feels direct.
12. As a listener, I want elapsed time, total duration and the current chapter to remain accurate, so that I know where I am in the episode.
13. As a listener, I want an inline player to move naturally with the document and a compact player when it leaves view, so that scrolling feels attached to my gesture.
14. As a listener, I want smooth transitions when I intentionally expand or collapse the player, so that the relationship between its forms is clear.
15. As a mobile listener, I want a compact bottom player and an expandable chapter sheet, so that controls fit a small screen.
16. As a mobile listener, I want sheet dragging and chapter-list scrolling to use distinct gestures, so that the player does not fight normal scrolling.
17. As a reader, I want readable Daily Review titles, summaries, source attribution and complete body content, so that I can understand the selected Work Highlights.
18. As a reader, I want public search and archive filters for content type and month, so that I can find previous content without seeing private drafts.
19. As a reader, I want public search and filter state reflected in navigation history, so that returning to a result list preserves my context.
20. As a subscriber, I want separate podcast and combined RSS feeds, so that I can choose the content I follow.
21. As an existing subscriber, I want feed identities, enclosure URLs and exact audio lengths preserved, so that migration does not duplicate or break subscriptions.
22. As a reader opening a shared link, I want existing review and episode URLs to keep working, so that bookmarks remain useful.
23. As a reader with limited JavaScript availability, I want article text and metadata delivered in the initial response, so that content remains readable and link previews remain meaningful.
24. As a keyboard user, I want labelled controls, visible focus and predictable dialog focus handling, so that I can use both public and management pages.
25. As a reader who prefers reduced motion, I want all controls to work with movement removed, so that animation preferences do not limit access.
26. As a reader, I want light and dark presentation with legible text and controls, so that the site works in different viewing conditions.
27. As a mobile reader, I want layouts and fixed controls to fit a 390-pixel viewport and safe areas, so that content is not clipped or hidden.
28. As an Agent Operator, I want reviewer login to remain separate from agent submission credentials, so that only my explicit Review Approval can publish a Daily Review.
29. As an Agent Operator, I want login to open the pending review list, so that I can act on drafts without navigating a generic analytics dashboard.
30. As an Agent Operator, I want searchable pending and published lists with source, content date, status and update time, so that I can identify the correct review.
31. As an Agent Operator, I want a complete reader-facing preview before approval, so that I can check exactly what will become public.
32. As an Agent Operator, I want the publication card to identify the review, current revision and public destination, so that confirmation is unambiguous.
33. As an Agent Operator, I want to edit and save a Review Draft without publishing it, so that corrections remain private until I approve them.
34. As an Agent Operator, I want to compare a saved draft with its published revision and inspect available sources, so that I can review what changed.
35. As an Agent Operator, I want unsaved edits, incomplete previews and in-flight saves to block approval, so that I cannot approve content I have not actually reviewed.
36. As an Agent Operator, I want one clear confirmation action for the current saved revision, so that publishing does not require a PR or redundant confirmation steps.
37. As an Agent Operator, I want actual pending, success and error feedback from the publication request, so that animation never implies a result that did not occur.
38. As an Agent Operator, I want stale approval and conflicting saves rejected with a refresh-and-review message, so that another revision cannot be approved accidentally.
39. As an Agent Operator, I want the current Published Review to remain public while a newer draft is edited, so that changes are only exposed after a new Review Approval.
40. As an Agent Operator, I want real approval time and audit information alongside the published link, so that I can trace publication decisions.
41. As an Agent Operator, I want the read-only preview capability to grant viewing without publication authority, so that sharing a preview does not share approval credentials.
42. As an Agent Operator, I want a podcast management view of actual dates, durations, chapters, publication states and audio links, so that I can inspect published episodes without invented production telemetry.
43. As an Agent Operator, I want site appearance, subscription information and sign-out controls in a focused settings area, so that management contains only relevant operations.
44. As an Agent Operator, I want existing Theme selection and site identity settings to remain meaningful after migration, so that changing the rendering framework does not discard my preferences.
45. As an Agent Source, I want stable source-and-day Review Identity and retry-safe draft submission, so that repeated processing updates one Review Draft.
46. As the Morning Coffee publisher, I want validated audio and metadata to publish through the existing API without redeploying the application, so that the episode can be available when the operator wakes up.
47. As the Morning Coffee publisher, I want the existing schedule and Telegram delivery to remain independent of website failures, so that a UI migration does not disrupt delivery.
48. As an Agent Operator, I want a verified preview deployment before production cutover, so that content, feeds, playback and approval behavior can be checked without publishing test reviews on the live site.
49. As a maintainer, I want shared presentation components with routing and data responsibilities kept outside Theme Slots, so that future design changes do not duplicate publication behavior.
50. As a maintainer, I want licensed component sources and clear dependency boundaries, so that the site remains maintainable and reusable under upstream terms.

## Implementation Decisions

### Application and module boundaries

- Remove Astro as the application framework, including its rendering integration, production entrypoint dependency and framework-specific build/check tooling after the React replacement passes acceptance. Historical documentation may describe the former implementation without remaining a runtime dependency.
- Use React 19, TypeScript, Tailwind CSS 4 and Motion. Adopt TanStack Start for public SSR and TanStack Router/Query for navigation and server-state management. Validate compatible versions during implementation; the specification does not pin mutable package versions.
- Deploy the React application through Cloudflare Workers. Retain D1 as authoritative for live content and private R2 for final MP3s. This migration does not recreate the databases or import content again.
- Separate the public layout, reviewer layout, audio controller, publication service and shared article renderer. Public pages must not load admin table/editor bundles or access reviewer data during SSR.
- Reuse the existing publication service, revision hashing, optimistic concurrency rules, public-pointer queries, audio serving and producer commands. Replace framework-bound dependencies with ordinary service dependencies without changing their external contracts.
- Core routes prepare Publication-Safe presentation data and labels; Theme Slots remain presentation-only. Preserve configured site identity, language and Theme selection, shared defaults and the existing no-inheritance rule. Adapt the existing supported Theme IDs to React rather than silently removing alternatives.
- Preserve the current domain, retained blog prefix, root redirect, review/episode URLs, audio paths and both feed endpoints. Query parameters can represent new archive/search state without changing content identity.
- Deliver full public article text, canonical metadata and useful non-JavaScript content in SSR responses. Client navigation hydrates and reuses the public layout rather than recreating the audio controller.

### Component sources and presentation

- Use beUI as the main source for public Button, Tabs, Tooltip and mobile Bottom Sheet components; adapt copied source to the project's tokens and behavior. Use shadcn/ui as the shared base for forms, dialogs, accessible controls and foundational styling.
- Adopt shadcn-admin navigation, header, Data Table, filtering and responsive management structure. The upstream UI is not a ready-to-use backend; connect only necessary pages and replace demonstration business data and authentication examples.
- Borrow Beautiful UI's Approval Card, Context Cards and Diff Table interaction structures for review details. Reference Transitions for state changes while keeping Motion/CSS as the animation execution layer. Rare UI is optional inspiration, not a required core dependency.
- Preserve applicable copyright, license and attribution requirements when adopting source. Rare UI and Transitions have conditions beyond a generic MIT claim; consult the verified source/license record before copying their material.
- Use warm-white surfaces, charcoal text and dark-green primary actions, with limited terracotta accents for podcast context. Default reading typography is a legible Chinese system font at approximately 17–18px with generous line height and a body width around 720px; the broader public layout is approximately 1120px wide.
- Keep reader-facing text and accessibility labels in the configured language, currently Chinese. Use actual content and operational data rather than demo metrics. Theme tokens must support light/dark presentation and maintain visible control/focus contrast.
- Reader-facing navigation exposes early coffee, worklogs, archive, search and subscription. Public pages show content, attribution and useful controls rather than deployment or production records.
- Home features the newest available episode with a truthful date, measured duration, title, summary and independent play action; recent episodes and Daily Reviews appear separately. Empty and unavailable-content states remain explicit.
- Archives support content type, keyword and month filtering over published content only, with usable empty/error states and browser-history-aware parameters. A public search response never contains draft metadata or snippets.

### Audio and motion

- Own one audio instance at the persistent application layout/controller level. Cards, detail controls and compact controls share that instance. Public navigation and back/forward preserve the same playing episode, current time, volume and muted state without restarting playback.
- Preserve existing play/pause, skip, seek, elapsed/duration, active-chapter and audio-error behavior. Initial visits do not autoplay. Switching to a different episode is an intentional operation, not a side effect of opening a page.
- Render the large player in normal document flow. Use visibility information to hand control presentation to a compact bottom player when appropriate. Scroll-triggered handoffs are immediate or a short opacity change, not a position spring that trails the gesture.
- Use shared-layout motion only for deliberate expand/collapse. The mobile chapter Sheet uses a dedicated drag handle; its scrollable content retains normal scrolling and touch controls.
- Chapter activation seeks and starts playback while preserving page scroll and hash. Slider input follows pointer/keyboard changes directly, without an extra tween. Playback progress updates are isolated to the player rather than rerendering the entire application each frame.
- Prioritize three animated transitions: player shape changes, selected navigation/filter state, and publication-result feedback. Typical direct feedback is 120–180ms and panel/layout motion 180–260ms; these are design ranges, not mandatory timing snapshots.
- Honor reduced-motion preferences by removing displacement and decorative transitions while retaining functional state changes. Use CSS transforms/opacity for appropriate transitions and avoid continuous decorative animation, text blur and scroll-chasing effects in primary workflows.
- Backstage navigation must not instantiate a second audio controller or silently restart the current episode; public playback continuity remains the required acceptance scope. A dedicated management-player presentation is outside the first release.

### Review workflow and authentication

- Keep Review Draft, Published Review and Review Approval semantics from the domain glossary and accepted publication decision. Worklogs become public only after Agent Operator confirmation of the saved revision currently shown in the complete preview.
- Management navigation contains pending reviews, published reviews, podcasts and settings. After login, the default page is the pending list, with search/filter and review-detail navigation. No bulk approval is offered.
- Desktop review details prioritize the complete public article preview and show a separate publication/source/revision panel. On mobile, preview and information tabs share access to a bottom action area that respects safe areas and does not obscure content.
- Reuse the public article renderer and HTML sanitation for operator previews so the body being checked matches public output. Render sources and revision differences from stored content; do not invent source conversations, revision summaries or production progress.
- Editing title, summary, allowed metadata and body produces a private saved revision. Save does not approve or overwrite the published pointer. Make unsaved state visible and prevent navigation from silently discarding edits.
- Disable publication while the preview is incomplete, local edits are unsaved, a save/approval request is pending, or the shown revision is stale. No second confirmation dialog is required after the explicit revision-bound publication action.
- Reuse the existing signed, HttpOnly, Secure reviewer cookie and same-origin state-changing request checks. Submission credentials and read-only preview tokens do not authorize Review Approval. Neither submission nor reviewer secrets are delivered to client code.
- Add reviewer JSON contracts for session status, paginated/filterable review lists, complete revision retrieval, draft saving with expected revision, revision comparison/audit retrieval, and explicit current-revision publication. Reviewer routes must fall within the cookie path scope or deliberately update the cookie scope without weakening its boundary.
- Session/list/detail/audit reads require reviewer authentication except for the existing capability-based read-only preview. Saves and publication require reviewer authentication and valid same-origin requests.
- A saved-draft response identifies the saved revision; an approval request carries the exact saved revision being previewed. Use existing compare-and-swap semantics and 409 conflicts for stale edits/approval. Refresh the current draft and require reviewing it again after a conflict.
- Publication responses report actual status, revision, publication time and public destination. Show success only after server acknowledgement; failed requests preserve the draft and show a meaningful retry path. Do not make an optimistic public-state transition before acknowledgement.
- Approval audit and the public pointer remain an atomic publication operation. Draft writes retain the old Published Review until approved, and identical retries remain idempotent.
- Podcast management initially reads actual published episode metadata, chapters and audio/page links. Settings expose available presentation/subscription information and login/sign-out; server-held credentials remain private. Dynamic site-preference persistence is not added as part of this migration.

### Reviewer JSON contract detail

The following HTTP routes are the planned reviewer interface, distinct from the agent-submission interface and within the existing reviewer-cookie path. Route handlers may reuse existing publication operations; JSON response shapes must be documented and exercised at the HTTP boundary.

| Operation | HTTP interface | Behavioral contract |
| --- | --- | --- |
| Session | GET /agent-blog/admin/api/session | Reviewer session metadata only; missing/expired session returns 401, never a credential. |
| Review list | GET /agent-blog/admin/api/reviews | Filter by pending/published, source and keyword; bounded pagination; statuses derive from draft/public pointers. |
| Review detail | GET /agent-blog/admin/api/reviews/:id | Return current draft/public revision identifiers, saved metadata/body and publication context. |
| Revision read | GET /agent-blog/admin/api/reviews/:id/revisions/:revision | Return a stored revision belonging to that identity; unavailable revision returns 404. |
| Save draft | PUT /agent-blog/admin/api/reviews/:id | Accept metadata, body and expectedRevision; return the saved revision; stale expectation returns 409; does not publish. |
| Approve | POST /agent-blog/admin/api/reviews/:id/publish | Accept revision for the complete saved preview; return published revision, actual time and public URL; stale revision returns 409. |
| Audit | GET /agent-blog/admin/api/reviews/:id/audit | Return actual approval records associated with that Review Identity. |
| Podcasts | GET /agent-blog/admin/api/episodes | Return actual episode metadata, measured chapters and stable audio/page links. |

Keep existing reviewer login/sign-out behavior and agent submission/audio upload endpoints compatible. All reviewer data endpoints require the reviewer session; every state-changing endpoint validates same-origin requests. Missing authentication returns 401, invalid origin returns 403, malformed content returns 422, revision conflicts return 409, and unexpected failures return a safe 5xx response without losing a saved draft. Published content visibility is determined by the server's published pointer, not client list state.

For a capability-based read-only preview, provide a token-validated SSR reader route with the complete saved revision; it remains accessible without reviewer login and supplies no management data or write authority. Successful login may bring the operator back to the selected preview, but confirmation always operates on the currently saved revision after authentication. Token URLs and preview responses retain private caching/indexing/referrer behavior.

### Producer contracts, feeds and rollout

- Retain the submission contract of stable identity plus metadata/body/expected revision, draft versus published results, capability preview links, content-addressed audio upload, object/hash/length validation and automatic episode publication. Existing Hermes/OpenClaw commands continue working against the same origin and identities.
- Preserve Hermes's existing morning schedule and single Telegram delivery ownership. UI deployment failures do not block final-audio delivery, trigger duplicate sends or change automatic publication authorization.
- RSS remains a Worker response generated from published D1 content, independent of HTML/client rendering. Preserve item GUIDs, publication dates, canonical links, podcast duration and enclosure MIME/actual byte lengths. New publications become visible on the subscriber's next fetch without application deployment.
- Preserve audio GET/HEAD, ETag/conditional responses, valid byte-range and suffix-range behavior, invalid-range responses and content-addressed cache policy. Retain the narrow RSS/audio client compatibility configuration already in use.
- Retain a backward-compatible D1 schema unless an additive change is necessary for an explicitly specified management contract. Do not add workflow states for editorial teams, rejections or production tasks.
- Implement against isolated preview data and separate test credentials. Cut over production only after public rendering, content isolation, revision approval, feeds, audio protocols, playback and responsiveness pass acceptance. Keep a rollback path for application code that preserves the live content database and audio objects.
- Update application setup/deploy commands, contributor documentation and agent skills where they reference Astro-specific execution. Content publication remains separate from code deployment; production artifacts exclude private preview audio and credentials.

## Testing Decisions

- The primary acceptance seam is a running Cloudflare-compatible Worker application with its real HTTP interfaces and real browser workflows, backed by isolated D1/R2 test resources. This is one application boundary; use the same seeded content and authentication fixtures for public pages, management actions, feeds and audio checks instead of introducing an independent seam for every component.
- A good test verifies externally visible outcomes: content received, playback continuity, scroll/hash stability, an authorized revision's publication, draft isolation, protocol responses and error recovery. It does not assert a React component tree, internal hook/store names, Motion internals, specific Tailwind class strings or exact animation-frame timing.
- Reuse the existing publication tests with real SQLite behavior as prior art for private drafts, sanitizer output, human approval, stale revisions, optimistic conflicts, idempotent retries and audio-presence validation. They remain focused lower-level regressions where they already cover stable domain behavior.
- Reuse the existing audio-delivery tests for HEAD, ETag, ranges, missing audio and unsupported methods, and the RSS integration check for feed identities, dates and actual enclosure metadata. Feed/audio acceptance operates at HTTP level and does not depend on a mounted React page.
- Adapt prior public-page/static-fixture tests to inspect the React SSR response rather than obsolete Astro output. Verify rendered title/body/source/canonical metadata and safe publication boundaries for each supported Theme; reuse representative fixtures instead of taking large implementation snapshots.
- Reuse existing listening-position/chapter-boundary tests where the calculation contract is unchanged. Prefer a browser regression for gesture continuity and page navigation rather than adding tests that only reproduce the new component's logic.
- Browser acceptance covers episode-card play without navigation, same-audio continuity through route/back/forward navigation, measured chapter seeking without scroll/hash change, direct pointer/keyboard seek, explicit player expand/collapse, and scroll-driven compact handoff without delayed positional chasing. Use real playable fixtures and wait for media state, not assumed autoplay or arbitrary sleep intervals.
- Reviewer acceptance covers login, pending list, full preview, private save, unchanged public old revision, explicit approval, publication audit and article/RSS visibility without redeployment. Include a parallel edit leading to 409, failed save/approval, repeated clicks, expired/invalid session, submission-key approval attempts and read-only preview-token approval attempts.
- A test for privacy seeds recognizable private-draft markers and malicious HTML, then checks public SSR, search, archives and both feeds. Reviewer previews are private/no-store/noindex; rendered article HTML must not execute the malicious fixture.
- Test representative desktop and 390px mobile layouts, safe-area controls, keyboard focus/labels, dialog/Sheet open-close focus, touch scrolling, light/dark contrast and reduced-motion behavior. Check essential content is not covered or horizontally clipped. Do not equate adopting a component library with accessibility completion.
- Confirm that public first-load responses do not require admin bundles or private credentials. For performance, inspect actual public loading and representative scroll/seek behavior, and test regressions tied to observable delays rather than imposing an unsupported universal FPS target.
- Production verification uses existing approved content and idempotent episode checks. Synthetic worklogs and approval tests run only against isolated preview resources, never against the live publication database.
- The proposed application/browser seam has been presented to the user for an expectation check. Additional independent component tests should only be introduced if requested or if an observed complex interaction cannot be exercised reliably through this seam.

## Out of Scope

- Changing Morning Coffee sourcing, editorial rules, TTS voice/model, mixing, measured chapter production, schedule or Telegram delivery.
- Returning content publication to Git/PR/merge or requiring manual approval for every podcast.
- Automatically approving worklogs, batching approvals, or treating draft save as approval.
- Multi-tenant operation, editorial teams, role hierarchies, a new authentication provider, Clerk account provisioning or social sign-in.
- New rejection/return workflow states, content deletion/unpublication, or generic approval chains.
- Invented analytics, revenue charts, subscriber counts or simulated audio-production progress.
- A new external CMS, audio host, public R2 bucket, search service, database migration project or dynamic site-settings persistence.
- Reproducing every component showcase, installing all five reference libraries, adopting paid components without a separate decision, or introducing a second animation runtime.
- Scroll parallax, magnetic controls, perpetual decorative effects, automatic playback on page load or restoring playback across browser sessions.
- Guaranteeing uninterrupted playback across a full browser reload or application rollback; acceptance concerns in-application navigation.
- Rewriting source content or deleting existing URLs, Theme choices, RSS subscribers or content-addressed audio.

## Further Notes

The current production application is still Astro on Workers, with D1-backed publication and private R2 audio. Three approved historical Daily Reviews and two published Morning Coffee Episodes were migrated before this specification; they are useful baseline compatibility fixtures, not assumptions about the future total content count.

The user approved the React/beUI public frontend and shadcn-admin backend direction before invoking to-spec. This specification synthesizes that decision and the agreed design; it is not a new requirements interview or authorization to publish a new worklog.

The governing human-approval decision and D1 content-publication decision remain active. Theme Slot separation and prepared presentation data also remain active through the rendering-framework replacement. The implementation should record its final framework/deployment decision without describing content publication as dependent on framework builds.

The UI references are recorded in the design research document, including primary links and license distinctions. The accompanying visual design document describes page layouts, color/typography starting points and motion priorities; this specification governs behavior, scope and test acceptance if there is a conflict.

No production cutover or application-code migration is performed by generating this specification. No additional triage is required: the local status is ready-for-agent.

## Comments

2026-10-02: Expanded the initial migration outline into the full to-spec template, preserving the approved publication rules, existing stable endpoints and unrelated workspace edits. Proposed the running-Worker/browser acceptance seam to the user for an expectation check; absent a different preference, retain the complete-flow approach already discussed.
