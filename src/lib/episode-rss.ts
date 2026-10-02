import { siteConfig } from "../site.config";
import { getEpisodes } from "./episodes";
import { episodePath } from "./paths";

import type { ContentDatabase } from "./content-store";
export async function episodeRssItems(db?: ContentDatabase) {
  return (await getEpisodes(false, db)).map((episode) => ({
    title: episode.data.title,
    description: `${episode.data.summary}\n\n${siteConfig.episodes.disclosure}`,
    pubDate: episode.data.date,
    link: episodePath(episode.id),
    categories: ["早咖啡"],
    enclosure: episode.data.audio,
    customData: `<itunes:duration>${Math.round(episode.data.duration)}</itunes:duration>`,
  }));
}
