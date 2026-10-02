import { describe, expect, test } from "vitest";
import { prepareEpisode } from "../scripts/lib/episode-publication.mjs";
function episode() {
  return { day: "2026-10-02", source: { title: "早咖啡", disclosure: "AI 合成语音" },
    publication: { summary: "本期解读", chapters: [0, 1, 2, 3].map((section) => ({ title: `章节 ${section}`, section })) },
    parts: [0, 1, 2, 3].map((section) => ({ section, seconds: 4, pause_ms: 500 })),
    duration: 24, audio: Buffer.from("mixed audio"), shownotes: "## 来源\nhttps://example.com/", };
}
describe("Automatic episode preparation", () => {
  test("uses measured segment offsets, exact bytes, and content-addressed audio URLs", () => {
    const result = prepareEpisode(episode());
    expect(result.data.chapters.map((chapter) => chapter.start)).toEqual([3, 7.5, 12, 16.5]);
    expect(result.data.audio.length).toBe(11);
    expect(result.data.audio.url).toMatch(/^https:\/\/blog\.wuzhaoyi\.xyz\/audio\/2026-10-02\/[a-f0-9]{64}\.mp3$/);
    expect(result.data.draft).toBe(false);
    expect(prepareEpisode(episode()).audioKey).toBe(result.audioKey);
  });
  test("does not publish mismatched audio or invented chapter offsets", () => {
    expect(() => prepareEpisode({ ...episode(), duration: 100 })).toThrow("Manifest does not match");
    const input = episode(); input.publication.chapters[2].section = 9;
    expect(() => prepareEpisode(input)).toThrow("manifest sections");
  });
  test("does not publish archive-only credits or private production details", () => {
    for (const shownotes of ["MEDIA:/Users/shawn/file.mp3", "GPU 192.168.2.43", "配乐署名：Funkorama"]) {
      expect(() => prepareEpisode({ ...episode(), shownotes })).toThrow("archive-only");
    }
  });
  test("does not permit missing chapters or impossible dates", () => {
    const input = episode(); input.publication.chapters.reverse();
    expect(() => prepareEpisode(input)).toThrow();
    expect(() => prepareEpisode({ ...episode(), day: "2026-02-30" })).toThrow("Invalid episode day");
  });
});
