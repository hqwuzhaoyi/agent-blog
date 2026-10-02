import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "../features/admin/Other";
export const Route = createFileRoute("/agent-blog_/admin/settings")({
  component: () => <Settings />,
});
