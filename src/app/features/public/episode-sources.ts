import type {
  EpisodeMaterial,
  EpisodeTimelineItem,
} from "../../../../cloudflare/content-models";

export type EpisodeSource = EpisodeTimelineItem & { chapterStart?: number };

function sourceKey(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

/** One card per public URL, with selected sources first in episode order. */
export function mergeEpisodeSources(
  materials: EpisodeMaterial[] = [],
  timeline: EpisodeTimelineItem[] = [],
): EpisodeSource[] {
  const entries = new Map<string, EpisodeSource>();
  for (const item of timeline) entries.set(sourceKey(item.url), { ...item });
  const selected = new Map<string, EpisodeSource>();
  for (const material of materials) {
    const key = sourceKey(material.url);
    const entry = entries.get(key);
    selected.set(key, {
      ...entry,
      ...material,
      // The timeline's concise Chinese summary may be richer than a legacy topic label.
      summary: entry?.summary || material.summary,
      selected: true,
    });
    entries.delete(key);
  }
  const remaining = [...entries.values()];
  return [
    ...selected.values(),
    ...remaining.filter((item) => item.selected),
    ...remaining.filter((item) => !item.selected),
  ];
}
