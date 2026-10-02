import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { handlePublication } from "../cloudflare/publication";
import { handleFeeds } from "../cloudflare/feeds";

function environment() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("migrations/0001_content.sql", "utf8"));
  const CONTENT = {
    prepare(text: string) {
      const bound = (args: any[]) => ({
        bind: (...values: any[]) => bound(values),
        async first() {
          return sql.prepare(text).get(...args) ?? null;
        },
        async all() {
          return { results: sql.prepare(text).all(...args) };
        },
        async run() {
          return {
            meta: { changes: Number(sql.prepare(text).run(...args).changes) },
          };
        },
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
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const objects = new Map<string, Uint8Array>();
  return {
    CONTENT,
    SUBMIT_TOKEN: "submit-fixture",
    REVIEW_TOKEN: "review-fixture",
    PUBLIC_ORIGIN: "https://blog.example",
    AUDIO: {
      async put(key: string, bytes: ArrayBuffer) {
        objects.set(key, new Uint8Array(bytes));
      },
      async head(key: string) {
        return objects.has(key)
          ? {
              size: objects.get(key)!.length,
              httpMetadata: { contentType: "audio/mpeg" },
            }
          : null;
      },
    },
  };
}
const origin = "https://blog.example";
const api = (path: string, data: unknown) =>
  new Request(`${origin}/agent-blog/api/${path}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer submit-fixture",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
const feed = async (env: any, path = "rss.xml") =>
  (await handleFeeds(new Request(`${origin}/agent-blog/${path}`), env))!.text();

test("RSS preserves identities and measurements while D1 publications update without deployment", async () => {
  const env = environment();
  const review = {
    title: "Approved & safe",
    summary: "Review summary",
    date: "2026-10-01",
    source: "Hermes",
    platforms: ["Hermes"],
    highlights: 1,
  };
  const draft = await handlePublication(
    api("reviews/hermes-2026-10-01", { data: review, body: "# Full review" }),
    env,
  );
  const saved = await draft.json();
  expect(saved.status).toBe("draft");
  expect(await feed(env)).not.toContain("Approved &amp; safe");
  const login = await handlePublication(
    new Request(`${origin}/agent-blog/admin/login`, {
      method: "POST",
      headers: { Origin: origin },
      body: new URLSearchParams({ key: env.REVIEW_TOKEN }),
    }),
    env,
  );
  const cookie = login.headers.get("Set-Cookie")!.split(";")[0];
  const approve = await handlePublication(
    new Request(
      `${origin}/agent-blog/admin/reviews/hermes-2026-10-01/publish`,
      {
        method: "POST",
        headers: { Origin: origin, Cookie: cookie },
        body: new URLSearchParams({ revision: saved.revision }),
      },
    ),
    env,
  );
  expect(approve.status).toBe(200);
  const publicFeed = await feed(env);
  expect(publicFeed).toContain(
    '<guid isPermaLink="true">https://blog.example/agent-blog/reviews/hermes-2026-10-01/</guid>',
  );
  expect(publicFeed).toContain("Thu, 01 Oct 2026");
  const updated = await handlePublication(
    api("reviews/hermes-2026-10-01", {
      data: { ...review, title: "PRIVATE_DRAFT_MARKER" },
      body: "Private revision",
      expectedRevision: saved.revision,
    }),
    env,
  );
  expect(updated.status).toBe(200);
  expect(await feed(env)).toContain("Approved &amp; safe");
  expect(await feed(env)).not.toContain("PRIVATE_DRAFT_MARKER");

  const bytes = new Uint8Array([1, 2, 3, 4]);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const episode = {
    title: "Episode",
    summary: "Episode summary",
    date: "2026-10-02",
    duration: 120.4,
    disclosure: "AI voice",
    chapters: [
      { title: "Start", start: 0 },
      { title: "Next", start: 60 },
    ],
    audio: {
      url: `${origin}/agent-blog/audio/2026-10-02/${hash}.mp3`,
      length: 4,
      type: "audio/mpeg",
    },
  };
  expect(
    (
      await handlePublication(
        api("episodes/2026-10-02", { data: episode, body: "# Show notes" }),
        env,
      )
    ).status,
  ).toBe(422);
  const upload = await handlePublication(
    new Request(`${origin}/agent-blog/api/audio/2026-10-02/${hash}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer submit-fixture",
        "Content-Length": "4",
      },
      body: bytes,
    }),
    env,
  );
  expect(upload.status).toBe(200);
  const published = await handlePublication(
    api("episodes/2026-10-02", { data: episode, body: "# Show notes" }),
    env,
  );
  expect((await published.json()).status).toBe("published");
  expect(
    (
      await handlePublication(
        api("episodes/2026-10-02", { data: episode, body: "# Show notes" }),
        env,
      )
    ).status,
  ).toBe(200);
  const podcast = await feed(env, "episodes/rss.xml");
  expect(podcast).toContain(
    '<guid isPermaLink="true">https://blog.example/agent-blog/episodes/2026-10-02/</guid>',
  );
  expect(podcast).toContain("Fri, 02 Oct 2026 00:00:00 GMT");
  expect(podcast).toContain("<itunes:duration>120</itunes:duration>");
  expect(podcast).toContain(
    `<enclosure url="${episode.audio.url}" length="4" type="audio/mpeg"/>`,
  );
  expect(podcast).not.toContain("Approved &amp; safe");
  expect(podcast).not.toContain("PRIVATE_DRAFT_MARKER");
  expect(podcast.match(/<item>/g)).toHaveLength(1);
  expect(await feed(env)).toContain("<title>Episode</title>");
});

test("feed routes accept GET/HEAD and retain public origin behind preview hosts", async () => {
  const env = environment();
  const response = await handleFeeds(
    new Request("https://preview.example/agent-blog/rss.xml"),
    env as any,
  );
  expect(response!.headers.get("Content-Type")).toContain("xml");
  expect(await response!.text()).toContain(
    "<link>https://blog.example/agent-blog/</link>",
  );
  expect(
    (await handleFeeds(
      new Request(`${origin}/agent-blog/rss.xml`, { method: "HEAD" }),
      env as any,
    ))!.status,
  ).toBe(200);
  expect(
    (await handleFeeds(
      new Request(`${origin}/agent-blog/rss.xml`, { method: "POST" }),
      env as any,
    ))!.status,
  ).toBe(405);
});
