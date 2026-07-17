#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { themeCatalog } from "../src/themes/catalog.mjs";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const astro = join(root, "node_modules", ".bin", "astro");
const configPath = join(root, "src", "blog.config.json");
const original = await readFile(configPath, "utf8");
const preferences = JSON.parse(original);
const expectedTitle = "The operating model is locked";
const expectedReviewPath = "/agent-blog/reviews/2026-07-16/";
const expectedArchivePath = "/agent-blog/archive/";
const expectedReviewUrl = `https://blog.wuzhaoyi.xyz${expectedReviewPath}`;
const buildsPath = join(root, ".scratch", "theme-builds");

function requireText(output, expected, context) {
  if (!output.includes(expected)) {
    throw new Error(`${context} did not contain ${JSON.stringify(expected)}`);
  }
}

try {
  for (const { id } of themeCatalog) {
    await writeFile(configPath, `${JSON.stringify({ ...preferences, theme: id }, null, 2)}\n`);
    const outDir = join(buildsPath, id);
    await execFileAsync(astro, ["build", "--outDir", outDir], { cwd: root });

    const [home, archive, article, rss] = await Promise.all([
      readFile(join(outDir, "index.html"), "utf8"),
      readFile(join(outDir, "archive", "index.html"), "utf8"),
      readFile(join(outDir, "reviews", "2026-07-16", "index.html"), "utf8"),
      readFile(join(outDir, "rss.xml"), "utf8"),
    ]);

    requireText(home, `data-theme="${id}"`, `${id} home page`);
    requireText(home, `<html lang="${preferences.language}"`, `${id} home page`);
    requireText(home, `href="${expectedReviewPath}"`, `${id} home page`);
    requireText(home, `href="${expectedArchivePath}"`, `${id} home page`);
    requireText(home, "human before publication", `${id} home page`);
    requireText(home, "<nav aria-label=", `${id} home page`);
    requireText(home, "<main>", `${id} home page`);
    requireText(home, "<footer", `${id} home page`);
    if ((home.match(/rel="stylesheet"/g) ?? []).length !== 1) {
      throw new Error(`${id} home page did not load exactly one Theme stylesheet`);
    }
    requireText(archive, expectedTitle, `${id} archive`);
    requireText(article, expectedTitle, `${id} article`);
    requireText(article, "Privacy moved before Git", `${id} article`);
    requireText(article, 'href="/agent-blog/"', `${id} article`);
    requireText(article, `href="${expectedArchivePath}"`, `${id} article`);
    requireText(article, "human before publication", `${id} article`);
    requireText(article, `<link rel="canonical" href="${expectedReviewUrl}">`, `${id} article`);
    requireText(rss, "https://blog.wuzhaoyi.xyz/agent-blog/", `${id} RSS`);
    requireText(rss, expectedReviewPath, `${id} RSS`);
  }
} finally {
  await writeFile(configPath, original);
  await rm(buildsPath, { recursive: true, force: true });
}

console.log(`Verified ${themeCatalog.length} Theme builds.`);
