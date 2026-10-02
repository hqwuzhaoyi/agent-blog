import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const bucket = "agent-blog-audio";
export function command(binary, args, options = {}) {
  return execFileSync(binary, args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, ...options });
}
export function wrangler(args) { return command(join(root, "node_modules/.bin/wrangler"), args); }
export async function upload(key, file, type) {
  console.log(wrangler(["r2", "object", "put", `${bucket}/${key}`, "--file", file, "--remote", "--content-type", type]));
}
export async function deploy({ episode, audioFile, audioKey, dryRun = false } = {}) {
  const state = join(root, ".agent-blog");
  await mkdir(state, { recursive: true });
  const lock = join(state, "cloudflare-deploy.lock");
  try { await mkdir(lock); } catch (error) {
    if (error.code === "EEXIST") throw new Error("Another Cloudflare deployment is running; retry when it finishes.");
    throw error;
  }
  const temporary = await mkdtemp(join(tmpdir(), "agent-blog-deploy-"));
  try {
    const catalogFile = join(temporary, "catalog.json");
    wrangler(["r2", "object", "get", `${bucket}/publication/catalog.json`, "--remote", "--file", catalogFile]);
    let days = JSON.parse(await readFile(catalogFile, "utf8"));
    if (!Array.isArray(days) || days.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw new Error("Invalid episode catalog");
    const content = join(temporary, "episodes");
    await cp(join(root, "src/data/episodes"), content, { recursive: true });
    for (const day of days) {
      wrangler(["r2", "object", "get", `${bucket}/publication/episodes/${day}.md`, "--remote", "--file", join(content, `${day}.md`)]);
    }
    if (episode) {
      await writeFile(join(content, `${episode.day}.md`), episode.markdown);
      days = [...new Set([...days, episode.day])].sort();
    }
    console.log(command(join(root, "node_modules/.bin/astro"), ["sync", "--force"], { env: { ...process.env, EPISODE_CONTENT_DIR: content } }));
    console.log(command(join(root, "node_modules/.bin/astro"), ["build"], { env: { ...process.env, EPISODE_CONTENT_DIR: content } }));
    console.log(command(process.execPath, ["scripts/prepare-cloudflare-assets.mjs"]));
    if (dryRun) {
      console.log(wrangler(["deploy", "--dry-run"]));
      return { status: "validated", days };
    }
    if (episode) {
      await upload(audioKey, audioFile, "audio/mpeg");
      await upload(`publication/episodes/${episode.day}.md`, join(content, `${episode.day}.md`), "text/markdown; charset=utf-8");
    }
    await writeFile(catalogFile, JSON.stringify(days));
    await upload("publication/catalog.json", catalogFile, "application/json");
    console.log(wrangler(["deploy"]));
    const result = { status: "deployed", days, completedAt: new Date().toISOString() };
    await writeFile(join(state, "last-cloudflare-deployment.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await deploy({ dryRun: process.argv.includes("--dry-run") })));
}
