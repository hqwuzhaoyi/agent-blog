import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { test, expect } from "vitest";
import { handleAdminApi } from "../cloudflare/admin-api";
import { saveRevision, publishRevision } from "../cloudflare/publication";
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

const origin = "https://blog.example";
const metadata = {
  title: "Private",
  summary: "Summary",
  date: "2026-10-02",
  source: "Hermes",
  platforms: ["Hermes"],
  highlights: 1,
};
test("reviewer HTTP workflow preserves public revision until explicit current-version approval", async () => {
  const env: any = {
    CONTENT: database(),
    REVIEW_TOKEN: "review-secret",
    SUBMIT_TOKEN: "submit-secret",
  };
  const call = (
    path: string,
    method = "GET",
    body?: any,
    cookie?: string,
    requestOrigin = origin,
  ) =>
    handleAdminApi(
      new Request(origin + "/agent-blog/admin/api" + path, {
        method,
        headers: {
          Origin: requestOrigin,
          ...(cookie ? { Cookie: cookie } : {}),
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  const first = await saveRevision(
    env.CONTENT,
    "review",
    "test",
    metadata,
    "Full text <script>bad()</script>",
  );
  expect((await call("/reviews")).status).toBe(401);
  expect(
    (
      await call(
        "/reviews/test/publish",
        "POST",
        { revision: first.revision },
        "blog_review=preview-token",
      )
    ).status,
  ).toBe(401);
  const login = await call("/login", "POST", { key: "review-secret" });
  expect(login.status).toBe(200);
  expect(login.headers.get("Set-Cookie")).toContain(
    "HttpOnly; Secure; SameSite=Strict; Path=/agent-blog/admin/",
  );
  const cookie = login.headers.get("Set-Cookie")!.split(";")[0];
  expect((await call("/session", "GET", undefined, cookie)).status).toBe(200);
  expect(
    (
      await call(
        "/reviews/test/publish",
        "POST",
        { revision: first.revision },
        cookie,
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
  const detail = await (
    await call("/reviews/test", "GET", undefined, cookie)
  ).json();
  expect(detail.html).not.toContain("<script>");
  expect(detail).not.toHaveProperty("preview_token");
  const approved = await (
    await call(
      "/reviews/test/publish",
      "POST",
      { revision: first.revision },
      cookie,
    )
  ).json();
  expect(approved.status).toBe("published");
  expect(approved.publishedAt).toBeTruthy();
  const saved = await (
    await call(
      "/reviews/test",
      "PUT",
      {
        data: { ...metadata, title: "Changed" },
        body: "Changed body",
        expectedRevision: first.revision,
      },
      cookie,
    )
  ).json();
  expect(saved.revision).not.toBe(first.revision);
  const changed = await (
    await call("/reviews/test", "GET", undefined, cookie)
  ).json();
  expect(changed.publishedRevision).toBe(first.revision);
  expect(changed.published.data.title).toBe("Private");
  expect(
    (
      await call(
        "/reviews/test",
        "PUT",
        { data: metadata, body: "Other", expectedRevision: first.revision },
        cookie,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await call(
        "/reviews/test/publish",
        "POST",
        { revision: first.revision },
        cookie,
      )
    ).status,
  ).toBe(409);
  const list = await (
    await call(
      "/reviews?status=pending&source=Hermes&q=Changed&limit=500",
      "GET",
      undefined,
      cookie,
    )
  ).json();
  expect(list.limit).toBe(50);
  expect(list.total).toBe(1);
  const decimal = await (
    await call("/reviews?page=1.9&limit=1.9", "GET", undefined, cookie)
  ).json();
  expect(decimal.page).toBe(1);
  expect(decimal.limit).toBe(1);
  const second = await call(
    "/reviews/test/publish",
    "POST",
    { revision: saved.revision },
    cookie,
  );
  expect(second.status).toBe(200);
  const audit = await (
    await call("/reviews/test/audit", "GET", undefined, cookie)
  ).json();
  expect(audit.items).toHaveLength(2);
  expect(
    (
      await call(
        "/reviews/test/revisions/" + first.revision,
        "GET",
        undefined,
        cookie,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await call(
        "/reviews/other/revisions/" + first.revision,
        "GET",
        undefined,
        cookie,
      )
    ).status,
  ).toBe(404);
  expect(
    (await call("/logout", "POST", {}, cookie)).headers.get("Set-Cookie"),
  ).toContain("Max-Age=0");
});

test("preview capability renders complete sanitized React Article and carries no write authority", async () => {
  const { handleReadOnlyPreview } =
    await import("../src/app/features/admin/preview-server");
  const env: any = { CONTENT: database(), REVIEW_TOKEN: "review-secret" };
  const saved = await saveRevision(
    env.CONTENT,
    "review",
    "preview-test",
    metadata,
    "## Complete saved body\n\n<script>bad()</script>safe",
  );
  const url =
    origin +
    "/agent-blog/admin/reviews/preview-test?revision=" +
    saved.revision +
    "&token=" +
    saved.previewToken;
  const response = await handleReadOnlyPreview(new Request(url), env);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain("Complete saved body");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("确认并发布");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(
    (
      await handleReadOnlyPreview(
        new Request(url.replace(saved.previewToken, "invalid")),
        env,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handleAdminApi(
        new Request(
          origin + "/agent-blog/admin/api/reviews/preview-test/publish",
          {
            method: "POST",
            headers: { Origin: origin },
            body: JSON.stringify({
              revision: saved.revision,
              token: saved.previewToken,
            }),
          },
        ),
        env,
      )
    ).status,
  ).toBe(401);
});
