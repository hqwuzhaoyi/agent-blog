import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";

import {
  applyHermesInstallation,
  parseHermesInstallerArguments,
  planHermesInstallation,
} from "../scripts/lib/hermes-installer.mjs";

const installHermesSource = await readFile(
  new URL("../scripts/install-hermes.mjs", import.meta.url),
  "utf8",
);

function fakeCommand() {
  const calls = [];
  const responses = new Map([
    ["hermes\0--version", "Hermes Agent v0.11.4\n"],
    ["hermes\0--profile\0writer\0--version", "Hermes Agent v0.11.4\n"],
    [
      "hermes\0sessions\0export\0--help",
      "output JSONL file path (use - for stdout)\n--source TEXT\n--session-id TEXT\n",
    ],
    [
      "hermes\0--profile\0writer\0sessions\0export\0--help",
      "output JSONL file path (use - for stdout)\n--source TEXT\n--session-id TEXT\n",
    ],
    ["hermes\0status\0--all", "redacted status: configured\n"],
    ["hermes\0--profile\0writer\0status\0--all", "redacted status: configured\n"],
    ["git\0status\0--porcelain", ""],
    ["git\0remote\0get-url\0origin", "git@github.com:example/agent-blog.git\n"],
    ["git\0check-ignore\0.agent-blog", ".agent-blog\n"],
    ["gh\0auth\0status", "credential details that must not be returned\n"],
    [
      "gh\0auth\0status\0--active\0--hostname\0github.com",
      "credential details that must not be returned\n",
    ],
    ["gh\0repo\0view\0--json\0nameWithOwner", '{"nameWithOwner":"example/agent-blog"}\n'],
    ["gh\0repo\0view\0--json\0viewerPermission", '{"viewerPermission":"WRITE"}\n'],
  ]);
  return {
    calls,
    async run(binary, args, options) {
      calls.push({ binary, args, options });
      const key = [binary, ...args].join("\0");
      if (key.startsWith("hermes\0cron\0create\0")) {
        return { code: 0, stdout: '{"id":"job-7"}\n', stderr: "" };
      }
      if (!responses.has(key)) throw new Error(`Unexpected command: ${key}`);
      return { code: 0, stdout: responses.get(key), stderr: "" };
    },
  };
}

function fakeFiles(initial = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    async readFile(path) {
      if (!files.has(path)) {
        const error = new Error(`missing: ${path}`);
        error.code = "ENOENT";
        throw error;
      }
      return files.get(path);
    },
    async mkdir(path, options) {
      writes.push({ operation: "mkdir", path, options });
    },
    async writeFile(path, content, options) {
      writes.push({ operation: "writeFile", path, content, options });
      files.set(path, content);
    },
    async chmod(path, mode) {
      writes.push({ operation: "chmod", path, mode });
    },
  };
}

describe("Hermes installer", () => {
  test("setup requires an explicit profile or home without environment fallback", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    await expect(planHermesInstallation({
      repositoryDir: "/repo",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    })).rejects.toThrow("Choose a Hermes profile or home");
    expect(command.calls).toEqual([]);
    expect(installHermesSource).not.toContain("process.env.HERMES_HOME");
    expect(installHermesSource).not.toMatch(/options\.hermesHome\s*=/);
  });

  test("dry-run verifies compatibility and repository access without writing files", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const result = await planHermesInstallation({
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    });

    expect(result).toMatchObject({
      status: "dry-run",
      compatibility: { version: "0.11.4", exporter: true },
      repositoryAccess: { git: true, github: true },
      source: {
        id: "hermes-writer",
        label: "Hermes / writer",
        platform: "hermes",
        boundary: { type: "home", value: "/profiles/writer" },
      },
    });
    expect(JSON.stringify(result)).not.toContain("credential details");
    expect(files.writes).toEqual([]);
  });

  test("dry-run verifies private-state ignore, repository write access, and redacted Hermes auth status", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const result = await planHermesInstallation({
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repositoryCredentialConfirmed: false,
    });

    expect(result.compatibility).toMatchObject({
      version: "0.11.4",
      exporter: true,
      authentication: "redacted-status-verified",
    });
    expect(result.repositoryAccess).toEqual({
      git: true,
      github: true,
      viewerPermission: "WRITE",
      privateStateIgnored: true,
      credentialScope: {
        operatorConfirmed: false,
        requiredForApply: true,
      },
    });
    expect(command.calls.map(({ binary, args }) => [binary, ...args])).toEqual(expect.arrayContaining([
      ["hermes", "status", "--all"],
      ["git", "check-ignore", ".agent-blog"],
      ["gh", "auth", "status", "--active", "--hostname", "github.com"],
      ["gh", "repo", "view", "--json", "viewerPermission"],
    ]));
    expect(JSON.stringify(result)).not.toContain("credential details");
    expect(files.writes).toEqual([]);
  });

  test("apply refuses to proceed without explicit operator authorization", async () => {
    const command = fakeCommand();
    const files = fakeFiles();

    await expect(applyHermesInstallation({
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
    })).rejects.toThrow("explicit --apply authorization");

    expect(command.calls).toEqual([]);
    expect(files.writes).toEqual([]);
  });

  test("apply requires and records explicit repository credential-scope confirmation", async () => {
    const command = fakeCommand();
    const files = fakeFiles();

    await expect(applyHermesInstallation({
      apply: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
    })).rejects.toThrow("--confirm-repo-scope");
    expect(command.calls).toEqual([]);
    expect(files.writes).toEqual([]);
    expect(parseHermesInstallerArguments(["--apply", "--confirm-repo-scope"]))
      .toMatchObject({ apply: true, repositoryCredentialConfirmed: true });
  });

  test("apply writes a mode-0600 private source config and only the repo Review Skill", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/skills/hermes-review/SKILL.md": "repo-owned review instructions\n",
      "/profiles/writer/config.yaml": "unrelated: keep\n",
      "/profiles/writer/.env": "SECRET=keep\n",
    });

    const result = await applyHermesInstallation({
      apply: true,
      repositoryCredentialConfirmed: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    });

    expect(result.status).toBe("configured");
    const configWrite = files.writes.find((entry) => entry.path === "/repo/.agent-blog/config.json");
    expect(JSON.parse(configWrite.content)).toMatchObject({
      sourceId: "hermes-writer",
      sourceLabel: "Hermes / writer",
      platform: "hermes",
      hermesHome: "/profiles/writer",
      timeZone: "Asia/Taipei",
      theme: "quiet-minimal",
      language: "zh-CN",
      repositoryCredentialScopeConfirmed: true,
    });
    expect(configWrite.options).toEqual({ mode: 0o600 });
    expect(files.writes).toContainEqual({
      operation: "chmod",
      path: "/repo/.agent-blog/config.json",
      mode: 0o600,
    });
    expect(files.writes).toContainEqual({
      operation: "writeFile",
      path: "/profiles/writer/skills/agent-blog-review/SKILL.md",
      content: "repo-owned review instructions\n",
      options: { mode: 0o600 },
    });
    expect(files.writes.some((entry) => /(?:config\.yaml|\.env)$/.test(entry.path))).toBe(false);
  });

  test("a selected Hermes profile is one isolated Agent Source", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const result = await planHermesInstallation({
      repositoryDir: "/repo",
      profile: "writer",
      userHome: "/users/alice",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    });

    expect(result.source).toEqual({
      id: "hermes-writer",
      label: "Hermes / writer",
      platform: "hermes",
      boundary: { type: "profile", value: "writer" },
    });
    expect(command.calls.slice(0, 2).map(({ args }) => args)).toEqual([
      ["--profile", "writer", "--version"],
      ["--profile", "writer", "sessions", "export", "--help"],
    ]);
    expect(files.writes).toEqual([]);
  });

  test("manual and scheduled workers share the npm review lifecycle", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const result = await planHermesInstallation({
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    });

    expect(result.lifecycle.manual.reviewCommand).toEqual([
      "npm", "run", "review", "--", "manual",
    ]);
    expect(result.lifecycle.scheduled.reviewCommand).toEqual([
      "npm", "run", "review", "--", "collect",
    ]);
    expect(result.lifecycle.manual.worker.args.at(-1)).toContain("npm run review -- manual");
    expect(result.lifecycle.scheduled.worker.args.at(-1)).toContain("npm run review -- collect");
    expect(result.lifecycle.worker).toMatchObject({
      binary: "hermes",
      oneShot: true,
      persistentConfigChanges: false,
      source: "tool",
    });
    expect(result.lifecycle.worker.args).toEqual(expect.arrayContaining([
      "chat", "--quiet", "--skills", "agent-blog-review", "--source", "tool", "-q",
    ]));
    expect(result.schedules.hermesCron).toMatchObject({
      cron: "15 0 * * *",
      timeZone: "Asia/Taipei",
      gatewayRequired: true,
    });
    expect(result.schedules.osScheduler).toMatchObject({
      timeZone: "Asia/Taipei",
      workingDirectory: "/repo",
      installAutomatically: false,
    });
  });

  test("apply creates an idempotently named Hermes cron only through the command seam", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/skills/hermes-review/SKILL.md": "repo-owned review instructions\n",
    });
    const originalRun = command.run;
    command.run = async (binary, args, options) => {
      const key = [binary, ...args].join("\0");
      if (key === "hermes\0cron\0status") {
        command.calls.push({ binary, args, options });
        return { code: 0, stdout: "running\n", stderr: "" };
      }
      if (key === "hermes\0cron\0list\0--json") {
        command.calls.push({ binary, args, options });
        return { code: 0, stdout: '{"jobs":[]}\n', stderr: "" };
      }
      return originalRun(binary, args, options);
    };

    const result = await applyHermesInstallation({
      apply: true,
      repositoryCredentialConfirmed: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      scheduler: "hermes",
    });

    expect(result.schedule).toEqual({
      type: "hermes-cron",
      applied: true,
      id: "job-7",
      name: "Agent Blog daily review",
    });
    const create = command.calls.find(({ args }) => args[0] === "cron" && args[1] === "create");
    expect(create.args).toEqual(expect.arrayContaining([
      "15 0 * * *",
      "--name", "Agent Blog daily review",
      "--skill", "agent-blog-review",
      "--workdir", "/repo",
    ]));
  });

  test("the Hermes Review Skill consumes only the private normalized Review Window", async () => {
    const skill = await readFile(
      new URL("../skills/hermes-review/SKILL.md", import.meta.url),
      "utf8",
    );

    expect(skill).toContain(".agent-blog/review-window.json");
    expect(skill).toContain(".agent-blog/config.json");
    expect(skill).toContain("npm run review -- collect");
    expect(skill).toContain("npm run review -- manual");
    expect(skill).toContain("npm run review -- submit");
    expect(skill).toContain("npm run review -- no-update");
    expect(skill).toContain("existing Hermes provider and model configuration");
    expect(skill).not.toMatch(/sessions export|state\.db|\.hermes\/sessions/i);
  });

  test("CLI arguments default to dry-run and reserve mutation for --apply", () => {
    expect(parseHermesInstallerArguments([
      "--repo", "/repo",
      "--hermes-home", "/profiles/writer",
    ])).toMatchObject({
      apply: false,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
    });
    expect(parseHermesInstallerArguments(["--apply"]).apply).toBe(true);
    expect(() => parseHermesInstallerArguments(["--apply", "--dry-run"]))
      .toThrow("Choose either --apply or --dry-run");
  });

  test("retry reuses the existing named Hermes cron instead of duplicating it", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/skills/hermes-review/SKILL.md": "repo-owned review instructions\n",
    });
    const originalRun = command.run;
    command.run = async (binary, args, options) => {
      const key = [binary, ...args].join("\0");
      if (key === "hermes\0cron\0status") {
        command.calls.push({ binary, args, options });
        return { code: 0, stdout: "running\n", stderr: "" };
      }
      if (key === "hermes\0cron\0list\0--json") {
        command.calls.push({ binary, args, options });
        return {
          code: 0,
          stdout: '{"jobs":[{"id":"job-existing","name":"Agent Blog daily review"}]}\n',
          stderr: "",
        };
      }
      return originalRun(binary, args, options);
    };

    const result = await applyHermesInstallation({
      apply: true,
      repositoryCredentialConfirmed: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      scheduler: "hermes",
    });

    expect(result.schedule.id).toBe("job-existing");
    expect(command.calls.some(({ args }) => args.includes("create"))).toBe(false);
  });

  test("OS scheduling remains an unapplied local descriptor", async () => {
    const command = fakeCommand();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/skills/hermes-review/SKILL.md": "repo-owned review instructions\n",
    });

    const result = await applyHermesInstallation({
      apply: true,
      repositoryCredentialConfirmed: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      scheduler: "os",
    });

    expect(result.schedule).toMatchObject({
      type: "os-scheduler",
      applied: false,
      descriptor: { installAutomatically: false, workingDirectory: "/repo" },
    });
    expect(command.calls.some(({ args }) => args.includes("cron"))).toBe(false);
  });

  test("unsupported Hermes versions fail before private state is written", async () => {
    const command = fakeCommand();
    const originalRun = command.run;
    command.run = async (binary, args, options) => {
      if (binary === "hermes" && args.at(-1) === "--version") {
        command.calls.push({ binary, args, options });
        return { code: 0, stdout: "Hermes Agent v0.18.2\n", stderr: "" };
      }
      return originalRun(binary, args, options);
    };
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/skills/hermes-review/SKILL.md": "repo-owned review instructions\n",
    });

    await expect(applyHermesInstallation({
      apply: true,
      repositoryCredentialConfirmed: true,
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
    })).rejects.toThrow("expected v0.11.x");
    expect(files.writes).toEqual([]);
  });

  test("Hermes-cron dry-run verifies gateway scheduler readiness without mutation", async () => {
    const command = fakeCommand();
    const originalRun = command.run;
    command.run = async (binary, args, options) => {
      if ([binary, ...args].join("\0") === "hermes\0cron\0status") {
        command.calls.push({ binary, args, options });
        return { code: 0, stdout: "scheduler running\n", stderr: "" };
      }
      return originalRun(binary, args, options);
    };
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
    });

    const result = await planHermesInstallation({
      repositoryDir: "/repo",
      hermesHome: "/profiles/writer",
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      scheduler: "hermes",
    });

    expect(result.scheduleSelection).toEqual({
      type: "hermes-cron",
      gatewayScheduler: "available",
      applied: false,
    });
    expect(files.writes).toEqual([]);
  });
});
