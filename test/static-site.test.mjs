import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

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
    expect(home).toContain(`href="${reviewPath}"`);
    expect(archive).toContain(title);
    expect(archive).toContain(`href="${reviewPath}"`);
    expect(article).toContain(title);
    expect(article).toContain(`<link rel="canonical" href="${reviewUrl}">`);
    expect(rss).toContain(`<link>https://blog.wuzhaoyi.xyz/agent-blog/</link>`);
    expect(rss).toContain(`<guid isPermaLink="true">${reviewUrl}</guid>`);
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
