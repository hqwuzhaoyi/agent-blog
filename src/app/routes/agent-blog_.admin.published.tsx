import { createFileRoute } from "@tanstack/react-router";
import { ReviewList } from "../features/admin/Lists";
export const Route = createFileRoute("/agent-blog_/admin/published")({
  component: () => <ReviewList published />,
});
