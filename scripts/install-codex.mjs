#!/usr/bin/env node
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  applyCodexInstallation,
  parseCodexInstallerArguments,
  planCodexInstallation,
} from "./lib/codex-installer.mjs";

const execFileAsync = promisify(execFile);
const files = { chmod, mkdir, readFile, writeFile };

async function command(binary, args, options = {}) {
  try {
    const result = await execFileAsync(binary, args, { maxBuffer: 12 * 1024 * 1024, ...options });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number.isInteger(error?.code) ? error.code : 1,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
    };
  }
}

const options = parseCodexInstallerArguments(process.argv.slice(2));
const repositoryDir = resolve(options.repo || process.cwd());
const timeZone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
const installerOptions = {
  repositoryDir,
  binary: options["codex-binary"] || "codex",
  command,
  files,
  timeZone,
  sourceId: options["source-id"] || "codex-local",
  sourceLabel: options["source-label"] || "Codex / Local",
  privateTerms: options["private-terms"]
    ? String(options["private-terms"]).split(",").map((value) => value.trim()).filter(Boolean)
    : undefined,
  baseBranch: options["base-branch"] || "main",
  repoScopedCredentialConfirmed: options.repoScopedCredentialConfirmed === true,
};

const result = options.apply
  ? await applyCodexInstallation({ ...installerOptions, apply: true })
  : await planCodexInstallation(installerOptions);

console.log(JSON.stringify(result, null, 2));
