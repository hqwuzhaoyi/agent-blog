import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { handlePublication } from "../cloudflare/publication";
import { publishedEntries } from "../src/lib/content-store";
function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(readFileSync("migrations/0001_content.sql", "utf8"));
  const db: any = {
    prepare(text: string) {
      return {
        bind(...args: any[]) {
          const statement = sql.prepare(text);
          return {
            async first() {
              return statement.get(...args);
            },
            async all() {
              return { results: statement.all(...args) };
            },
            async run() {
              return {
                meta: { changes: Number(statement.run(...args).changes) },
              };
            },
          };
        },
        async all() {
          return { results: sql.prepare(text).all() };
        },
      };
    },
    async batch(statements: any[]) {
      sql.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return db;
}
const site = "https://blog.example";
const data = {
  title: "Approved work",
  summary: "A full preview",
  date: "2026-10-02",
  source: "Hermes",
  platforms: ["Hermes"],
  highlights: 1,
};
const environment = (): any => ({
  CONTENT: database(),
  SUBMIT_TOKEN: "submission-secret",
  REVIEW_TOKEN: "human-secret",
  AUDIO: {
    head: async () => ({
      size: 100,
      httpMetadata: { contentType: "audio/mpeg" },
    }),
  },
});
const request = (path: string, options: RequestInit = {}) =>
  new Request(site + "/" + path, options);
async function submit(
  env: any,
  title = "Approved work",
  expectedRevision?: string,
) {
  return handlePublication(
    request("api/reviews/hermes-2026-10-02", {
      method: "PUT",
      headers: {
        Authorization: "Bearer submission-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { ...data, title },
        body: "## Outcome\n\nFull text <script>alert(1)</script>",
        expectedRevision,
      }),
    }),
    env,
  );
}
async function login(env: any) {
  const response = await handlePublication(
    request("admin/login", {
      method: "POST",
      headers: { Origin: site },
      body: new URLSearchParams({ key: "human-secret" }),
    }),
    env,
  );
  return response.headers.get("Set-Cookie")!.split(";")[0];
}
const approve = (env: any, cookie: string, revision: string) =>
  handlePublication(
    request("admin/reviews/hermes-2026-10-02/publish", {
      method: "POST",
      headers: { Origin: site, Cookie: cookie },
      body: new URLSearchParams({ revision }),
    }),
    env,
  );
describe("Dynamic content approval boundary", () => {
  test("draft stays private, full preview is sanitized, human approval makes it public without deploying", async () => {
    const env = environment(),
      result = await (await submit(env)).json();
    expect(result.status).toBe("draft");
    expect(await publishedEntries(env.CONTENT, "review")).toHaveLength(0);
    const preview = await handlePublication(
      new Request(result.previewUrl),
      env,
    );
    const html = await preview.text();
    expect(html).toContain("Full text");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("确认发布</button>");
    expect(
      (
        await handlePublication(
          request(
            "admin/reviews/hermes-2026-10-02?revision=" + result.revision,
          ),
          env,
        )
      ).status,
    ).toBe(404);
    expect((await approve(env, "", result.revision)).status).toBe(401);
    const cookie = await login(env);
    expect((await approve(env, cookie, result.revision)).status).toBe(200);
    expect(await publishedEntries(env.CONTENT, "review")).toHaveLength(1);
    expect(
      (await env.CONTENT.prepare("SELECT actor FROM publication_audit").all())
        .results[0].actor,
    ).toBe("operator");
  });
  test("editing preserves published version; stale approvals and concurrent overwrites fail; retries stay idempotent", async () => {
    const env = environment(),
      first = await (await submit(env)).json(),
      cookie = await login(env);
    await approve(env, cookie, first.revision);
    const retry = await (await submit(env)).json();
    expect(retry.revision).toBe(first.revision);
    const second = await (
      await submit(env, "Changed draft", first.revision)
    ).json();
    expect(
      (await publishedEntries<"reviews">(env.CONTENT, "review"))[0].data.title,
    ).toBe("Approved work");
    expect((await approve(env, cookie, first.revision)).status).toBe(409);
    expect(
      (await submit(env, "Concurrent old edit", first.revision)).status,
    ).toBe(409);
    await approve(env, cookie, second.revision);
    expect(
      (await publishedEntries<"reviews">(env.CONTENT, "review"))[0].data.title,
    ).toBe("Changed draft");
  });
  test("rejects unauthorized, cross-origin approvals and invalid dates; episode requires uploaded audio", async () => {
    const env = environment();
    expect(
      (await handlePublication(request("api/reviews/a"), env)).status,
    ).toBe(401);
    expect(
      (
        await handlePublication(
          request("admin/login", {
            method: "POST",
            headers: { Origin: "https://evil.example" },
            body: new URLSearchParams({ key: "human-secret" }),
          }),
          env,
        )
      ).status,
    ).toBe(403);
    const input = {
      data: {
        ...data,
        date: "2026-02-30",
        duration: 60,
        disclosure: "AI",
        audio: {
          url: site + "/audio/2026-10-02/" + "a".repeat(64) + ".mp3",
          length: 100,
          type: "audio/mpeg",
        },
        chapters: [{ title: "Start", start: 0 }],
      },
      body: "Show notes",
    };
    const put = () =>
      handlePublication(
        request("api/episodes/2026-10-02", {
          method: "PUT",
          headers: { Authorization: "Bearer submission-secret" },
          body: JSON.stringify(input),
        }),
        env,
      );
    expect((await put()).status).toBe(422);
    input.data.date = "2026-10-02";
    env.AUDIO.head = async () => null;
    expect((await put()).status).toBe(422);
    env.AUDIO.head = async () => ({
      size: 100,
      httpMetadata: { contentType: "audio/mpeg" },
    });
    const material = { id: "a".repeat(24), kind: "x", author: "Builder", summary: "公开整理摘要", url: "https://x.com/builder/status/1", linkKind: "item", chapterStart: 0 };
    Object.assign(input.data, { materials: [material] });
    expect((await put()).status).toBe(200);
    const published = await publishedEntries<"episodes">(env.CONTENT, "episode");
    expect(published).toHaveLength(1);
    expect(published[0].data.materials?.[0]).toEqual(material);
    material.chapterStart = 59;
    expect((await put()).status).toBe(422);
  });
});
