import { renderToString } from "react-dom/server";
import { Article } from "../../components/Article";
import { equal } from "../../../../cloudflare/publication";
import { renderMarkdown } from "../../../lib/markdown";
export async function handleReadOnlyPreview(
  request: Request,
  env: any,
): Promise<Response> {
  const url = new URL(request.url),
    id = /\/reviews\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})\/?$/.exec(
      url.pathname,
    )?.[1],
    revision = url.searchParams.get("revision"),
    token = url.searchParams.get("token");
  const headers = {
    "Content-Type": "text/html;charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; frame-ancestors 'none'",
  };
  if (request.method !== "GET")
    return new Response("不支持此操作", { status: 405, headers });
  const row =
    id && revision && token && env.CONTENT
      ? await env.CONTENT.prepare(
          "SELECT data,body,preview_token FROM content_revisions WHERE kind='review' AND id=? AND revision=?",
        )
          .bind(id, revision)
          .first()
      : null;
  if (!row || !(await equal(token || "", row.preview_token)))
    return new Response("预览不可用", { status: 404, headers });
  const data = JSON.parse(row.data),
    article = renderToString(
      <Article {...data} html={renderMarkdown(row.body)} preview />,
    );
  return new Response(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>工作日志只读预览</title><style>body{font:18px/1.8 system-ui;background:#faf9f6;color:#222c27;margin:0}main{max-width:720px;margin:32px auto;padding:20px}a{color:#245b45}pre{overflow:auto}img{max-width:100%}article{overflow-wrap:anywhere}</style></head><body><main>${article}<p>此链接只能查看当前保存版本，不能确认发布。</p><a href="/admin/reviews/${id}">登录审核工作台</a></main></body></html>`,
    { headers },
  );
}
