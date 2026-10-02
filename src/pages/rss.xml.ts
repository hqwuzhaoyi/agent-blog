import { episodeRssItems } from "@/lib/episode-rss";
import rss from "@astrojs/rss";
import { getPublishedReviews } from "@/lib/reviews";
import { siteConfig } from "@/site.config";
import { reviewPath } from "@/lib/paths";

export async function GET(context: { site?: URL; locals: App.Locals }) {
  const reviews = await getPublishedReviews(context.locals.contentDB);

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: new URL(import.meta.env.BASE_URL, context.site),
    xmlns: { itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd" },
    items: [...reviews.map((review) => ({
      title: review.data.title,
      description: review.data.summary,
      pubDate: review.data.date,
      link: reviewPath(review.id),
      categories: review.data.platforms,
    })), ...await episodeRssItems(context.locals.contentDB)].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()),
    customData: `<language>${siteConfig.language}</language>`,
  });
}
