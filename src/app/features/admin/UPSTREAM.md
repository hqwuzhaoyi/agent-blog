Source: satnaing/shadcn-admin, MIT (see LICENSE.shadcn-admin).

Copied table.tsx and input.tsx retain upstream component implementations; imports adapted to local utils.
Layout.tsx adapts components/layout/header.tsx's scroll offset and fixed header, main.tsx's constrained content, and app-sidebar/nav-group's sidebar navigation organization and mobile close behavior. Team/account/demo dashboard and Clerk are omitted. Lists.tsx adapts TasksTable's filter/table/pagination structure with real server pagination, no bulk approval or demo tasks.
