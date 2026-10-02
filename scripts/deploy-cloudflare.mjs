import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const bucket = "agent-blog-audio";
export function command(binary, args, options = {}) {
  return execFileSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
}
export function wrangler(args) {
  return command(join(root, "node_modules/.bin/wrangler"), args);
}
export async function upload(key, file, type) {
  console.log(
    wrangler([
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      file,
      "--remote",
      "--content-type",
      type,
    ]),
  );
}
export async function deploy({ dryRun = false } = {}) {
  const state = join(root, ".agent-blog");
  await mkdir(state, { recursive: true });
  const lock = join(state, "cloudflare-deploy.lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another Cloudflare deployment is running; retry when it finishes.",
      );
    throw error;
  }
  try {
    const buildEnv = {
      ...process.env,
      REACT_WRANGLER_CONFIG: "wrangler.jsonc",
    };
    delete buildEnv.CLOUDFLARE_ENV;
    console.log(
      command(
        join(root, "node_modules/.bin/vite"),
        ["build", "--config", "vite.react.config.ts"],
        { env: buildEnv },
      ),
    );
    await rm(join(root, "dist-react/client/preview-audio"), {
      recursive: true,
      force: true,
    });
    await rm(join(root, "dist-react/client/agent-blog/preview-audio"), {
      recursive: true,
      force: true,
    });
    await rm(join(root, "dist-react/server/.dev.vars"), { force: true });
    await rm(join(root, "dist-react/server/.dev.vars.react-preview"), {
      force: true,
    });
    const deployConfig = join(root, "dist-react/server/wrangler.json");
    const generated = JSON.parse(await readFile(deployConfig, "utf8"));
    if (
      generated.name !== "agent-blog" ||
      !generated.d1_databases?.some(
        (db) => db.database_id === "d6aac9aa-6536-46c0-9767-835b49c0613e",
      )
    )
      throw new Error("Refusing to deploy preview bindings to production");
    console.log(
      wrangler([
        "deploy",
        "--config",
        deployConfig,
        ...(dryRun ? ["--dry-run"] : []),
      ]),
    );
    if (dryRun) return { status: "validated" };
    const result = {
      status: "deployed",
      completedAt: new Date().toISOString(),
    };
    await writeFile(
      join(state, "last-cloudflare-deployment.json"),
      JSON.stringify(result, null, 2),
    );
    return result;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  console.log(
    JSON.stringify(
      await deploy({ dryRun: process.argv.includes("--dry-run") }),
    ),
  );
}
