import rss from "@astrojs/rss";
import { episodeRssItems } from "@/lib/episode-rss";
import { siteConfig } from "@/site.config";

export async function GET(context: { site?: URL; locals: App.Locals }) {
  return rss({
    title: siteConfig.episodes.title,
    description: siteConfig.episodes.description,
    site: new URL(import.meta.env.BASE_URL, context.site),
    xmlns: { itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd" },
    items: await episodeRssItems(context.locals.contentDB),
    customData: `<language>${siteConfig.language}</language><itunes:explicit>false</itunes:explicit>`,
  });
}
