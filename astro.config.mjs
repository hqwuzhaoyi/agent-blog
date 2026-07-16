import { defineConfig } from "astro/config";

const repository =
  (process.env.GITHUB_REPOSITORY ?? "hqwuzhaoyi/agent-blog").split("/")[1] ??
  "agent-blog";
const site = process.env.SITE_URL ?? "https://blog.wuzhaoyi.xyz";
const base = process.env.BASE_PATH ?? `/${repository}`;

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
});
