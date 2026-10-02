import { normalizedRequest, rootPath, legacyOrigin, productionOrigin } from "./site-urls";
import start from "@tanstack/react-start/server-entry";
import audio from "./worker.mjs";
import { handlePublication } from "./publication";
import { handleAdminApi } from "./admin-api";
import { handleFeeds } from "./feeds";
import { handleReadOnlyPreview } from "../src/app/features/admin/preview-server";
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url),
      originalPath = url.pathname;
    const path = rootPath(originalPath);
    const producer = path.startsWith("/api/");
    const staticAsset = path.startsWith("/assets/") || path === "/favicon.svg" || path === "/robots.txt";
    if (!producer && !staticAsset && ["GET", "HEAD"].includes(request.method) &&
      (originalPath !== path || url.origin === legacyOrigin)) {
      const target = new URL(request.url);
      if (url.origin === legacyOrigin) target.host = new URL(productionOrigin).host;
      target.pathname = path;
      return Response.redirect(target.href, 308);
    }
    request = normalizedRequest(request);
    if (path.startsWith("/assets/") || path === "/favicon.svg" || path === "/robots.txt") return env.ASSETS.fetch(request);
    if (path.startsWith("/audio/"))
      return audio.fetch(request, env);
    if (path.startsWith("/admin/api/"))
      return handleAdminApi(request, env);
    if (path.startsWith("/api/"))
      return handlePublication(request, env);
    const feed = await handleFeeds(request, env);
    if (feed) return feed;
    if (
      (path === "/admin/login" && request.method === "POST") ||
      (path === "/admin/logout" && request.method === "POST")
    )
      return handlePublication(request, env);
    // Existing operator forms and read-only preview capabilities remain usable.
    if (/^\/admin\/reviews\/[a-zA-Z0-9_-]+\/publish$/.test(path) && request.method === "POST") return handlePublication(request, env);
    if (
      /^\/admin\/reviews\/[a-zA-Z0-9_-]+\/?$/.test(path) &&
      url.searchParams.has("token")
    )
      return handleReadOnlyPreview(request, env);
    const response = await start.fetch(request);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "same-origin");
    if (path.startsWith("/admin")) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return response;
  },
};
