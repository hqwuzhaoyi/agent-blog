import start from "@tanstack/react-start/server-entry";
import audio from "./worker.mjs";
import { handlePublication } from "./publication";
import { handleAdminApi } from "./admin-api";
import { handleFeeds } from "./feeds";
import { handleReadOnlyPreview } from "../src/app/features/admin/preview-server";
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url),
      path = url.pathname;
    if (path === "/" || path.startsWith("/agent-blog/audio/"))
      return audio.fetch(request, env);
    if (path.startsWith("/agent-blog/admin/api/"))
      return handleAdminApi(request, env);
    if (path.startsWith("/agent-blog/api/"))
      return handlePublication(request, env);
    const feed = await handleFeeds(request, env);
    if (feed) return feed;
    if (
      (path === "/agent-blog/admin/login" && request.method === "POST") ||
      (path === "/agent-blog/admin/logout" && request.method === "POST")
    )
      return handlePublication(request, env);
    // Existing operator forms and read-only preview capabilities remain usable.
    if (/^\/agent-blog\/admin\/reviews\/[a-zA-Z0-9_-]+\/publish$/.test(path) && request.method === "POST") return handlePublication(request, env);
    if (
      /^\/agent-blog\/admin\/reviews\/[a-zA-Z0-9_-]+\/?$/.test(path) &&
      url.searchParams.has("token")
    )
      return handleReadOnlyPreview(request, env);
    const response = await start.fetch(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "same-origin");
    if (path.startsWith("/agent-blog/admin")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  },
};
