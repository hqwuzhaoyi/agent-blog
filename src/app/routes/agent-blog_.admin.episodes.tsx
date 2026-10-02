import { createFileRoute } from "@tanstack/react-router";
import { Episodes } from "../features/admin/Other";
export const Route = createFileRoute("/agent-blog_/admin/episodes")({
  component: () => <Episodes />,
});
