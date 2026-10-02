import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: async () => new Response("root SSR") } }));
vi.mock("../src/app/features/admin/preview-server", () => ({ handleReadOnlyPreview: async () => new Response("private preview") }));
import worker from "../cloudflare/react-entry";
import { normalizeEpisodeData } from "../cloudflare/site-urls";

function bindings() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("migrations/0001_content.sql", "utf8"));
  const CONTENT = {
    prepare(text: string) {
      const bound = (args: any[]) => ({
        bind: (...values: any[]) => bound(values),
        async first() { return sql.prepare(text).get(...args) ?? null; },
        async all() { return { results: sql.prepare(text).all(...args) }; },
        async run() { return { meta: { changes: Number(sql.prepare(text).run(...args).changes) } }; },
      });
      return bound([]);
    },
    async batch(statements: any[]) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  return { CONTENT, PUBLIC_ORIGIN: "https://gitlog.si", SUBMIT_TOKEN: "isolated-submit", REVIEW_TOKEN: "isolated-review", ASSETS: { fetch: vi.fn(async () => new Response("asset")) }, AUDIO: { head: async () => ({ size: 100, httpMetadata: { contentType: "audio/mpeg" } }) } };
}
const call = (request: Request, env: any) => worker.fetch(request, env, {});
const hash = "a".repeat(64);

test("root SSR and static assets dispatch while old pages permanently redirect with query", async () => {
  const env = bindings();
  expect(await (await call(new Request("https://gitlog.si/"), env)).text()).toBe("root SSR");
  for (const [from, to] of [
    ["https://blog.wuzhaoyi.xyz/agent-blog/reviews/day/?revision=abc&token=view", "https://gitlog.si/reviews/day/?revision=abc&token=view"],
    ["https://blog.wuzhaoyi.xyz/rss.xml?subscriber=1", "https://gitlog.si/rss.xml?subscriber=1"],
    ["https://gitlog.si/agent-blog/episodes/rss.xml", "https://gitlog.si/episodes/rss.xml"],
    ["https://blog.wuzhaoyi.xyz/", "https://gitlog.si/"],
  ]) {
    const response = await call(new Request(from), env);
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(to);
  }
  expect(await (await call(new Request("https://blog.wuzhaoyi.xyz/agent-blog/assets/app.js"), env)).text()).toBe("asset");
  expect(env.ASSETS.fetch.mock.calls[0][0].url).toBe("https://blog.wuzhaoyi.xyz/assets/app.js");
});

test("legacy producer PUT retains method, authorization and body without cross-origin redirect", async () => {
  const env = bindings();
  const data = { title: "Legacy client", summary: "Full payload", date: "2026-10-02", source: "Hermes", platforms: ["Hermes"], highlights: 1 };
  const request = () => new Request("https://blog.wuzhaoyi.xyz/agent-blog/api/reviews/legacy", { method: "PUT", headers: { Authorization: `Bearer ${env.SUBMIT_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ data, body: "## Preserved body" }) });
  const response = await call(request(), env);
  expect(response.status).toBe(200);
  expect(response.headers.get("Location")).toBeNull();
  const result = await response.json();
  expect(result.status).toBe("draft");
  expect(result.previewUrl).toContain("https://gitlog.si/admin/reviews/legacy?");
  expect(result.url).toBe("https://gitlog.si/reviews/legacy/");
  const repeated = await (await call(request(), env)).json();
  expect(repeated.revision).toBe(result.revision);
  const login = await call(new Request("https://gitlog.si/admin/api/login", { method: "POST", headers: { Origin: "https://gitlog.si", "Content-Type": "application/json" }, body: JSON.stringify({ key: env.REVIEW_TOKEN }) }), env);
  expect(login.status).toBe(200);
  expect(login.headers.get("Set-Cookie")).toContain("Path=/admin/;");
  expect(login.headers.get("Set-Cookie")).not.toContain("/agent-blog/");
});

test("historical audio presentation is canonical without changing immutable input or external URLs", () => {
  const stored = { title: "Historical", audio: { url: `https://blog.wuzhaoyi.xyz/agent-blog/audio/2026-10-02/${hash}.mp3`, length: 100, type: "audio/mpeg" } };
  const presented = normalizeEpisodeData(stored, "https://gitlog.si");
  expect(presented.audio.url).toBe(`https://gitlog.si/audio/2026-10-02/${hash}.mp3`);
  expect(stored.audio.url).toContain("blog.wuzhaoyi.xyz/agent-blog/");
  expect(presented.audio.length).toBe(100);
  const external = { audio: { url: `https://external.example/agent-blog/audio/2026-10-02/${hash}.mp3` } };
  expect(normalizeEpisodeData(external, "https://gitlog.si").audio.url).toBe(external.audio.url);
});

test("production RSS preserves subscriber GUID while canonical link and enclosure use new root", async () => {
  const env = bindings();
  const data = { title: "Episode", summary: "Summary", date: "2026-10-02", duration: 30, disclosure: "AI voice", chapters: [{ title: "Opening", start: 0 }], audio: { url: `https://blog.wuzhaoyi.xyz/agent-blog/audio/2026-10-02/${hash}.mp3`, length: 100, type: "audio/mpeg" } };
  const publish = await call(new Request("https://blog.wuzhaoyi.xyz/agent-blog/api/episodes/2026-10-02", { method: "PUT", headers: { Authorization: `Bearer ${env.SUBMIT_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ data, body: "## Show notes" }) }), env);
  expect(publish.status).toBe(200);
  for (const path of ["/rss.xml", "/episodes/rss.xml"]) {
    const feed = await call(new Request("https://gitlog.si" + path), env);
    expect(feed.status).toBe(200);
    const xml = await feed.text();
    expect(xml).toContain('<guid isPermaLink="true">https://blog.wuzhaoyi.xyz/agent-blog/episodes/2026-10-02/</guid>');
    expect(xml).toContain('<link>https://gitlog.si/episodes/2026-10-02/</link>');
    expect(xml).toContain(`<enclosure url="https://gitlog.si/audio/2026-10-02/${hash}.mp3" length="100" type="audio/mpeg"/>`);
    expect(xml).toContain("<itunes:duration>30</itunes:duration>");
  }
});


test("acceptance on the established domain does not redirect to the pending domain", async () => {
  const env = { ...bindings(), PUBLIC_ORIGIN: "https://blog.wuzhaoyi.xyz" };
  const root = await call(new Request("https://blog.wuzhaoyi.xyz/"), env);
  expect(root.status).toBe(200);
  expect(root.headers.get("Location")).toBeNull();
  const prefixed = await call(new Request("https://blog.wuzhaoyi.xyz/agent-blog/episodes/day?from=old"), env);
  expect(prefixed.status).toBe(308);
  expect(prefixed.headers.get("Location")).toBe("https://blog.wuzhaoyi.xyz/episodes/day?from=old");
  const pending = await call(new Request("https://gitlog.si/episodes/day"), env);
  expect(pending.headers.get("Location")).toBe("https://blog.wuzhaoyi.xyz/episodes/day");
});
