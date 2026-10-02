import { getCollection, type CollectionEntry } from "astro:content";
import { episodePath } from "./paths";

export async function getEpisodes(includeDrafts = false) {
  const episodes = await getCollection("episodes", ({ data }) => includeDrafts || !data.draft);
  return episodes.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function timestamp(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60).toString().padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}

export function presentEpisode(episode: CollectionEntry<"episodes">, locale: string) {
  return {
    ...episode.data,
    id: episode.id,
    url: episodePath(episode.id),
    dateTime: episode.data.date.toISOString(),
    displayDate: new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(episode.data.date),
    displayDuration: timestamp(episode.data.duration),
    chapters: episode.data.chapters.map((chapter, index) => ({ ...chapter, id: `chapter-${index + 1}`, timestamp: timestamp(chapter.start) })),
  };
}

export type EpisodePresentation = ReturnType<typeof presentEpisode>;
