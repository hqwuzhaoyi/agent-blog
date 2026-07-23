import { describe, expect, test } from "vitest";
import {
  applyCodexInstallation,
  parseCodexInstallerArguments,
  planCodexInstallation,
} from "../scripts/lib/codex-installer.mjs";

function fakeCommand() {
  const calls = [];
  const responses = new Map([
    ["codex\0--version", "codex-cli 0.144.5\n"],
    ["codex\0login\0status", "private Codex account details\n"],
    ["codex\0app-server\0--help", "Run the app server\n--listen <URL>\n"],
    ["git\0status\0--porcelain", ""],
    ["git\0check-ignore\0.agent-blog", ".agent-blog\n"],
    ["git\0remote\0get-url\0origin", "git@github.com:example/agent-blog.git\n"],
    ["gh\0auth\0status", "private GitHub credential details\n"],
    ["gh\0repo\0view\0--json\0viewerPermission", '{"viewerPermission":"WRITE"}\n'],
  ]);
  return {
    calls,
    async run(binary, args, options) {
      calls.push({ binary, args, options });
      const key = [binary, ...args].join("\0");
      if (!responses.has(key)) throw new Error(`Unexpected command: ${key}`);
      return { code: 0, stdout: responses.get(key), stderr: "" };
    },
  };
}

function fakeFiles(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    async readFile(path) {
      if (!values.has(path)) {
        const error = new Error(`missing: ${path}`);
        error.code = "ENOENT";
        throw error;
      }
      return values.get(path);
    },
    async mkdir(path, options) {
      writes.push({ operation: "mkdir", path, options });
    },
    async writeFile(path, content, options) {
      writes.push({ operation: "writeFile", path, content, options });
      values.set(path, content);
    },
    async chmod(path, mode) {
      writes.push({ operation: "chmod", path, mode });
    },
  };
}

function setup(overrides = {}) {
  const command = fakeCommand();
  const files = fakeFiles({
    "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    "/repo/.agents/skills/codex-review/SKILL.md": "Require CODEX_THREAD_ID and pass --exclude-thread-id before collection.\n",
  });
  return {
    command,
    files,
    options: {
      repositoryDir: "/repo",
      binary: "codex",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repoScopedCredentialConfirmed: true,
      ...overrides,
    },
  };
}

describe("Codex installer", () => {
  test("argument parsing defaults to dry-run and requires explicit apply and repository scope flags", () => {
    expect(parseCodexInstallerArguments([])).toEqual({
      apply: false,
      repoScopedCredentialConfirmed: false,
    });
    expect(parseCodexInstallerArguments([
      "--apply",
      "--confirm-repo-scope",
      "--timezone",
      "Asia/Taipei",
    ])).toEqual({
      apply: true,
      repoScopedCredentialConfirmed: true,
      timezone: "Asia/Taipei",
    });
    expect(() => parseCodexInstallerArguments(["--apply", "--dry-run"])).toThrow(
      "Choose either --apply or --dry-run",
    );
  });

  test("dry-run verifies Codex and repository capability without writing files", async () => {
    const fixture = setup();

    const result = await planCodexInstallation(fixture.options);

    expect(result).toMatchObject({
      status: "dry-run",
      compatibility: { cliVersion: "0.144.5", appServer: true },
      authentication: { codex: true },
      repositoryAccess: {
        privateStateIgnored: true,
        viewerPermission: "WRITE",
        repoScopedCredentialConfirmed: true,
      },
      source: { id: "codex-local", label: "Codex / Local", platform: "codex" },
    });
    expect(fixture.command.calls.map(({ binary, args }) => [binary, ...args])).toEqual([
      ["codex", "--version"],
      ["codex", "login", "status"],
      ["codex", "app-server", "--help"],
      ["git", "status", "--porcelain"],
      ["git", "check-ignore", ".agent-blog"],
      ["git", "remote", "get-url", "origin"],
      ["gh", "auth", "status"],
      ["gh", "repo", "view", "--json", "viewerPermission"],
    ]);
    expect(JSON.stringify(result)).not.toContain("private Codex account details");
    expect(JSON.stringify(result)).not.toContain("private GitHub credential details");
    expect(fixture.files.writes).toEqual([]);
  });

  test("dry-run verifies the review worker self-exclusion contract", async () => {
    const fixture = setup();

    const result = await planCodexInstallation(fixture.options);

    expect(result.selfExclusion).toEqual({
      required: true,
      environmentVariable: "CODEX_THREAD_ID",
      collectOption: "--exclude-thread-id",
    });
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply refuses all probes and writes without explicit operator authorization", async () => {
    const fixture = setup();

    await expect(applyCodexInstallation(fixture.options)).rejects.toThrow(
      "explicit --apply authorization",
    );

    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("setup fails closed without repository-scoped credential confirmation", async () => {
    const fixture = setup({ repoScopedCredentialConfirmed: false });

    await expect(planCodexInstallation(fixture.options)).rejects.toThrow(
      "confirm the GitHub credential is scoped only to the Publication Repository",
    );

    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply writes private config without starting an unscoped review", async () => {
    const fixture = setup({
      privateTerms: ["Internal Project"],
      baseBranch: "publication",
    });

    const result = await applyCodexInstallation({ ...fixture.options, apply: true });

    expect(result).toMatchObject({
      status: "configured",
      selfExclusion: {
        required: true,
        environmentVariable: "CODEX_THREAD_ID",
        collectOption: "--exclude-thread-id",
      },
    });
    const configWrite = fixture.files.writes.find((entry) => (
      entry.operation === "writeFile" && entry.path === "/repo/.agent-blog/config.json"
    ));
    expect(JSON.parse(configWrite.content)).toEqual({
      sourceId: "codex-local",
      sourceLabel: "Codex / Local",
      platform: "codex",
      timeZone: "Asia/Taipei",
      privateTerms: ["Internal Project"],
      baseBranch: "publication",
      theme: "quiet-minimal",
      language: "zh-CN",
    });
    expect(configWrite.options).toEqual({ mode: 0o600 });
    expect(fixture.files.writes).toContainEqual({
      operation: "chmod",
      path: "/repo/.agent-blog/config.json",
      mode: 0o600,
    });
    expect(fixture.command.calls.some(({ binary }) => binary === "node")).toBe(false);
  });
});
