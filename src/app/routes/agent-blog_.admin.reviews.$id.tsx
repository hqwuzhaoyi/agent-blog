import { createFileRoute } from "@tanstack/react-router";
import { ReviewDetail } from "../features/admin/Detail";
export const Route = createFileRoute("/agent-blog_/admin/reviews/$id")({
  component: () => <ReviewDetail id={Route.useParams().id} />,
});
