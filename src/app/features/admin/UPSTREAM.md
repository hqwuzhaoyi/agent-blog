# Admin component provenance

Source: [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), commit `e16c87f213a5ba5e45964e9b67c792105ec74d26`, obtained with the agent-reach GitHub/gh backend. Exact MIT license is retained in `LICENSE.shadcn-admin`.

The following upstream implementations are copied into this feature, with import paths changed to feature-local paths:

| Local file | Actual upstream source | Adaptation |
| --- | --- | --- |
| `ui/sidebar.tsx` | `src/components/ui/sidebar.tsx` | Actual SidebarProvider/Sidebar/Rail/Trigger/Inset/Menu components and mobile Sheet logic; accessibility labels translated; mobile Sheet close explicitly restores focus to the external SidebarTrigger (upstream uses a trigger outside Dialog context). |
| `ui/button.tsx`, `ui/badge.tsx` | `src/components/ui/button.tsx`, `badge.tsx` | Radix Slot and class-variance-authority variants retained. |
| `ui/card.tsx`, `ui/table.tsx`, `ui/input.tsx`, `ui/textarea.tsx` | `src/components/ui/card.tsx`, `table.tsx`, `input.tsx`, `textarea.tsx` | Implementations retained. |
| `ui/separator.tsx`, `ui/collapsible.tsx`, `ui/skeleton.tsx` | Matching `src/components/ui/*` files | Implementations retained. |
| `ui/sheet.tsx` | `src/components/ui/sheet.tsx` | Real Radix Dialog/Sheet portal, overlay and content; neutral admin portal scope and translated close label. |
| `ui/tooltip.tsx`, `ui/dropdown-menu.tsx`, `ui/avatar.tsx` | Matching `src/components/ui/*` files | Real Radix primitives; content portals receive admin token scope. |
| `hooks/use-mobile.tsx` | `src/hooks/use-mobile.tsx` | Actual useSyncExternalStore/media-query implementation retained. |
| `layout/header.tsx`, `layout/main.tsx` | Matching `src/components/layout/*` files | Original fixed header, scroll offset, SidebarTrigger and Separator structure; removed enlarged mobile trigger. |
| `layout/nav-group.tsx`, `layout/types.ts` | Matching `src/components/layout/*` files | Original SidebarMenu/links/collapsibles/dropdowns; exact root navigation and trailing-slash normalization. |
| `layout/app-sidebar.tsx` | `src/components/layout/app-sidebar.tsx` | Actual Sidebar/Header/Content/Footer/Rail structure retained; template teams/demo navigation replaced with this site's four business destinations and icon rail. |
| `layout/nav-user.tsx` | `src/components/layout/nav-user.tsx` | Original Avatar/Dropdown/SidebarMenu structure retained. Actual Agent Operator label and real logout replace fictional email, avatar, billing/upgrade/notification and demo SignOutDialog. |

`ui/utils.ts` now uses actual clsx + tailwind-merge behavior. `Layout.tsx` composes these source components; the centered Card login adapts `src/features/auth/sign-in/index.tsx` without Clerk or fictional account creation. Existing reviewer HTTP/session functions are unchanged.

`Lists.tsx` adapts the TasksTable/DataTableToolbar/DataTablePagination composition to server-backed filters and bounded server pagination, using copied Table/Input/Button/Badge components. It does not copy TanStack Table state or demo task data. Source rows, title, date, status and pagination totals come from the real reviewer JSON response; no bulk publication is offered.

`Detail.tsx` and `Other.tsx` use the copied Button/Card/Badge/Separator primitives with Agent Blog's existing full-preview/edit/conflict/audit/podcast/settings behavior. They are business-specific pages, not upstream demos. The shared article preview retains reading typography while chrome uses scoped neutral shadcn-admin tokens and 14px text. Portal tokens are also scoped, so public green reading styles cannot recolor admin Sheets or menus.

## Request-state and mobile review Tabs batch (2026-10-03)

`ui/tabs.tsx` is the complete `src/components/ui/tabs.tsx` implementation from the same upstream commit above, with only its utils import redirected locally. It uses `@radix-ui/react-tabs` Root/List/Trigger/Content for linked IDs, keyboard focus and selection. The package dependency is managed by the parent agent.

`Detail.tsx` composes controlled Tabs and force-mounted Contents. Existing responsive CSS hides only the inactive mobile panel; both desktop panels remain visible. The stored preview, editor nodes, local draft, TanStack dirty-navigation guard and revision-bound approval remain page-owned. Source panels are not replaced by motion wrappers or conditional unmounts.

`request-state.tsx` is a project-owned presentation adapter over the existing shadcn Button/Skeleton and Lucide icons. It presents exactly one loading/error/empty state; pages own their fetch and retry callbacks. Detail loading waits for both review and actual audit records before presenting the complete workbench. The adapter neither fetches data nor grants any approval authority.

`test/admin-component-browser.sh` checks local-only session-scoped mocked GET failures/recovery for lists, episodes, initial review and audit, plus desktop dual panels, mobile Arrow/Home/End tabs, aria relationships, mounted preview/editor and dirty approval disabling. It logs into the isolated preview, forbids content-write requests in the mock, and reuses the ego-browser goal task space; the separate final cleanup command closes it after the full goal is verified. It makes no production requests or saved-draft/publication changes.
