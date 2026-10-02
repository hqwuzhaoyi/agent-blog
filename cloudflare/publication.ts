import { z } from "zod";
import { renderMarkdown } from "../src/lib/markdown";
const prefix = "/agent-blog";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return !isNaN(+date) && date.toISOString().slice(0, 10) === value;
  });
const common = {
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(3000),
  date: day,
};
export const reviewSchema = z.object({
  ...common,
  source: z.string().min(1).max(200),
  language: z.enum(["en", "zh-CN"]).optional(),
  platforms: z.array(z.string().min(1).max(100)).min(1).max(20),
  highlights: z.number().int().positive().max(100),
});
export const episodeSchema = z
  .object({
    ...common,
    duration: z.number().positive().max(86400),
    disclosure: z.string().min(1).max(3000),
    draft: z.literal(false).default(false),
    audio: z.object({
      url: z.url(),
      length: z.number().int().positive(),
      type: z.literal("audio/mpeg"),
    }),
    chapters: z
      .array(
        z.object({
          title: z.string().min(1).max(300),
          start: z.number().nonnegative(),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine(
    (e) =>
      e.chapters.every(
        (c, i) =>
          c.start < e.duration && (!i || c.start > e.chapters[i - 1].start),
      ),
    "Invalid chapter positions",
  );
const payloadSchema = z.object({
  data: z.unknown(),
  body: z.string().trim().min(1).max(150000),
  expectedRevision: z.string().nullable().optional(),
});
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export const digest = async (value: string | ArrayBuffer) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof value === "string" ? new TextEncoder().encode(value) : value,
      ),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export async function equal(a: string, b: string) {
  return (await digest(a)) === (await digest(b));
}
const random = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function signature(text: string, key: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function reviewer(request: Request, env: any) {
  if (!env.REVIEW_TOKEN) return false;
  const cookie = request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)blog_review=([^;]+)/)?.[1];
  if (!cookie) return false;
  const [expires, mac] = cookie.split(".");
  return (
    Number(expires) > Date.now() &&
    Number(expires) < Date.now() + 86400001 &&
    !!mac &&
    (await equal(mac, await signature(expires, env.REVIEW_TOKEN)))
  );
}
const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>工作日志审核</title><style>body{font:17px/1.8 system-ui;color:#18342d;background:#f8f8f3;margin:0}main{max-width:760px;margin:48px auto;padding:24px}a{color:#167358}button,input{font:inherit;padding:10px 18px;border:1px solid #b6c8be;border-radius:8px}button{background:#145f47;color:white;cursor:pointer}input{max-width:100%;box-sizing:border-box}article{overflow-wrap:anywhere}img{max-width:100%}pre{overflow:auto}.notice{padding:16px;background:#e6eee5}li{margin:18px 0}form{margin:24px 0}</style><main>${body}</main></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html;charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "same-origin",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src https:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
const loginForm = () =>
  html(
    `<h1>工作日志审核</h1><p>登录后查看草稿并确认发布。</p><form method="post" action="${prefix}/admin/login"><label>审核密钥 <input type="password" name="key" required autocomplete="current-password"></label><button>登录</button></form>`,
  );
export async function saveRevision(
  db: any,
  kind: string,
  id: string,
  data: any,
  body: string,
  expectedRevision?: string | null,
) {
  const revision = await digest(JSON.stringify(data) + "\n" + body);
  const existing = await db
    .prepare("SELECT * FROM content_heads WHERE kind=? AND id=?")
    .bind(kind, id)
    .first();
  if (existing?.draft_revision === revision) {
    const row = await db
      .prepare(
        "SELECT preview_token FROM content_revisions WHERE kind=? AND id=? AND revision=?",
      )
      .bind(kind, id, revision)
      .first();
    return { revision, previewToken: row.preview_token };
  }
  if ((existing?.draft_revision ?? null) !== (expectedRevision ?? null))
    throw new Error("revision-conflict");
  const previewToken = random();
  const result = await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO content_revisions VALUES (?,?,?,?,?,?,?)")
      .bind(
        kind,
        id,
        revision,
        JSON.stringify(data),
        body,
        previewToken,
        new Date().toISOString(),
      ),
    existing
      ? db
          .prepare(
            "UPDATE content_heads SET draft_revision=? WHERE kind=? AND id=? AND draft_revision=?",
          )
          .bind(revision, kind, id, existing.draft_revision)
      : db
          .prepare(
            "INSERT OR IGNORE INTO content_heads(kind,id,draft_revision) VALUES(?,?,?)",
          )
          .bind(kind, id, revision),
  ]);
  if (!result[1].meta.changes) throw new Error("revision-conflict");
  const row = await db
    .prepare(
      "SELECT preview_token FROM content_revisions WHERE kind=? AND id=? AND revision=?",
    )
    .bind(kind, id, revision)
    .first();
  return { revision, previewToken: row.preview_token };
}
export async function publishRevision(
  db: any,
  kind: string,
  id: string,
  revision: string,
  actor: string,
) {
  const now = new Date().toISOString();
  const result = await db.batch([
    db
      .prepare(
        "UPDATE content_heads SET published_revision=?,published_at=CASE WHEN published_revision=? THEN published_at ELSE ? END WHERE kind=? AND id=? AND draft_revision=?",
      )
      .bind(revision, revision, now, kind, id, revision),
    db
      .prepare(
        `INSERT OR IGNORE INTO publication_audit SELECT kind,id,published_revision,?,? FROM content_heads WHERE kind=? AND id=? AND published_revision=? AND draft_revision=?`,
      )
      .bind(actor, now, kind, id, revision, revision),
  ]);
  if (!result[0].meta.changes) throw new Error("revision-conflict");
}
export async function handlePublication(
  request: Request,
  env: any,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname;
    if (env.PUBLIC_ORIGIN) {
      const origin = new URL(env.PUBLIC_ORIGIN);
      url.protocol = origin.protocol;
      url.host = origin.host;
    }
    if (!env.CONTENT)
      return json({ error: "Content database unavailable" }, 503);
    if (path.startsWith(prefix + "/api/")) {
      if (
        !env.SUBMIT_TOKEN ||
        !(await equal(
          request.headers.get("Authorization") ?? "",
          `Bearer ${env.SUBMIT_TOKEN}`,
        ))
      )
        return json({ error: "Unauthorized" }, 401);
      const audio =
        /^\/agent-blog\/api\/audio\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]{64})$/.exec(
          path,
        );
      if (audio && request.method === "PUT") {
        day.parse(audio[1]);
        const length = Number(request.headers.get("Content-Length"));
        if (!length || length > 25 * 1024 * 1024)
          return json(
            { error: "Audio must be between 1 byte and 25 MiB" },
            413,
          );
        const key = `episodes/${audio[1]}/${audio[2]}.mp3`;
        const previous = await env.AUDIO.head(key);
        if (previous?.size === length) return json({ status: "stored", key });
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength !== length || (await digest(bytes)) !== audio[2])
          return json({ error: "Audio hash or length mismatch" }, 422);
        await env.AUDIO.put(key, bytes, {
          httpMetadata: { contentType: "audio/mpeg" },
        });
        return json({ status: "stored", key });
      }
      const match =
        /^\/agent-blog\/api\/(reviews|episodes)\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})$/.exec(
          path,
        );
      if (!match) return json({ error: "Not found" }, 404);
      const kind = match[1] === "reviews" ? "review" : "episode",
        id = match[2];
      if (request.method === "GET") {
        const head = await env.CONTENT.prepare(
          "SELECT draft_revision,published_revision FROM content_heads WHERE kind=? AND id=?",
        )
          .bind(kind, id)
          .first();
        return json(head ?? { draft_revision: null, published_revision: null });
      }
      if (request.method !== "PUT")
        return json({ error: "Method not allowed" }, 405);
      if (Number(request.headers.get("Content-Length")) > 200000)
        return json({ error: "Content too large" }, 413);
      const payload = payloadSchema.parse(await request.json());
      const data = (kind === "review" ? reviewSchema : episodeSchema).parse(
        payload.data,
      );
      if (kind === "episode") {
        const e = data as z.infer<typeof episodeSchema>;
        if (id !== e.date)
          return json({ error: "Episode identity must match date" }, 422);
        const audioUrl = new URL(e.audio.url);
        const a =
          /^\/agent-blog\/audio\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]{64})\.mp3$/.exec(
            audioUrl.pathname,
          );
        if (audioUrl.origin !== url.origin || !a || a[1] !== id)
          return json(
            { error: "Audio must use this episode on the blog domain" },
            422,
          );
        const stored = await env.AUDIO.head(`episodes/${id}/${a[2]}.mp3`);
        if (
          !stored ||
          stored.size !== e.audio.length ||
          stored.httpMetadata?.contentType !== "audio/mpeg"
        )
          return json(
            { error: "Uploaded audio does not match enclosure" },
            422,
          );
      }
      const saved = await saveRevision(
        env.CONTENT,
        kind,
        id,
        data,
        payload.body,
        payload.expectedRevision,
      );
      if (kind === "episode")
        await publishRevision(
          env.CONTENT,
          kind,
          id,
          saved.revision,
          "automatic-episode",
        );
      return json({
        status: kind === "review" ? "draft" : "published",
        id,
        revision: saved.revision,
        previewUrl:
          kind === "review"
            ? `${url.origin}${prefix}/admin/reviews/${id}?revision=${saved.revision}&token=${saved.previewToken}`
            : undefined,
        url: `${url.origin}${prefix}/${match[1]}/${id}/`,
      });
    }
    // Only same-origin browser POSTs can change reviewer state or approve content.
    if (
      request.method === "POST" &&
      request.headers.get("Origin") !== new URL(request.url).origin
    )
      return html("<h1>请求来源不匹配</h1>", 403);
    if (path === prefix + "/admin/login" && request.method === "POST") {
      const form = await request.formData();
      if (
        !env.REVIEW_TOKEN ||
        !(await equal(String(form.get("key") ?? ""), env.REVIEW_TOKEN))
      )
        return html("<h1>审核密钥不正确</h1>", 401);
      const expires = String(Date.now() + 86400000),
        cookie = `${expires}.${await signature(expires, env.REVIEW_TOKEN)}`;
      return new Response(null, {
        status: 303,
        headers: {
          Location: prefix + "/admin/",
          "Set-Cookie": `blog_review=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=${prefix}/admin/; Max-Age=86400`,
          "Cache-Control": "no-store",
        },
      });
    }
    const loggedIn = await reviewer(request, env);
    if (path === prefix + "/admin/logout" && request.method === "POST")
      return new Response(null, {
        status: 303,
        headers: {
          Location: prefix + "/admin/",
          "Set-Cookie": `blog_review=; HttpOnly; Secure; SameSite=Strict; Path=${prefix}/admin/; Max-Age=0`,
        },
      });
    if (path === prefix + "/admin/" && request.method === "GET") {
      if (!loggedIn) return loginForm();
      const rows = await env.CONTENT.prepare(
        `SELECT h.id,h.draft_revision,h.published_revision,r.data FROM content_heads h JOIN content_revisions r ON r.kind=h.kind AND r.id=h.id AND r.revision=h.draft_revision WHERE h.kind='review' ORDER BY r.created_at DESC`,
      ).all();
      return html(
        `<h1>工作日志</h1><p>查看完整内容后确认发布；修改后的草稿需要重新确认。</p><ul>${rows.results.map((r: any) => `<li><a href="${prefix}/admin/reviews/${escape(r.id)}?revision=${r.draft_revision}">${escape(JSON.parse(r.data).title)}</a> · ${r.published_revision === r.draft_revision ? "已发布" : "待确认"}</li>`).join("")}</ul><form method="post" action="${prefix}/admin/logout"><button>退出登录</button></form>`,
      );
    }
    const preview =
      /^\/agent-blog\/admin\/reviews\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})(\/publish)?$/.exec(
        path,
      );
    if (preview) {
      const id = preview[1];
      if (preview[2] && request.method === "POST") {
        if (!loggedIn) return html("<h1>请先登录审核</h1>", 401);
        const form = await request.formData(),
          revision = String(form.get("revision") ?? "");
        await publishRevision(env.CONTENT, "review", id, revision, "operator");
        return html(
          `<h1>已发布</h1><p><a href="${prefix}/reviews/${escape(id)}/">查看工作日志</a> · <a href="${prefix}/admin/">返回审核列表</a></p>`,
        );
      }
      if (request.method !== "GET") return html("<h1>不支持此操作</h1>", 405);
      const revision = url.searchParams.get("revision");
      const row = await env.CONTENT.prepare(
        `SELECT r.*,h.draft_revision,h.published_revision FROM content_revisions r JOIN content_heads h ON h.kind=r.kind AND h.id=r.id WHERE r.kind='review' AND r.id=? AND r.revision=?`,
      )
        .bind(id, revision)
        .first();
      if (
        !row ||
        (!loggedIn &&
          !(await equal(
            url.searchParams.get("token") ?? "",
            row.preview_token,
          )))
      )
        return html("<h1>预览不可用</h1>", 404);
      const data = JSON.parse(row.data),
        current = row.draft_revision === revision,
        published = row.published_revision === revision;
      return html(
        `<a href="${prefix}/admin/">审核列表</a><p class="notice">${published ? "此版本已发布" : current ? "草稿 · 尚未发布" : "旧版本 · 请审核最新草稿"}</p><article><h1>${escape(data.title)}</h1><p>${escape(data.date)} · ${escape(data.source)} · ${escape(data.platforms.join(" + "))}</p><p>${escape(data.summary)}</p>${renderMarkdown(row.body)}</article>${loggedIn && current && !published ? `<form method="post" action="${prefix}/admin/reviews/${escape(id)}/publish"><input type="hidden" name="revision" value="${revision}"><button>我已检查完整内容，确认发布</button></form>` : !loggedIn ? `<p>预览链接只能查看。<a href="${prefix}/admin/">登录后确认发布</a></p>` : ""}`,
      );
    }
    return html("<h1>页面不存在</h1>", 404);
  } catch (error: any) {
    if (error.message === "revision-conflict")
      return json(
        { error: "Draft changed; refresh and review the latest revision" },
        409,
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Invalid publication data" }, 422);
    console.error("Publication request failed", error);
    return json({ error: "Publication failed; retry later" }, 500);
  }
}
