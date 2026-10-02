import { createFileRoute } from "@tanstack/react-router";
import { Button } from "../features/public/beui/button";
import { NotebookPen } from "lucide-react";
import { getPublicReviews } from "../server/public-data";
import { EmptyContent, ReviewRow } from "../features/public/content";
import { text } from "../features/public/locale";
import { siteConfig } from "../site";

const description = text(
  "记录项目中的重要进展、解决的问题，以及人与 Agent 共同完成的工作。",
  "Progress, problems solved, and work completed together with agents.",
);

export const Route = createFileRoute("/agent-blog/reviews/")({
  loader: () => getPublicReviews(),
  head: () => ({
    meta: [
      { title: `${siteConfig.nav.latest} · ${siteConfig.title}` },
      { name: "description", content: description },
    ],
    links: [{ rel: "canonical", href: "https://blog.wuzhaoyi.xyz/agent-blog/reviews/" }],
  }),
  pendingComponent: () => <p role="status" className="py-12">{text("正在加载工作日志…", "Loading worklogs…")}</p>,
  errorComponent: ({ reset }) => (
    <section className="py-12">
      <p role="alert">{text("工作日志暂时无法加载。", "Worklogs could not be loaded.")}</p>
      <Button variant="outline" onClick={reset} className="mt-3">
        {text("重试", "Try again")}
      </Button>
    </section>
  ),
  component: Worklogs,
});

function Worklogs() {
  const reviews = Route.useLoaderData();
  return (
    <section className="public-list-page worklog-page">
      <header className="public-page-heading">
        <p className="eyebrow">NOTES ON PROGRESS</p>
        <h1>{siteConfig.nav.latest}</h1>
        <p>{description}</p>
        <span className="page-total"><NotebookPen size={16} aria-hidden="true" />{reviews.length} {text("篇工作日志", "worklogs")}</span>
      </header>
      {reviews.length ? (
        <ul className="review-list">{reviews.map(review => <ReviewRow key={review.id} review={review} />)}</ul>
      ) : <EmptyContent>{siteConfig.home.empty}</EmptyContent>}
    </section>
  );
}
