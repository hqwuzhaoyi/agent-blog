# Admin fidelity comparison

Captured against the isolated local preview, using the same existing reviewer data. The running preview received no draft save or approval requests during this UI correction; HTTP tests used isolated in-memory SQLite. Original backend contracts, reviewer cookie boundary and Article sanitizer remain unchanged.

| Surface | Before | After | Viewport |
| --- | --- | --- | --- |
| Pending workbench | [before-list-1440.png](before-list-1440.png) | [after-list-1440.png](after-list-1440.png) | 1440 × 1000 |
| Mobile pending workbench | [before-list-390.png](before-list-390.png) | [after-list-390.png](after-list-390.png) | 390 × 844 |
| Login | [before-login-1440.png](before-login-1440.png) | [after-login-1440.png](after-login-1440.png) | 1440 × 1000 |

Additional checked images: [mobile Sheet](after-drawer-390.png), [desktop review](after-detail-1440.png), [mobile preview](after-detail-390.png), [mobile information](after-info-390.png), [mobile empty state](after-empty-390.png), [dark settings](after-settings-dark-390.png).

Actual source provenance and retained MIT license: [UPSTREAM.md](../../../../src/app/features/admin/UPSTREAM.md).

Observed checks:

- Signed reviewer login and actual operator-menu logout both work.
- Desktop collapsible source Sidebar rail changes to 66px inset icon width; selected root destination is exact.
- Admin chrome computes to 14px; shared article preview computes to 17px. Neutral default surfaces and outline boundaries have no public green/warm style leakage.
- Mobile Radix Sheet computes to 14px and solid neutral background, traps focus, closes on navigation/Escape and restores focus to the external SidebarTrigger.
- Keyword filtering uses the backend and displays a centered usable empty state. The table scrolls internally; the page remains at the 390px viewport width.
- Unsaved title changes disable approval. SPA browser Back presents the discard dialog; cancel preserves the edited value and explicit discard returns to the list. No draft was saved or approved for this check.
- Mobile preview/information tabs and safe-area action bar remain usable. Detail width remains390px; long stored revision strings wrap safely.
- Dark settings retain neutral zinc tokens and visible text; page width375px is within the390px viewport.
- TypeScript check and the existing two admin HTTP/SQLite tests pass.

The task-owned `admin-fidelity` headless browser was closed after capture. Foundation's root-managed local preview remains running for visual review.
