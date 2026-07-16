import { defineConfig } from "astro/config";

const [owner = "hqwuzhaoyi", repository = "agent-blog"] = (
  process.env.GITHUB_REPOSITORY ?? "hqwuzhaoyi/agent-blog"
).split("/");
const customSite = process.env.SITE_URL;

export default defineConfig({
  site: customSite ?? `https://${owner}.github.io`,
  base: customSite ? "/" : `/${repository}`,
  trailingSlash: "always",
});
