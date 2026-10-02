import astro from "@astrojs/cloudflare/entrypoints/server";
import audio from "./worker.mjs";
import { handlePublication } from "./publication";
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const path = new URL(request.url).pathname;
    if (path === "/" || path.startsWith("/agent-blog/audio/"))
      return audio.fetch(request, env);
    if (
      path.startsWith("/agent-blog/api/") ||
      path.startsWith("/agent-blog/admin/")
    )
      return handlePublication(request, env);
    return astro.fetch(request, env, ctx);
  },
};
