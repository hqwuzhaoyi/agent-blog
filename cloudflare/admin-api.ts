import { z } from "zod";
import { renderMarkdown } from "../src/lib/markdown";
import {
  reviewer,
  equal,
  signature,
  reviewSchema,
  saveRevision,
  publishRevision,
} from "./publication";
const base = "/agent-blog/admin/api";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "same-origin",
    },
  });
const payload = z.object({
  data: reviewSchema,
  body: z.string().trim().min(1).max(150000),
  expectedRevision: z.string().min(1),
});
const clean = (row: any) =>
  row
    ? {
        id: row.id,
        revision: row.revision,
        draftRevision: row.draft_revision,
        publishedRevision: row.published_revision,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        data: JSON.parse(row.data),
        body: row.body,
        html: row.body ? renderMarkdown(row.body) : undefined,
        url: `/agent-blog/reviews/${row.id}/`,
      }
    : null;
export async function handleAdminApi(
  request: Request,
  env: any,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname.slice(base.length);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      request.headers.get("Origin") !== url.origin
    )
      return json({ error: "请求来源不匹配" }, 403);
    if (path === "/login" && request.method === "POST") {
      const { key } = z
        .object({ key: z.string().max(1000) })
        .parse(await request.json());
      if (
        !env.REVIEW_TOKEN ||
        typeof key !== "string" ||
        !(await equal(key, env.REVIEW_TOKEN))
      )
        return json({ error: "审核密钥不正确" }, 401);
      const expires = String(Date.now() + 86400000);
      const response = json({ authenticated: true });
      response.headers.set(
        "Set-Cookie",
        `blog_review=${expires}.${await signature(expires, env.REVIEW_TOKEN)}; HttpOnly; Secure; SameSite=Strict; Path=/agent-blog/admin/; Max-Age=86400`,
      );
      return response;
    }
    if (!(await reviewer(request, env)))
      return json({ error: "请先登录审核" }, 401);
    if (path === "/session" && request.method === "GET")
      return json({ authenticated: true, actor: "operator" });
    if (path === "/logout" && request.method === "POST") {
      const response = json({ authenticated: false });
      response.headers.set(
        "Set-Cookie",
        "blog_review=; HttpOnly; Secure; SameSite=Strict; Path=/agent-blog/admin/; Max-Age=0",
      );
      return response;
    }
    if (!env.CONTENT) return json({ error: "内容数据库不可用" }, 503);
    if (
      (path === "/reviews" || path === "/episodes") &&
      request.method === "GET"
    ) {
      const kind = path === "/reviews" ? "review" : "episode";
      const page = Math.max(
          1,
          Math.min(
            10000,
            Math.floor(Number(url.searchParams.get("page"))) || 1,
          ),
        ),
        limit = Math.max(
          1,
          Math.min(50, Math.floor(Number(url.searchParams.get("limit"))) || 20),
        );
      const status = url.searchParams.get("status") || "pending",
        source = url.searchParams.get("source") || "",
        q = url.searchParams.get("q") || "";
      const clauses = ["h.kind=?"];
      const args: any[] = [kind];
      if (kind === "review" && status === "pending")
        clauses.push(
          "(h.published_revision IS NULL OR h.published_revision<>h.draft_revision)",
        );
      if (kind === "review" && status === "published")
        clauses.push("h.published_revision IS NOT NULL");
      if (source) {
        clauses.push("json_extract(r.data,'$.source')=?");
        args.push(source);
      }
      if (q) {
        clauses.push(
          "(instr(lower(json_extract(r.data,'$.title')),lower(?))>0 OR instr(lower(json_extract(r.data,'$.summary')),lower(?))>0)",
        );
        args.push(q, q);
      }
      const join = `FROM content_heads h JOIN content_revisions r ON r.kind=h.kind AND r.id=h.id AND r.revision=${kind === "episode" ? "h.published_revision" : "h.draft_revision"} WHERE ${clauses.join(" AND ")}`;
      const count = await env.CONTENT.prepare(
        `SELECT COUNT(*) AS total ${join}`,
      )
        .bind(...args)
        .first();
      const rows = await env.CONTENT.prepare(
        `SELECT r.id,r.revision,r.data,r.created_at,h.draft_revision,h.published_revision,h.published_at ${join} ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?`,
      )
        .bind(...args, limit, (page - 1) * limit)
        .all();
      return json({
        items: rows.results.map((r: any) => ({
          ...clean(r),
          status:
            r.published_revision === r.draft_revision ? "published" : "pending",
          url: `/agent-blog/${kind === "episode" ? "episodes" : "reviews"}/${r.id}/`,
        })),
        page,
        limit,
        total: count.total,
      });
    }
    const match =
      /^\/reviews\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})(?:\/(publish|audit|revisions\/([a-f0-9]{64})))?$/.exec(
        path,
      );
    if (!match) return json({ error: "未找到" }, 404);
    const id = match[1],
      action = match[2];
    const head = await env.CONTENT.prepare(
      "SELECT * FROM content_heads WHERE kind='review' AND id=?",
    )
      .bind(id)
      .first();
    if (!head) return json({ error: "未找到" }, 404);
    if (action === "publish" && request.method === "POST") {
      const input = z
        .object({ revision: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(await request.json());
      await publishRevision(
        env.CONTENT,
        "review",
        id,
        input.revision,
        "operator",
      );
      const published = await env.CONTENT.prepare(
        "SELECT published_revision,published_at FROM content_heads WHERE kind='review' AND id=?",
      )
        .bind(id)
        .first();
      return json({
        status: "published",
        revision: published.published_revision,
        publishedAt: published.published_at,
        url: `/agent-blog/reviews/${id}/`,
      });
    }
    if (action === "audit" && request.method === "GET") {
      const rows = await env.CONTENT.prepare(
        "SELECT revision,actor,approved_at FROM publication_audit WHERE kind='review' AND id=? ORDER BY approved_at DESC",
      )
        .bind(id)
        .all();
      return json({ items: rows.results });
    }
    if (!action && request.method === "PUT") {
      const raw = await request.text();
      if (raw.length > 200000) return json({ error: "内容过大" }, 413);
      const input = payload.parse(JSON.parse(raw));
      const saved = await saveRevision(
        env.CONTENT,
        "review",
        id,
        input.data,
        input.body,
        input.expectedRevision,
      );
      return json({ status: "draft", revision: saved.revision });
    }
    if (request.method !== "GET") return json({ error: "不支持此操作" }, 405);
    const revision = match[3] || head.draft_revision;
    const row = await env.CONTENT.prepare(
      "SELECT id,revision,data,body,created_at FROM content_revisions WHERE kind='review' AND id=? AND revision=?",
    )
      .bind(id, revision)
      .first();
    if (!row) return json({ error: "未找到修订" }, 404);
    const published = head.published_revision
      ? await env.CONTENT.prepare(
          "SELECT id,revision,data,body,created_at FROM content_revisions WHERE kind='review' AND id=? AND revision=?",
        )
          .bind(id, head.published_revision)
          .first()
      : null;
    return json({
      ...clean({ ...row, ...head, revision: row.revision }),
      published: clean(published),
    });
  } catch (error: any) {
    if (error.message === "revision-conflict")
      return json({ error: "草稿已更新，请重新查看" }, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "内容格式无效" }, 422);
    console.error("Admin API failed", error);
    return json({ error: "操作失败，请稍后重试" }, 500);
  }
}
