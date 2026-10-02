import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "../features/admin/Layout";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "工作日志审核" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});
