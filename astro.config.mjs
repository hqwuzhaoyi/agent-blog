import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
const fixture = process.env.STATIC_FIXTURE === "1";

const repository =
  (process.env.GITHUB_REPOSITORY ?? "hqwuzhaoyi/agent-blog").split("/")[1] ??
  "agent-blog";
const site = process.env.SITE_URL ?? "https://blog.wuzhaoyi.xyz";
const base = process.env.BASE_PATH ?? `/${repository}`;

export default defineConfig({
  output: fixture ? "static" : "server",
  adapter: fixture ? undefined : cloudflare({ imageService: "passthrough", prerenderEnvironment: "node" }),
  session: { driver: sessionDrivers.memory() },
  vite: { define: { "import.meta.env.STATIC_FIXTURE": fixture } },
  site,
  base,
  trailingSlash: "always",
});
