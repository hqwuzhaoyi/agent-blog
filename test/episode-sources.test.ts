import { expect, test } from "vitest";
import { mergeEpisodeSources } from "../src/app/features/public/episode-sources";
import type {
  EpisodeMaterial,
  EpisodeTimelineItem,
} from "../cloudflare/content-models";
const material: EpisodeMaterial = {
  id: "a".repeat(24),
  kind: "x",
  author: "Builder",
  url: "https://x.com/builder/status/1",
  summary: "Legacy topic",
  linkKind: "item",
  chapterStart: 12,
};
const entry: EpisodeTimelineItem = {
  id: "b".repeat(24),
  kind: "x",
  author: "Builder",
  url: material.url,
  summary: "中文摘要。",
  text: "Original post",
  linkKind: "item",
  selected: false,
};
test("merges by normalized URL even when legacy IDs differ, retaining narration and source metadata", () => {
  const result = mergeEpisodeSources(
    [material],
    [
      {
        ...entry,
        url: entry.url + "#post",
        publishedAt: "2026-10-02T12:00:00Z",
      },
    ],
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    selected: true,
    summary: "中文摘要。",
    text: "Original post",
    chapterStart: 12,
    publishedAt: "2026-10-02T12:00:00Z",
  });
  expect(material.summary).toBe("Legacy topic");
  expect(entry.selected).toBe(false);
});
test("selected sources keep episode order ahead of unselected updates without dropping missing feed entries", () => {
  const other = {
    ...entry,
    id: "c".repeat(24),
    url: "https://example.com/other",
  };
  const extra = {
    ...material,
    id: "d".repeat(24),
    url: "https://example.com/manual",
  };
  const result = mergeEpisodeSources([extra, material], [other, entry]);
  expect(result.map((item) => item.url)).toEqual([
    extra.url,
    material.url,
    other.url,
  ]);
  expect(result.map((item) => item.selected)).toEqual([true, true, false]);
});
test("supports episodes with only legacy materials, only timeline, or neither", () => {
  expect(mergeEpisodeSources([material])[0]).toMatchObject({
    summary: material.summary,
    chapterStart: 12,
    selected: true,
  });
  expect(mergeEpisodeSources(undefined, [entry])).toEqual([entry]);
  expect(mergeEpisodeSources()).toEqual([]);
});
