#!/usr/bin/env node
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  applyHermesInstallation,
  parseHermesInstallerArguments,
  planHermesInstallation,
} from "./lib/hermes-installer.mjs";

const execFileAsync = promisify(execFile);

async function command(binary, args, options = {}) {
  const commandOptions = {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    maxBuffer: 4 * 1024 * 1024,
  };
  try {
    const result = await execFileAsync(binary, args, commandOptions);
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function main() {
  const parsed = parseHermesInstallerArguments(process.argv.slice(2));
  const operatorHome = homedir();
  const options = {
    ...parsed,
    repositoryDir: resolve(parsed.repositoryDir || process.cwd()),
    userHome: operatorHome,
    timeZone: parsed.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    binary: parsed.binary || "hermes",
    command,
    files: { chmod, mkdir, readFile, writeFile },
  };

  const result = options.apply
    ? await applyHermesInstallation(options)
    : await planHermesInstallation(options);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
