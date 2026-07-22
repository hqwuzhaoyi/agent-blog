import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { captureClaudeCodeHookInput } from "../scripts/install-claude-code.mjs";
import {
  CLAUDE_CODE_EXCLUDE_SESSION_ENV,
  CLAUDE_CODE_REVIEW_WORKER_ENV,
  readClaudeCodeCaptureJournal,
} from "../scripts/lib/claude-code-capture.mjs";
import {
  applyClaudeCodeInstallation,
  planClaudeCodeInstallation,
} from "../scripts/lib/claude-code-installer.mjs";

const SDK_PACKAGE = "@anthropic-ai/claude-agent-sdk";
const SDK_PIN = `${SDK_PACKAGE}@0.3.217`;

function fakeModuleLoader(overrides = {}) {
  const calls = [];
  return {
    calls,
    async load(specifier) {
      calls.push(specifier);
      return {
        version: "0.3.217",
        module: {
          listSessions: async () => [{
            sessionId: "private-session-id",
            summary: "private session summary",
            cwd: "/private/project",
          }],
          getSessionMessages: async () => [],
          ...overrides,
        },
      };
    },
  };
}

function fakeCommand(overrides = {}) {
  const calls = [];
  const responses = new Map([
    ["claude\0--version", { code: 0, stdout: "2.1.208 (Claude Code)\n" }],
    ["claude\0auth\0status", { code: 0, stdout: "private Claude credential status\n" }],
    ["git\0remote\0get-url\0origin", { code: 0, stdout: "git@github.com:example/agent-blog.git\n" }],
    ["git\0check-ignore\0-q\0.agent-blog", { code: 0, stdout: "" }],
    ["gh\0auth\0status", { code: 0, stdout: "private GitHub credential status\n" }],
    ["gh\0repo\0view\0--json\0nameWithOwner,viewerPermission", {
      code: 0,
      stdout: '{"nameWithOwner":"example/agent-blog","viewerPermission":"WRITE"}\n',
    }],
    ...Object.entries(overrides),
  ]);
  return {
    calls,
    async run(binary, args, options) {
      calls.push({ binary, args, options });
      const key = [binary, ...args].join("\0");
      if (!responses.has(key)) throw new Error(`Unexpected command: ${key}`);
      return { stderr: "", ...responses.get(key) };
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
    "/repo/.claude/settings.json": '{"permissions":{"allow":["Read"]}}\n',
    "/repo/.claude/skills/claude-code-review/SKILL.md": "review-window-only instructions\n",
  });
  return {
    moduleLoader,
    command,
    files,
    options: {
      repositoryDir: "/repo",
      moduleLoader: moduleLoader.load,
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repositoryCredentialConfirmed: true,
      now: () => new Date("2026-07-22T16:15:00.000Z"),
      ...overrides,
    },
  };
}

describe("Claude Code installer", () => {
  test("dry-run reports compatibility and the complete local setup plan without mutation", async () => {
    const fixture = setup();

    const result = await planClaudeCodeInstallation(fixture.options);

    expect(result).toMatchObject({
      status: "dry-run",
      compatibility: {
        cliVersion: "2.1.208",
        messageDisplay: true,
        packageName: SDK_PACKAGE,
        packagePin: SDK_PIN,
        sdkVersion: "0.3.217",
        capabilities: { listSessions: true, getSessionMessages: true },
      },
      authentication: { claudeCode: true, probe: "exit-status-only" },
      repositoryAccess: {
        git: true,
        github: true,
        scope: "operator-confirmed-repository-only",
        viewerPermission: "WRITE",
        operatorConfirmed: true,
      },
      hooks: {
        events: ["UserPromptSubmit", "MessageDisplay"],
        captureOnly: true,
        reviewWorkerEnv: "AGENT_BLOG_CLAUDE_REVIEW_WORKER",
      },
      skill: {
        path: ".claude/skills/claude-code-review/SKILL.md",
        reads: [".agent-blog/review-window.json"],
      },
      coverage: { startsOnApply: true, historicalBackfill: false },
      retention: { journalDays: 30 },
      privateState: { directory: ".agent-blog", fileMode: "0600" },
      schedule: {
        type: "desktop-local-task",
        installAutomatically: false,
        workingDirectory: "/repo",
        worktreeIsolation: false,
        environment: { AGENT_BLOG_CLAUDE_REVIEW_WORKER: "1" },
      },
    });
    expect(result.hooks.command).toContain(
      'AGENT_BLOG_CLAUDE_REVIEW_WORKER="${AGENT_BLOG_CLAUDE_REVIEW_WORKER:-0}"',
    );
    expect(fixture.moduleLoader.calls).toEqual([SDK_PACKAGE]);
    expect(JSON.stringify(result)).not.toContain("private Claude credential status");
    expect(JSON.stringify(result)).not.toContain("private GitHub credential status");
    expect(JSON.stringify(result)).not.toContain("private session summary");
    expect(JSON.stringify(result)).not.toContain("private-session-id");
    expect(JSON.stringify(result)).not.toContain("/private/project");
    expect(fixture.command.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ binary: "git", args: ["check-ignore", "-q", ".agent-blog"] }),
      expect.objectContaining({
        binary: "gh",
        args: ["repo", "view", "--json", "nameWithOwner,viewerPermission"],
      }),
    ]));
    expect(fixture.files.writes).toEqual([]);
  });

  test("fails closed without explicit repository-scoped credential confirmation", async () => {
    const fixture = setup({ repositoryCredentialConfirmed: false });

    await expect(planClaudeCodeInstallation(fixture.options)).rejects.toThrow(
      "repository-scoped credential confirmation",
    );

    expect(fixture.files.writes).toEqual([]);
  });

  test("fails closed when GitHub reports read-only repository access", async () => {
    const command = fakeCommand({
      "gh\0repo\0view\0--json\0nameWithOwner,viewerPermission": {
        code: 0,
        stdout: '{"nameWithOwner":"example/agent-blog","viewerPermission":"READ"}\n',
      },
    });
    const fixture = setup({ command: command.run });

    await expect(planClaudeCodeInstallation(fixture.options)).rejects.toThrow(
      "GitHub repository write permission is required",
    );

    expect(fixture.files.writes).toEqual([]);
  });

  test("apply refuses probes and writes without explicit operator authorization", async () => {
    const fixture = setup();

    await expect(applyClaudeCodeInstallation(fixture.options)).rejects.toThrow(
      "explicit --apply authorization",
    );

    expect(fixture.moduleLoader.calls).toEqual([]);
    expect(fixture.command.calls).toEqual([]);
    expect(fixture.files.writes).toEqual([]);
  });

  test("apply structurally merges capture hooks and private coverage without replacing customization", async () => {
    const moduleLoader = fakeModuleLoader();
    const command = fakeCommand();
    const existingSettings = {
      permissions: { allow: ["Read"], deny: ["WebFetch"] },
      enabledPlugins: { "keep-plugin": true },
      hooks: {
        UserPromptSubmit: [{
          matcher: "existing",
          hooks: [{ type: "command", command: "keep-user-hook" }],
        }],
        Stop: [{
          hooks: [{ type: "command", command: "keep-stop-hook" }],
        }],
      },
    };
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/.claude/settings.json": `${JSON.stringify(existingSettings)}\n`,
      "/repo/.claude/settings.local.json": '{"keep":"local"}\n',
      "/repo/.claude/skills/claude-code-review/SKILL.md": "review-window-only instructions\n",
      "/repo/.claude/skills/keep/SKILL.md": "keep skill\n",
      "/repo/.agent-blog/config.json": `${JSON.stringify({
        privateTerms: ["keep"],
        baseBranch: "publication",
        unrelatedSourceOption: true,
      })}\n`,
    });

    const result = await applyClaudeCodeInstallation({
      apply: true,
      repositoryDir: "/repo",
      moduleLoader: moduleLoader.load,
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repositoryCredentialConfirmed: true,
      now: () => new Date("2026-07-22T16:15:00.000Z"),
    });

    expect(result.status).toBe("configured");
    const settingsWrite = files.writes.find(({ path }) => path === "/repo/.claude/settings.json");
    const settings = JSON.parse(settingsWrite.content);
    expect(settings.permissions).toEqual(existingSettings.permissions);
    expect(settings.enabledPlugins).toEqual(existingSettings.enabledPlugins);
    expect(settings.hooks.Stop).toEqual(existingSettings.hooks.Stop);
    expect(settings.hooks.UserPromptSubmit[0]).toEqual(existingSettings.hooks.UserPromptSubmit[0]);
    expect(settings.hooks.UserPromptSubmit[1]).toMatchObject({
      matcher: "",
      hooks: [{
        type: "command",
        command: expect.stringContaining("--capture-hook"),
      }],
    });
    expect(settings.hooks.MessageDisplay).toEqual([
      expect.objectContaining({
        matcher: "",
        hooks: [{
          type: "command",
          command: expect.stringContaining("--capture-hook"),
        }],
      }),
    ]);
    expect(JSON.stringify(settings.hooks)).not.toContain("review --");

    const configWrite = files.writes.find(({ path }) => path === "/repo/.agent-blog/config.json");
    expect(JSON.parse(configWrite.content)).toEqual({
      privateTerms: ["keep"],
      baseBranch: "publication",
      unrelatedSourceOption: true,
      sourceId: "claude-code-local",
      sourceLabel: "Claude Code / Local",
      platform: "claude-code",
      timeZone: "Asia/Taipei",
      theme: "quiet-minimal",
      language: "zh-CN",
      claudeCode: {
        binary: "claude",
        sdkPackagePin: SDK_PIN,
        journalPath: ".agent-blog/claude-visible-events.json",
        repositoryAccess: {
          viewerPermission: "WRITE",
          credentialScopeConfirmedByOperator: true,
        },
        coverage: {
          startedAt: "2026-07-22T16:15:00.000Z",
          historicalBackfill: false,
        },
        retention: { journalDays: 30 },
      },
    });
    expect(settingsWrite.options).toEqual({ mode: 0o600 });
    expect(configWrite.options).toEqual({ mode: 0o600 });
    expect(files.writes).toEqual(expect.arrayContaining([
      { operation: "chmod", path: "/repo/.claude/settings.json", mode: 0o600 },
      { operation: "chmod", path: "/repo/.agent-blog/config.json", mode: 0o600 },
    ]));
    expect(files.writes.some(({ path }) => path === "/repo/.claude/settings.local.json")).toBe(false);
    expect(files.writes.some(({ path }) => path?.includes("/.claude/skills/keep/"))).toBe(false);
  });

  test("apply retry keeps the original coverage start and does not duplicate capture hooks", async () => {
    const moduleLoader = fakeModuleLoader();
    const command = fakeCommand();
    const captureCommand = 'AGENT_BLOG_CLAUDE_REVIEW_WORKER="${AGENT_BLOG_CLAUDE_REVIEW_WORKER:-0}" node "$CLAUDE_PROJECT_DIR/scripts/install-claude-code.mjs" --capture-hook';
    const hook = {
      matcher: "",
      hooks: [{ type: "command", command: captureCommand }],
    };
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/.claude/settings.json": `${JSON.stringify({
        hooks: {
          UserPromptSubmit: [hook],
          MessageDisplay: [hook],
        },
      })}\n`,
      "/repo/.claude/skills/claude-code-review/SKILL.md": "review-window-only instructions\n",
      "/repo/.agent-blog/config.json": `${JSON.stringify({
        claudeCode: {
          coverage: {
            startedAt: "2026-07-20T16:00:00.000Z",
            historicalBackfill: false,
          },
        },
      })}\n`,
    });

    await applyClaudeCodeInstallation({
      apply: true,
      repositoryDir: "/repo",
      moduleLoader: moduleLoader.load,
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repositoryCredentialConfirmed: true,
      now: () => new Date("2026-07-22T16:15:00.000Z"),
    });

    const settingsWrite = files.writes.find(({ path }) => path === "/repo/.claude/settings.json");
    const settings = JSON.parse(settingsWrite.content);
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.MessageDisplay).toHaveLength(1);
    const configWrite = files.writes.find(({ path }) => path === "/repo/.agent-blog/config.json");
    expect(JSON.parse(configWrite.content).claudeCode.coverage.startedAt).toBe(
      "2026-07-20T16:00:00.000Z",
    );
  });

  test("the project Review Skill reads only the complete private Review Window", async () => {
    const skill = await readFile(
      new URL("../.claude/skills/claude-code-review/SKILL.md", import.meta.url),
      "utf8",
    );

    expect(skill).toContain(".agent-blog/review-window.json");
    expect(skill).toContain("AGENT_BLOG_CLAUDE_REVIEW_WORKER");
    expect(skill).toContain("before Claude Code starts");
    expect(skill).not.toContain("CLAUDE_CODE_EXCLUDE_SESSION_ID");
    expect(skill).not.toContain("${CLAUDE_SESSION_ID}");
    expect(skill).toContain("incomplete");
    expect(skill).toContain("no-update");
    for (const forbidden of [
      "claude-visible-events",
      ".claude/projects",
      "getSessionMessages",
      "listSessions",
      "transcript_path",
    ]) expect(skill).not.toContain(forbidden);
  });

  test("the installer hook mode performs capture only against an explicit journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-hook-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookInput({
      input: JSON.stringify({
        session_id: "session-hook-test",
        hook_event_name: "UserPromptSubmit",
        prompt: "Capture only this visible prompt.",
      }),
      journalPath,
      receivedAt: "2026-07-22T16:20:00.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(result.status).toBe("captured");
    expect(journal.events.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Capture only this visible prompt." },
    ]);
  });

  test("the capture hook excludes the review session before creating a journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-hook-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookInput({
      input: JSON.stringify({
        session_id: "session-review-worker",
        hook_event_name: "UserPromptSubmit",
        prompt: "Do not persist the review session.",
      }),
      journalPath,
      receivedAt: "2026-07-22T16:20:00.000Z",
      excludeSessionId: "session-review-worker",
    });

    expect(CLAUDE_CODE_EXCLUDE_SESSION_ENV).toBe("CLAUDE_CODE_EXCLUDE_SESSION_ID");
    expect(result).toMatchObject({ status: "ignored", reason: "self-review-session" });
    await expect(readFile(journalPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("the capture hook excludes a marked review worker before creating a journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-hook-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookInput({
      input: JSON.stringify({
        session_id: "session-review-worker",
        hook_event_name: "UserPromptSubmit",
        prompt: "Do not persist any event from this worker.",
      }),
      journalPath,
      receivedAt: "2026-07-22T16:20:00.000Z",
      reviewWorker: true,
    });

    expect(CLAUDE_CODE_REVIEW_WORKER_ENV).toBe("AGENT_BLOG_CLAUDE_REVIEW_WORKER");
    expect(result).toMatchObject({ status: "ignored", reason: "self-review-worker" });
    await expect(readFile(journalPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects a Claude Code release from before MessageDisplay without writing", async () => {
    const command = fakeCommand({
      "claude\0--version": { code: 0, stdout: "2.1.165 (Claude Code)\n" },
    });
    const moduleLoader = fakeModuleLoader();
    const files = fakeFiles({
      "/repo/src/blog.config.json": '{"theme":"quiet-minimal","language":"zh-CN"}\n',
      "/repo/.claude/skills/claude-code-review/SKILL.md": "review-window-only instructions\n",
    });

    await expect(planClaudeCodeInstallation({
      repositoryDir: "/repo",
      moduleLoader: moduleLoader.load,
      command: command.run,
      files,
      timeZone: "Asia/Taipei",
      repositoryCredentialConfirmed: true,
    })).rejects.toThrow("MessageDisplay requires 2.1.166 or newer");

    expect(moduleLoader.calls).toEqual([]);
    expect(files.writes).toEqual([]);
  });

  test("rejects an Agent SDK version that differs from the tested exact pin", async () => {
    const fixture = setup({
      moduleLoader: async () => ({
        version: "0.2.60",
        module: { listSessions: async () => [], getSessionMessages: async () => [] },
      }),
    });

    await expect(planClaudeCodeInstallation(fixture.options)).rejects.toThrow(
      "expected 0.3.217",
    );
    expect(fixture.files.writes).toEqual([]);
  });

  test("OS scheduling is generated as a local plan and never installed by setup", async () => {
    const fixture = setup({ scheduler: "os" });

    const result = await planClaudeCodeInstallation(fixture.options);

    expect(result.schedule).toEqual({
      type: "os-scheduler",
      at: "00:15",
      timeZone: "Asia/Taipei",
      workingDirectory: "/repo",
      command: ["claude", "-p", "/claude-code-review"],
      environment: { AGENT_BLOG_CLAUDE_REVIEW_WORKER: "1" },
      generatedOnly: true,
      installAutomatically: false,
    });
    expect(fixture.command.calls.some(({ binary }) => (
      ["launchctl", "crontab", "systemctl"].includes(binary)
    ))).toBe(false);
    expect(fixture.files.writes).toEqual([]);
  });
});
