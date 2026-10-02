import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { output: { type: "string" }, base: { type: "string", default: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/" } } });
if (!values.output) throw new Error("Usage: node prepare-feed.mjs --output <episode directory>/feed.json [--base <feed base URL>]");
const feeds = await Promise.all(["podcasts", "x", "blogs"].map(async (type) => {
  const url = new URL(`feed-${type}.json`, values.base.endsWith("/") ? values.base : `${values.base}/`).href;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data[type])) throw new Error(`Missing ${type} array`);
    return { type, url, data };
  } catch (error) { return { type, url, error: error.message }; }
}));
if (feeds.every((feed) => feed.error)) throw new Error("All material feeds failed; no new episode data was saved.");
const output = { fetchedAt: new Date().toISOString(), podcasts: [], x: [], blogs: [], feeds: {}, errors: [] };
for (const feed of feeds) {
  output.feeds[feed.type] = { url: feed.url, generatedAt: feed.data?.generatedAt ?? null, error: feed.error ?? null };
  if (feed.error) output.errors.push(`${feed.type}: ${feed.error}`);
  else {
    output[feed.type] = feed.data[feed.type];
    output.errors.push(...(feed.data.errors ?? []).map((error) => `${feed.type}: ${error}`));
  }
}
output.stats = { podcastEpisodes: output.podcasts.length, xBuilders: output.x.length, totalTweets: output.x.reduce((sum, account) => sum + (account.tweets?.length ?? 0), 0), blogPosts: output.blogs.length };
const path = resolve(values.output);
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(output, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ path, stats: output.stats, feeds: output.feeds, errors: output.errors }, null, 2));
