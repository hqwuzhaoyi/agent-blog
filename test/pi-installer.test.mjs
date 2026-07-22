import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";

import {
  applyPiInstallation,
  PiInstallerError,
  planPiInstallation,
} from "../scripts/lib/pi-installer.mjs";
import { loadPiSdkRuntime } from "../scripts/lib/pi-sdk.mjs";

const PACKAGE_NAME = "@earendil-works/pi-coding-agent";

function fakeModuleLoader(overrides = {}) {
  const calls = [];
  return {
    calls,
    async load(specifier) {
      calls.push(specifier);
      return {
        VERSION: "0.81.1",
        CURRENT_SESSION_VERSION: 3,
        SessionManager: {
          async listAll() {},
          open() {},
        },
        ...overrides,
      };
    },
  };
}

function fakeCommand(overrides = {}) {
  const calls = [];
  const responses = new Map([
    ["pi\0--version", "pi 0.81.2\n"],
    [
      "pi\0--help",
      "-p, --print\n--no-session\n--skill <path>\n--offline\n--list-models [search]\n",
    ],
    ["git\0status\0--porcelain", ""],
    ["git\0check-ignore\0.agent-blog", ".agent-blog\n"],
    ["git\0remote\0get-url\0origin", "git@github.com:example/agent-blog.git\n"],
    ["gh\0auth\0status", "private credential details\n"],
    ["gh\0repo\0view\0--json\0nameWithOwner", '{"nameWithOwner":"example/agent-blog"}\n'],
    ["gh\0repo\0view\0--json\0viewerPermission", '{"viewerPermission":"WRITE"}\n'],
    ...Object.entries(overrides),
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
  const moduleLoader = fakeModuleLoader();
  const command = fakeCommand();
  const files = fakeFiles({
    "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
  });
  return {
    moduleLoader,
    command,
    files,
    options: {
      repositoryDir: "/repo",
      piAgentDir: "/users/alice/.pi/agent",
      moduleLoader: moduleLoader.load,
      command: command.run,
      fs: files,
      timeZone: "Asia/Taipei",
      noPersistentSubagents: true,
      repoScopedCredentialConfirmed: true,
      piAuthReadyConfirmed: true,
      ...overrides,
    },
  };
}

describe("Pi installer", () => {
  test("dry-run verifies the Earendil CLI and SDK contract without writing files", async () => {
    const fixture = setup();

    const result = await planPiInstallation(fixture.options);

    expect(result).toMatchObject({
      status: "dry-run",
      compatibility: {
        packageName: PACKAGE_NAME,
        packagePin: `${PACKAGE_NAME}@0.81.1`,
        cliVersion: "0.81.2",
        sdkVersion: "0.81.1",
        sessionVersion: 3,
        sessionManager: { listAll: true, open: true },
        matrix: {
          cli: "0.81.x",
          sdk: "0.81.1",
          session: 3,
        },
      },
      source: {
        id: "pi-local",
        label: "Pi / Local",
        platform: "pi",
      },
    });
    expect(fixture.moduleLoader.calls).toEqual([PACKAGE_NAME]);
    expect(JSON.stringify(result)).not.toContain("private credential details");
    expect(fixture.files.writes).toEqual([]);
  });

  test("dry-run verifies private Agent Blog state is ignored by Git", async () => {
    const fixture = setup();

    const result = await planPiInstallation(fixture.options);

    expect(result.repositoryAccess.privateStateIgnored).toBe(true);
    expect(fixture.command.calls).toContainEqual({
      binary: "git",
      args: ["check-ignore", ".agent-blog"],
      options: { cwd: "/repo" },
    });
    expect(fixture.files.writes).toEqual([]);
  });

  test("dry-run verifies repository write permission and records repo-scoped credential confirmation", async () => {
    const fixture = setup();

    const result = await planPiInstallation(fixture.options);

    expect(result.repositoryAccess).toMatchObject({
      viewerPermission: "WRITE",
      repoScopedCredentialConfirmed: true,
    });
    expect(fixture.command.calls).toContainEqual({
      binary: "gh",
      args: ["repo", "view", "--json", "viewerPermission"],
      options: { cwd: "/repo" },
    });
    expect(fixture.command.calls).not.toContainEqual(expect.objectContaining({
      binary: "gh",
      args: ["auth", "status"],
    }));
    expect(JSON.stringify(result)).not.toContain("private credential details");
  });

  test("setup fails closed without explicit repo-scoped credential confirmation", async () => {
    const fixture = setup({ repoScopedCredentialConfirmed: false });

    await expect(planPiInstallation(fixture.options)).rejects.toThrow(
      "confirm the GitHub credential is scoped only to the Publication Repository",
    );

    expect(fixture.moduleLoader.calls).toEqual([]);
    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("dry-run records the non-secret Pi capability probe and explicit auth readiness confirmation", async () => {
    const fixture = setup();

    const result = await planPiInstallation(fixture.options);

    expect(result.piAccess).toEqual({
      capabilityProbe: "pi --help",
      supportsOfflineModelStatus: true,
      piAuthReadyConfirmed: true,
      credentialValuesRead: false,
    });
    expect(fixture.command.calls).not.toContainEqual(expect.objectContaining({
      binary: "pi",
      args: ["--offline", "--list-models"],
    }));
    expect(JSON.stringify(result)).not.toMatch(/api[_-]?key|oauth|token/i);
  });

  test("setup fails closed without explicit Pi auth readiness confirmation", async () => {
    const fixture = setup({ piAuthReadyConfirmed: false });

    await expect(planPiInstallation(fixture.options)).rejects.toThrow(
      "confirm Pi authentication is configured and working",
    );

    expect(fixture.moduleLoader.calls).toEqual([]);
    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply refuses all probes and writes without explicit operator authorization", async () => {
    const fixture = setup();

    await expect(applyPiInstallation(fixture.options)).rejects.toThrow(
      "explicit --apply authorization",
    );

    expect(fixture.moduleLoader.calls).toEqual([]);
    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply requires explicit confirmation that the source has no persistent subagents", async () => {
    const fixture = setup({ noPersistentSubagents: false });

    await expect(applyPiInstallation({ ...fixture.options, apply: true })).rejects.toThrow(
      "confirm that this Pi Agent Source has no persistent subagents",
    );

    expect(fixture.moduleLoader.calls).toEqual([]);
    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply merges a mode-0600 Pi source config without changing unrelated config or extensions", async () => {
    const moduleLoader = fakeModuleLoader();
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/.agent-blog/config.json": `${JSON.stringify({
        privateTerms: ["keep"],
        baseBranch: "publication",
        unrelatedExtensionPolicy: { enabled: true },
      })}\n`,
      "/users/alice/.pi/agent/extensions/keep.ts": "keep extension\n",
      "/repo/.pi/settings.json": '{"extensions":["keep"]}\n',
    });

    const result = await applyPiInstallation({
      apply: true,
      repositoryDir: "/repo",
      piAgentDir: "/users/alice/.pi/agent",
      moduleLoader: moduleLoader.load,
      command: command.run,
      fs: files,
      timeZone: "Asia/Taipei",
      noPersistentSubagents: true,
      repoScopedCredentialConfirmed: true,
      piAuthReadyConfirmed: true,
      excludedSessionIds: ["known-subagent"],
    });

    expect(result.status).toBe("configured");
    const configWrite = files.writes.find((entry) => (
      entry.operation === "writeFile" && entry.path === "/repo/.agent-blog/config.json"
    ));
    expect(JSON.parse(configWrite.content)).toEqual({
      privateTerms: ["keep"],
      baseBranch: "publication",
      unrelatedExtensionPolicy: { enabled: true },
      sourceId: "pi-local",
      sourceLabel: "Pi / Local",
      platform: "pi",
      timeZone: "Asia/Taipei",
      theme: "quiet-minimal",
      language: "zh-CN",
      piAgentDir: "/users/alice/.pi/agent",
      piSessionDir: "/users/alice/.pi/agent/sessions",
      piProvenance: {
        noPersistentSubagents: true,
        excludedSessionIds: ["known-subagent"],
      },
      piSecurity: {
        repoScopedCredentialConfirmed: true,
        piAuthReadyConfirmed: true,
        credentialValuesRead: false,
      },
    });
    expect(configWrite.options).toEqual({ mode: 0o600 });
    expect(files.writes).toContainEqual({
      operation: "chmod",
      path: "/repo/.agent-blog/config.json",
      mode: 0o600,
    });
    expect(files.writes.some(({ path }) => path?.startsWith("/users/alice/.pi/agent"))).toBe(false);
    expect(files.writes.some(({ path }) => path === "/repo/.pi/settings.json")).toBe(false);
  });

  test("an unsupported CLI line fails closed before setup can write", async () => {
    const moduleLoader = fakeModuleLoader();
    const command = fakeCommand({ "pi\0--version": "pi 0.82.0\n" });
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const error = await planPiInstallation({
      repositoryDir: "/repo",
      piAgentDir: "/users/alice/.pi/agent",
      moduleLoader: moduleLoader.load,
      command: command.run,
      fs: files,
      timeZone: "Asia/Taipei",
      repoScopedCredentialConfirmed: true,
      piAuthReadyConfirmed: true,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(PiInstallerError);
    expect(error.code).toBe("unsupported-cli");
    expect(files.writes).toEqual([]);
  });

  test("the OS scheduler remains a described one-shot Pi plan and is never installed", async () => {
    const fixture = setup({ scheduler: "os" });

    const result = await applyPiInstallation({ ...fixture.options, apply: true });

    expect(result.lifecycle.worker).toEqual({
      binary: "pi",
      args: [
        "-p",
        "--no-session",
        "--skill",
        "/repo/.agents/skills/pi-review/SKILL.md",
        "Use the pi-review skill to run the complete Agent Blog daily review. Never merge the pull request.",
      ],
      cwd: "/repo",
      oneShot: true,
      persistentSession: false,
    });
    expect(result.schedule).toEqual({
      type: "os-scheduler",
      applied: false,
      descriptor: {
        cron: "15 0 * * *",
        timeZone: "Asia/Taipei",
        workingDirectory: "/repo",
        command: result.lifecycle.worker,
        installAutomatically: false,
      },
    });
    expect(fixture.command.calls.some(({ binary }) => (
      /launchctl|systemctl|crontab/.test(binary)
    ))).toBe(false);
  });

  test("an unsupported scheduler cannot partially apply configuration", async () => {
    const fixture = setup({ scheduler: "launchd" });

    await expect(applyPiInstallation({ ...fixture.options, apply: true })).rejects.toThrow(
      "scheduler must be manual or os",
    );

    expect(fixture.files.writes).toEqual([]);
  });
});

describe("Pi SDK runtime facade", () => {
  test("classifies provenance only from explicit operator policy", async () => {
    const confirmedLoader = fakeModuleLoader();
    const confirmed = await loadPiSdkRuntime({
      moduleLoader: confirmedLoader.load,
      provenancePolicy: {
        noPersistentSubagents: true,
        excludedSessionIds: ["known-subagent"],
      },
    });
    const uncertainLoader = fakeModuleLoader();
    const uncertain = await loadPiSdkRuntime({
      moduleLoader: uncertainLoader.load,
      provenancePolicy: {
        noPersistentSubagents: false,
        excludedSessionIds: ["known-subagent"],
      },
    });

    expect(confirmed.classifySession("known-subagent")).toBe("subagent");
    expect(confirmed.classifySession("ordinary-session")).toBe("primary");
    expect(uncertain.classifySession("known-subagent")).toBe("subagent");
    expect(uncertain.classifySession("ordinary-session")).toBe("unknown");
  });
});

describe("Pi Review Skill", () => {
  test("the repo skill consumes only the normalized Review Window in an ephemeral Pi run", async () => {
    const skill = await readFile(
      new URL("../.agents/skills/pi-review/SKILL.md", import.meta.url),
      "utf8",
    );

    expect(skill).toContain("pi -p --no-session");
    expect(skill).toContain(".agent-blog/review-window.json");
    expect(skill).toContain(".agent-blog/config.json");
    expect(skill).toContain("npm run review -- collect");
    expect(skill).toContain("npm run review -- manual");
    expect(skill).toContain("npm run review -- submit");
    expect(skill).toContain("npm run review -- no-update");
    expect(skill).toContain("existing Pi provider and model configuration");
    expect(skill).not.toMatch(/SessionManager|\.jsonl|\.pi\/agent\/sessions/i);
  });
});
