# React migration verification

Completed 2026-10-02 by the sol services, foundation, public UI and reviewer UI team, integrated by the primary agent.

## Result

React/TanStack Start replaces Astro. Public controls adapt beUI source; the reviewer workbench adapts shadcn-admin source. The live domain remains https://blog.wuzhaoyi.xyz/agent-blog/ and reviewer entry remains https://blog.wuzhaoyi.xyz/agent-blog/admin/.

Current Worker version: `0a2e7093-fbe2-46db-bf48-f4ad6f7f66de`. Compatible pre-React rollback target: `39aaeb49-3178-4c13-a6c3-9532863d3332`. Both deployment and rollback metadata were inspected without recreating D1/R2.

## Evidence

- TypeScript check passes; 11 test files / 36 tests pass; dependency audit reports zero vulnerabilities.
- The running isolated Worker passes public SSR/canonical/privacy, audio HEAD/ETag/ranges, real revision approval/audit/409 conflicts, and upload/automatic publication/retry/feed-refresh contracts.
- The browser regression passes shared audio across routes and history, measured chapters without hash/scroll jumps, combined archive filters, 390px layouts, reduced motion, Sheet drag/focus and public-to-admin audio continuity. Role matching tolerates presentation whitespace.
- Real isolated browser reviewer flows pass login, full sanitized preview, private save, explicit revision approval, actual audit, unsaved Back navigation, real concurrent409/refresh/reapprove, failed422 save/edit retention/retry, mobile workbench, appearance and logout.
- Production public pages and reviewer entry return200; unauthenticated reviewer API and invalid credentials return401; existing producer credentials still authorize read requests. Both Worker secret names remain present.
- Production RSS retains5 combined items and2 podcast items. GUIDs, publication dates and enclosures exactly match captured pre-cutover feeds; both audio HEAD/Range checks pass. Current D1 content counts are3 reviews and2 episodes, matching that baseline. No test content or extra deliveries were published in production.
- Production artifacts exclude local secret files and preview MP3s; deployment wrapper validates canonical production bindings before upload. Local acceptance rejects remote origins and seeds only isolated resources.

## Operator workflow

Worklogs are private drafts until the operator confirms the current saved revision in the workbench. Editing preserves the previously published revision. Podcast publication still uses the existing Hermes API command without PRs, builds or application deployment. Existing operator form POSTs and read-only preview capabilities remain compatible.

The 14 local tickets include completed execution records. The source specification remains a historical statement of the approved migration scope.

Production browser acceptance found an inherited assets-first routing mismatch: the old all-worker-first setting sent JS/CSS to SSR. The final deployment uses narrow Worker-first paths and explicit static resource delegation. `npm run check:ui` checks real SSR resource URLs and MIME types as a regression, and a production browser verified reviewer hydration and real episode playback after the fix.

The host Homebrew Node library chain changed during execution; deployment used the existing mise Node 26.8.2. The existing morning job prompt selects that runtime per command without changing its schedule or delivery. Global package installations were not altered.
