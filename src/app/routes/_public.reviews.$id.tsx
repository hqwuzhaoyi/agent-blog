import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedReview } from "../server/public-data";
import { Article } from "../components/Article";
import { siteConfig, siteOrigin } from "../site";
export const Route = createFileRoute("/_public/reviews/$id")({
  loader: async ({ params }) => {
    const review = await getPublishedReview({ data: params.id });
    if (!review) throw notFound();
    return review;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.data.title} · ${siteConfig.title}` },
            { name: "description", content: loaderData.data.summary },
            { property: "og:title", content: loaderData.data.title },
            { property: "og:description", content: loaderData.data.summary },
            { property: "og:type", content: "article" },
          ],
          links: [
            {
              rel: "canonical",
              href: `${siteOrigin}/reviews/${loaderData.id}/`,
            },
          ],
        }
      : {},
  component: ReviewPage,
});
function ReviewPage() {
  const review = Route.useLoaderData();
  return (
    <div className="public-detail pt-[45px] mobile:pt-7">
      <Link
        to="/reviews"
        className="detail-back group mb-7 inline-flex items-center gap-2 text-[11px] text-muted-foreground mobile:mb-[23px] mobile:text-[10px]"
      >
        <ArrowLeft
          className="transition-transform duration-[160ms] ease-[var(--ease-out)] pointer-hover:group-hover:-translate-x-[3px] motion-reduce:transform-none motion-reduce:transition-none"
          size={14}
          aria-hidden="true"
        />
        {siteConfig.nav.latest}
      </Link>
      <Article
        title={review.data.title}
        summary={review.data.summary}
        date={review.data.date.toISOString()}
        source={review.data.source}
        platforms={review.data.platforms}
        html={review.html}
      />
    </div>
  );
}
