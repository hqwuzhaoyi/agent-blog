import { expect, test } from "vitest";
import { validateEpisodeBriefs } from "../skills/morning-coffee/scripts/episode-briefs.mjs";
import { prepareEpisode } from "../scripts/lib/episode-publication.mjs";

function input() {
  const url = "https://example.com/news";
  const summary = "作者介绍了新的开发工具。";
  const source = {
    title: "早咖啡",
    disclosure: "AI 合成语音",
    segments: [
      "开场。",
      "主话题。",
      `接下来是今天的短讯。${summary}`,
      "尾声。",
    ],
    sources: [{ url, topic: summary }],
    briefs: { section: 2, urls: [url] },
  };
  return {
    source,
    publication: {
      summary: "本期摘要",
      chapters: ["开场", "主线", "短讯", "尾声"].map((title, section) => ({
        title,
        section,
      })),
      timeline: [{ url, summary }],
      materials: [{ url, summary, chapterSection: 2 }],
    },
    parts: source.segments.map((text, section) => ({
      section,
      text,
      seconds: 4,
      pause_ms: 500,
    })),
  };
}
test("requires both narrated summaries and a matching chapter, before and after synthesis", () => {
  const data = input();
  expect(validateEpisodeBriefs({ ...data, parts: undefined })).toEqual({
    section: 2,
    sources: 1,
    measured: false,
  });
  expect(validateEpisodeBriefs(data)).toEqual({
    section: 2,
    sources: 1,
    measured: true,
  });
  const full = data.parts[2];
  data.parts.splice(
    2,
    1,
    { ...full, text: full.text.slice(0, 5) },
    { ...full, text: full.text.slice(5) },
  );
  expect(validateEpisodeBriefs(data).measured).toBe(true);
});
test("rejects a website-only summary or a chapter pointing at unrelated speech", () => {
  const data = input();
  data.source.segments[2] = "本期就到这里。";
  expect(() => validateEpisodeBriefs(data)).toThrow(
    "included in the spoken segment",
  );
  const wrongChapter = input();
  wrongChapter.publication.chapters[2].section = 1;
  expect(() => validateEpisodeBriefs(wrongChapter)).toThrow("one 短讯 chapter");
});
test("rejects missing sources, chapter associations and stale or incomplete synthesis", () => {
  const noSources = input();
  noSources.source.sources = [];
  expect(() => validateEpisodeBriefs(noSources)).toThrow("episode sources");
  const noChapter = input();
  noChapter.publication.materials[0].chapterSection = 1;
  expect(() => validateEpisodeBriefs(noChapter)).toThrow("material cards");
  const stale = input();
  stale.parts[2].text = "旧口播。";
  expect(() => validateEpisodeBriefs(stale)).toThrow("complete narration");
  const absent = input();
  absent.parts.splice(2, 1);
  expect(() => validateEpisodeBriefs(absent)).toThrow("complete narration");
});
test("publication applies the measured short-news contract without changing legacy preparation", () => {
  const data = input();
  const args = {
    ...data,
    day: "2026-10-11",
    duration: 24,
    audio: Buffer.from("audio"),
    shownotes: "公开正文。",
  };
  expect(prepareEpisode(args).data.chapters[2]).toEqual({
    title: "短讯",
    start: 12,
  });
  data.parts[2].text = "旧口播。";
  expect(() => prepareEpisode(args)).toThrow("complete narration");
});
