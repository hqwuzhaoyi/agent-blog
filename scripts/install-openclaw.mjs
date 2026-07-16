#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const JOB_NAME = "Agent Blog daily review";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    if (argv[index + 1] && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return options;
}

async function command(binary, args, options = {}) {
  const result = await execFileAsync(binary, args, { maxBuffer: 6 * 1024 * 1024, ...options });
  return result.stdout.trim();
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  return parsed.result ?? parsed;
}

const options = parseArguments(process.argv.slice(2));
const repositoryDir = resolve(options.repo || process.cwd());
const timeZone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
const config = {
  sourceId: options["source-id"] || "openclaw-main",
  sourceLabel: options["source-label"] || "OpenClaw / Gateway 01",
  timeZone,
  privateTerms: options["private-terms"]
    ? String(options["private-terms"]).split(",").map((value) => value.trim()).filter(Boolean)
    : [],
  baseBranch: options["base-branch"] || "main",
};

const schedulePrompt = `Use the openclaw-review skill to run the complete daily review for the Publication Repository at ${repositoryDir}. Never merge the pull request.`;

if (options["dry-run"]) {
  console.log(JSON.stringify({
    status: "dry-run",
    repositoryDir,
    config,
    actions: [
      "verify OpenClaw Gateway",
      "verify GitHub repository access",
      "install the shared openclaw-review skill",
      `create ${JOB_NAME} at 00:15 ${timeZone}`,
      "collect a non-publishing Review Window preview",
    ],
  }, null, 2));
  process.exit(0);
}

await command("openclaw", ["--version"]);
await command("openclaw", ["gateway", "call", "status", "--params", "{}", "--json"]);
await command("gh", ["auth", "status"]);
const remote = await command("git", ["remote", "get-url", "origin"], { cwd: repositoryDir });
if (!/github\.com[:/]/.test(remote)) throw new Error("Publication Repository origin must be on GitHub");
await command("gh", ["repo", "view", "--json", "nameWithOwner"], { cwd: repositoryDir });

const localDir = resolve(repositoryDir, ".agent-blog");
await mkdir(localDir, { recursive: true });
await writeFile(resolve(localDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

await command("openclaw", [
  "skills",
  "install",
  resolve(repositoryDir, "skills/openclaw-review"),
  "--global",
  "--as",
  "openclaw-review",
]);

const cronPayload = parseJson(await command("openclaw", ["cron", "list", "--json"]));
const jobs = Array.isArray(cronPayload) ? cronPayload : cronPayload.jobs ?? [];
let job = jobs.find((item) => item.name === JOB_NAME);

if (!job) {
  const created = await command("openclaw", [
    "cron",
    "create",
    "15 0 * * *",
    schedulePrompt,
    "--name",
    JOB_NAME,
    "--session",
    "isolated",
    "--no-deliver",
    "--tz",
    timeZone,
    "--json",
  ]);
  job = parseJson(created);
}

const preview = await command("node", [resolve(repositoryDir, "scripts/review.mjs"), "collect"], {
  cwd: repositoryDir,
});

console.log(JSON.stringify({
  status: "installed",
  repositoryDir,
  timeZone,
  cronJob: { id: job.id ?? job.jobId, name: JOB_NAME },
  preview: parseJson(preview),
}, null, 2));
