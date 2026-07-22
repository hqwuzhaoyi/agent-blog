#!/usr/bin/env node
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  captureClaudeCodeHookEvent,
  CLAUDE_CODE_EXCLUDE_SESSION_ENV,
  CLAUDE_CODE_REVIEW_WORKER_ENV,
} from "./lib/claude-code-capture.mjs";
import {
  applyClaudeCodeInstallation,
  planClaudeCodeInstallation,
} from "./lib/claude-code-installer.mjs";
import {
  CLAUDE_AGENT_SDK_PACKAGE,
  CLAUDE_AGENT_SDK_VERSION,
} from "./lib/claude-code-runtime.mjs";

const execFileAsync = promisify(execFile);

export async function captureClaudeCodeHookInput({
  input,
  journalPath,
  receivedAt,
  excludeSessionId,
  reviewWorker = false,
}) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Claude Code hook input is not valid JSON");
  }
  return captureClaudeCodeHookEvent({
    payload,
    journalPath,
    receivedAt,
    excludeSessionId,
    reviewWorker,
  });
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--apply", "--capture-hook", "--confirm-repo-scope"].includes(argument)) {
      values[argument.slice(2)] = true;
      continue;
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    values[argument.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function command(binary, args, options = {}) {
  try {
    const result = await execFileAsync(binary, args, {
      cwd: options.cwd,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed["capture-hook"]) {
    const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
    await captureClaudeCodeHookInput({
      input: await stdinText(),
      journalPath: resolve(projectDir, ".agent-blog/claude-visible-events.json"),
      receivedAt: new Date().toISOString(),
      excludeSessionId: process.env[CLAUDE_CODE_EXCLUDE_SESSION_ENV],
      reviewWorker: process.env[CLAUDE_CODE_REVIEW_WORKER_ENV] === "1",
    });
    return;
  }

  const repositoryDir = resolve(parsed.repo || process.cwd());
  const retentionDays = parsed["retention-days"] === undefined
    ? 30
    : Number(parsed["retention-days"]);
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error("--retention-days must be a positive integer");
  }
  const options = {
    apply: parsed.apply === true,
    repositoryDir,
    binary: parsed["claude-binary"] || "claude",
    timeZone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    sourceId: parsed["source-id"] || "claude-code-local",
    sourceLabel: parsed["source-label"] || "Claude Code / Local",
    scheduler: parsed.scheduler || "desktop",
    retentionDays,
    repositoryCredentialConfirmed: parsed["confirm-repo-scope"] === true,
    command,
    files: { chmod, mkdir, readFile, writeFile },
    moduleLoader: async (specifier) => {
      if (specifier !== CLAUDE_AGENT_SDK_PACKAGE) throw new Error("Unexpected SDK package");
      return {
        version: CLAUDE_AGENT_SDK_VERSION,
        module: await import(specifier),
      };
    },
  };
  const result = options.apply
    ? await applyClaudeCodeInstallation(options)
    : await planClaudeCodeInstallation(options);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
