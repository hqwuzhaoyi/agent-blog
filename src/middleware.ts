import { defineMiddleware } from "astro:middleware";
export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.STATIC_FIXTURE) {
    const { env } = await import("cloudflare:workers");
    if (!env.CONTENT) throw new Error("Content database binding is required");
    context.locals.contentDB = env.CONTENT;
  }
  const response = await next();
  response.headers.set("Cache-Control", "no-store");
  return response;
});
