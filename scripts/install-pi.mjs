#!/usr/bin/env node
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  applyPiInstallation,
  planPiInstallation,
} from "./lib/pi-installer.mjs";

const execFileAsync = promisify(execFile);
const fs = { chmod, mkdir, readFile, writeFile };

function parseArguments(argv) {
  const result = { excludedSessionIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") result.apply = true;
    else if (argument === "--confirm-no-persistent-subagents") result.noPersistentSubagents = true;
    else if (argument === "--confirm-repo-scoped-credential") {
      result.repoScopedCredentialConfirmed = true;
    } else if (argument === "--confirm-pi-auth-ready") {
      result.piAuthReadyConfirmed = true;
    } else if (argument.startsWith("--")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--exclude-session-id") result.excludedSessionIds.push(value);
      else result[argument.slice(2)] = value;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }
  return result;
}

async function command(binary, args, options = {}) {
  try {
    const result = await execFileAsync(binary, args, {
      maxBuffer: 12 * 1024 * 1024,
      ...options,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number.isInteger(error?.code) ? error.code : 1,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
    };
  }
}

const options = parseArguments(process.argv.slice(2));
const repositoryDir = resolve(options.repo || process.cwd());
const installerOptions = {
  repositoryDir,
  piAgentDir: resolve(
    options["pi-agent-dir"] || process.env.PI_CODING_AGENT_DIR || resolve(homedir(), ".pi/agent"),
  ),
  binary: options["pi-binary"] || "pi",
  command,
  fs,
  timeZone: options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  sourceId: options["source-id"],
  sourceLabel: options["source-label"],
  privateTerms: options["private-terms"]
    ? options["private-terms"].split(",").map((value) => value.trim()).filter(Boolean)
    : undefined,
  baseBranch: options["base-branch"],
  noPersistentSubagents: options.noPersistentSubagents === true,
  repoScopedCredentialConfirmed: options.repoScopedCredentialConfirmed === true,
  piAuthReadyConfirmed: options.piAuthReadyConfirmed === true,
  excludedSessionIds: options.excludedSessionIds,
  scheduler: options.scheduler || "manual",
};

const result = options.apply
  ? await applyPiInstallation({ ...installerOptions, apply: true })
  : await planPiInstallation(installerOptions);

console.log(JSON.stringify(result, null, 2));
