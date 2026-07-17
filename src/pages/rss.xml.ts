import rss from "@astrojs/rss";
import { getPublishedReviews } from "@/lib/reviews";
import { siteConfig } from "@/site.config";
import { reviewPath } from "@/lib/paths";

export async function GET(context: { site?: URL }) {
  const reviews = await getPublishedReviews();

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: reviews.map((review) => ({
      title: review.data.title,
      description: review.data.summary,
      pubDate: review.data.date,
      link: reviewPath(review.id),
      categories: review.data.platforms,
    })),
    customData: `<language>${siteConfig.language}</language>`,
  });
}
