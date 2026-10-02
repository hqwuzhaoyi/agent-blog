import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import preferences from "../src/blog.config.json" with { type: "json" };

const dist = join(process.cwd(), "dist");

async function builtFile(path) {
  return readFile(join(dist, path), "utf8");
}

describe("Static Site seam", () => {
  test("publishes recent, archive, article, and RSS routes with stable production URLs", async () => {
    const [home, archive, article, rss] = await Promise.all([
      builtFile("index.html"),
      builtFile("archive/index.html"),
      builtFile("reviews/2026-07-16/index.html"),
      builtFile("rss.xml"),
    ]);

    const title = "The operating model is locked";
    const reviewPath = "/agent-blog/reviews/2026-07-16/";
    const reviewUrl = `https://blog.wuzhaoyi.xyz${reviewPath}`;

    expect(home).toContain(title);
    expect(home).toContain("Agent 工作日志");
    expect(home).toContain("记录持续推进的项目中，由人与 Agent 共同完成的重要工作。");
    expect(home).toContain(`<html lang="${preferences.language}" data-theme="${preferences.theme}">`);
    if (preferences.theme === "quiet-minimal") {
      expect(home).toContain('<section class="minimal-reviews">');
    }
    expect(home).toContain(`href="${reviewPath}"`);
    expect(archive).toContain(title);
    expect(archive).toContain(`href="${reviewPath}"`);
    expect(article).toContain(title);
    expect(article).toContain(`<link rel="canonical" href="${reviewUrl}">`);
    expect(rss).toContain(`<link>https://blog.wuzhaoyi.xyz/agent-blog/</link>`);
    expect(rss).toContain(`<guid isPermaLink="true">${reviewUrl}</guid>`);
  });

  test("keeps the product-site introduction out of the blog home page", async () => {
    const home = await builtFile("index.html");

    for (const productCopy of [
      "Machine work, human edited",
      "The work that survived the night.",
      "PUBLICATION NOTE / 001",
      "Visible messages",
      "NO CHAIN OF THOUGHT",
    ]) {
      expect(home).not.toContain(productCopy);
    }
  });

  test("keeps Agent Source attribution on each review instead of the site footer", async () => {
    const [home, codexArticle] = await Promise.all([
      builtFile("index.html"),
      builtFile("reviews/2026-07-18/index.html"),
    ]);

    expect(home).not.toContain("报告来源 OpenClaw / Gateway 01");
    expect(codexArticle).toContain("Codex / Local");
  });

  test("built public output contains none of the adversarial private fixture values", async () => {
    const output = (
      await Promise.all([
        builtFile("index.html"),
        builtFile("archive/index.html"),
        builtFile("reviews/2026-07-16/index.html"),
        builtFile("rss.xml"),
      ])
    ).join("\n");

    for (const privateValue of [
      "Acme Private",
      "owner@example.com",
      "/Users/alice/private-work",
      "not-a-real-credential",
    ]) {
      expect(output).not.toContain(privateValue);
    }
  });
});

describe("Episode publication boundary", () => {
  test("publishes the episode entry and feed without exposing preview drafts or local audio URLs", async () => {
    const [home, episodes, feed, combinedFeed] = await Promise.all([
      builtFile("index.html"), builtFile("episodes/index.html"),
      builtFile("episodes/rss.xml"), builtFile("rss.xml"),
    ]);
    expect(home).toContain('href="/agent-blog/episodes/"');
    expect(episodes).toContain("早咖啡");
    expect(episodes).toContain('href="/agent-blog/episodes/rss.xml"');
    expect(feed).toContain("http://www.itunes.com/dtds/podcast-1.0.dtd");
    for (const output of [episodes, feed, combinedFeed]) {
      expect(output).not.toContain("当AI替你决定什么值得打断你");
      expect(output).not.toContain("preview-audio");
    }
  });
});
