import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test, vi } from "vitest";
import { selectPlatformCollection } from "../scripts/lib/platform-registry.mjs";
import { createReviewSubmission } from "../scripts/lib/review-core.mjs";

const execFileAsync = promisify(execFile);
const reviewScript = new URL("../scripts/review.mjs", import.meta.url);

async function* commandOutput(value = "") {
  yield value;
}

function hermesCommandResult(stdout) {
  return {
    stdout: commandOutput(stdout),
    stderr: commandOutput(),
    completed: Promise.resolve({ code: 0 }),
  };
}

function claudeCodeFixture(coverage) {
  return {
    claudeCode: {
      events: [{
        id: "claude-event-private",
        sessionId: "claude-session-private",
        messageId: "claude-message-private",
        role: "user",
        receivedAt: "2026-07-21T02:00:00.000Z",
        sequence: 1,
        text: "Collect this publication-safe Claude Code message.",
      }],
      inventory: [{ sessionId: "claude-session-private", provenance: "primary" }],
      coverage,
    },
  };
}

describe("Agent Platform selection", () => {
  test("resolves live and fixture Codex collection through the same registered platform", () => {
    const config = {
      platform: "codex",
      sourceId: "codex-local",
      timeZone: "Asia/Taipei",
    };

    const live = selectPlatformCollection({ config });
    const fixture = selectPlatformCollection({ config, fixture: { threads: [] } });

    expect([live.platform, fixture.platform]).toEqual([
      {
        id: "codex",
        label: "Codex",
        defaultSourceLabel: "Codex / Local",
      },
      {
        id: "codex",
        label: "Codex",
        defaultSourceLabel: "Codex / Local",
      },
    ]);
    expect([live.mode, fixture.mode]).toEqual(["live", "fixture"]);
  });

  test("resolves live and fixture OpenClaw collection through the same registered platform", () => {
    const config = {
      platform: "openclaw",
      sourceId: "openclaw-main",
      timeZone: "Asia/Taipei",
    };

    const live = selectPlatformCollection({ config });
    const fixture = selectPlatformCollection({ config, fixture: { sessions: [] } });

    expect([live.platform, fixture.platform]).toEqual([
      {
        id: "openclaw",
        label: "OpenClaw",
        defaultSourceLabel: "OpenClaw / Gateway 01",
      },
      {
        id: "openclaw",
        label: "OpenClaw",
        defaultSourceLabel: "OpenClaw / Gateway 01",
      },
    ]);
    expect([live.mode, fixture.mode]).toEqual(["live", "fixture"]);
  });

  test("resolves live and fixture Hermes collection through one registered platform", async () => {
    const config = {
      platform: "hermes",
      sourceId: "hermes-local",
      timeZone: "Asia/Taipei",
    };
    const syntheticFixture = {
      sessions: [{
        id: "hermes-main",
        source: "cli",
        messages: [{
          id: 1,
          role: "user",
          content: "Collect this Hermes message.",
          timestamp: 1784163600,
        }],
      }],
    };

    const live = selectPlatformCollection({ config });
    const fixture = selectPlatformCollection({ config, fixture: syntheticFixture });
    const window = await fixture.collect({
      config,
      fixture: syntheticFixture,
      sourceId: config.sourceId,
      reviewDay: "2026-07-16",
      timeZone: config.timeZone,
      state: { sessions: {} },
    });

    expect([live.platform, fixture.platform]).toEqual([
      {
        id: "hermes",
        label: "Hermes",
        defaultSourceLabel: "Hermes / Local",
      },
      {
        id: "hermes",
        label: "Hermes",
        defaultSourceLabel: "Hermes / Local",
      },
    ]);
    expect([live.mode, fixture.mode]).toEqual(["live", "fixture"]);
    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Collect this Hermes message." },
    ]);
  });

  test("rejects missing or conflicting Hermes source boundaries before running a command", async () => {
    for (const sourceBoundary of [
      {},
      { hermesHome: "/profiles/writer", hermesProfile: "writer" },
    ]) {
      const config = {
        platform: "hermes",
        sourceId: "hermes-local",
        timeZone: "Asia/Taipei",
        ...sourceBoundary,
      };
      const executeCommand = vi.fn();
      const live = selectPlatformCollection({ config });

      await expect(live.collect({
        config,
        sourceId: config.sourceId,
        reviewDay: "2026-07-16",
        timeZone: config.timeZone,
        state: { sessions: {} },
        executeCommand,
      })).rejects.toThrow("exactly one of hermesHome or hermesProfile");
      expect(executeCommand).not.toHaveBeenCalled();
    }
  });

  test.each([
    ["home", { hermesHome: "/profiles/writer" }],
    ["profile", { hermesProfile: "writer" }],
  ])("passes an explicit Hermes %s boundary into live collection", async (_label, sourceBoundary) => {
    const config = {
      platform: "hermes",
      sourceId: "hermes-local",
      timeZone: "Asia/Taipei",
      hermesBinary: "custom-hermes",
      reviewSessionId: "review-session",
      ...sourceBoundary,
    };
    const exported = `${JSON.stringify({
      id: "review-session",
      source: "cli",
      messages: [{
        id: 1,
        role: "user",
        content: "Exclude the active review session.",
        timestamp: 1784163600,
      }],
    })}\n`;
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return hermesCommandResult("Hermes Agent v0.11.4\n");
      if (args.at(-1) === "--help") {
        return hermesCommandResult("--source --session-id use - for stdout\n");
      }
      return hermesCommandResult(exported);
    });
    const live = selectPlatformCollection({ config });

    const window = await live.collect({
      config,
      sourceId: config.sourceId,
      reviewDay: "2026-07-16",
      timeZone: config.timeZone,
      state: { sessions: {} },
      executeCommand,
    });

    expect(executeCommand.mock.calls.map(([binary]) => binary)).toEqual([
      "custom-hermes",
      "custom-hermes",
      "custom-hermes",
    ]);
    expect(window.messages).toEqual([]);
  });

  test("resolves live and closed JSON fixture Pi collection through one registered platform", async () => {
    const config = {
      platform: "pi",
      sourceId: "pi-local",
      timeZone: "Asia/Taipei",
      piSessionDir: "/private/pi/sessions",
      piProvenance: {
        noPersistentSubagents: true,
        excludedSessionIds: [],
      },
      piSecurity: {
        repoScopedCredentialConfirmed: true,
        piAuthReadyConfirmed: true,
        credentialValuesRead: false,
      },
    };
    const syntheticFixture = {
      piSessions: [{
        sessionId: "pi-session-main",
        provenance: "primary",
        entries: [{
          type: "message",
          id: "pi-entry-1",
          timestamp: "2026-07-21T00:00:00.000Z",
          message: { role: "user", content: "Collect this Pi message." },
        }],
      }],
    };

    const live = selectPlatformCollection({ config });
    const fixture = selectPlatformCollection({ config, fixture: syntheticFixture });
    const window = await fixture.collect({
      config,
      fixture: syntheticFixture,
      sourceId: config.sourceId,
      reviewDay: "2026-07-21",
      timeZone: config.timeZone,
      state: { sessions: {} },
    });

    expect([live.platform, fixture.platform]).toEqual([
      { id: "pi", label: "Pi", defaultSourceLabel: "Pi / Local" },
      { id: "pi", label: "Pi", defaultSourceLabel: "Pi / Local" },
    ]);
    expect([live.mode, fixture.mode]).toEqual(["live", "fixture"]);
    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Collect this Pi message." },
    ]);
    expect(window).not.toHaveProperty("deferred");
  });

  test("rejects incomplete live Pi configuration before selecting a collector", () => {
    const complete = {
      platform: "pi",
      sourceId: "pi-local",
      timeZone: "Asia/Taipei",
      piSessionDir: "/private/pi/sessions",
      piProvenance: {
        noPersistentSubagents: true,
        excludedSessionIds: [],
      },
      piSecurity: {
        repoScopedCredentialConfirmed: true,
        piAuthReadyConfirmed: true,
        credentialValuesRead: false,
      },
    };
    const incomplete = [
      { ...complete, piSessionDir: undefined },
      { ...complete, piProvenance: undefined },
      { ...complete, piProvenance: { excludedSessionIds: [] } },
      { ...complete, piSecurity: undefined },
      {
        ...complete,
        piSecurity: { ...complete.piSecurity, repoScopedCredentialConfirmed: false },
      },
      {
        ...complete,
        piSecurity: { ...complete.piSecurity, piAuthReadyConfirmed: false },
      },
    ];

    for (const config of incomplete) {
      let failure;
      try {
        selectPlatformCollection({ config });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        name: "PiSdkError",
        code: "incomplete-config",
        message: "Pi Agent Source configuration is incomplete",
      });
    }
  });

  test("resolves live and closed fixture Claude Code collection through one registered platform", async () => {
    const config = {
      platform: "claude-code",
      sourceId: "claude-code-local",
      timeZone: "Asia/Taipei",
    };
    const syntheticFixture = {
      claudeCode: {
        events: [{
          id: "claude-event-1",
          sessionId: "claude-session-main",
          messageId: "claude-message-1",
          role: "user",
          receivedAt: "2026-07-21T02:00:00.000Z",
          sequence: 1,
          text: "Collect this Claude Code message.",
        }],
        inventory: [{ sessionId: "claude-session-main", provenance: "primary" }],
        coverage: {
          startedAt: "2026-07-20T16:00:00.000Z",
          completedAt: "2026-07-21T16:00:00.000Z",
          complete: true,
          gaps: [],
          reconciliation: "matched",
        },
      },
    };

    const live = selectPlatformCollection({ config });
    const fixture = selectPlatformCollection({ config, fixture: syntheticFixture });
    const window = await fixture.collect({
      config,
      fixture: syntheticFixture,
      sourceId: config.sourceId,
      reviewDay: "2026-07-21",
      timeZone: config.timeZone,
      state: { sessions: {} },
    });

    expect([live.platform, fixture.platform]).toEqual([
      {
        id: "claude-code",
        label: "Claude Code",
        defaultSourceLabel: "Claude Code / Local",
      },
      {
        id: "claude-code",
        label: "Claude Code",
        defaultSourceLabel: "Claude Code / Local",
      },
    ]);
    expect([live.mode, fixture.mode]).toEqual(["live", "fixture"]);
    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Collect this Claude Code message." },
    ]);
  });

  test("stops an incomplete Claude Code collection before writing window or cursor state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-claude-platform-"));
    const configPath = join(directory, "config.json");
    const fixturePath = join(directory, "private-fixture.json");
    const windowPath = join(directory, "review-window.json");
    const statePath = join(directory, "state.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "claude-code",
        sourceId: "claude-code-local",
        timeZone: "Asia/Taipei",
      }));
      await writeFile(fixturePath, JSON.stringify(claudeCodeFixture({
        startedAt: "2026-07-21T00:00:00.000Z",
        completedAt: "2026-07-21T16:00:00.000Z",
        complete: true,
        gaps: [],
        reconciliation: "matched",
      })));

      let failure;
      try {
        await execFileAsync(process.execPath, [
          reviewScript.pathname,
          "collect",
          "--config",
          configPath,
          "--fixture",
          fixturePath,
          "--window",
          windowPath,
          "--state",
          statePath,
          "--day",
          "2026-07-21",
        ], { cwd: directory });
      } catch (error) {
        failure = error;
      }

      expect(failure?.stderr).toContain("Agent Platform collection is incomplete: historical-coverage-missing");
      expect(failure?.stderr).not.toContain("claude-session-private");
      expect(failure?.stderr).not.toContain(fixturePath);
      await expect(access(windowPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(statePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("writes a complete Claude Code fixture as a Review Window", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-claude-platform-"));
    const configPath = join(directory, "config.json");
    const fixturePath = join(directory, "fixture.json");
    const windowPath = join(directory, "review-window.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "claude-code",
        sourceId: "claude-code-local",
        timeZone: "Asia/Taipei",
      }));
      await writeFile(fixturePath, JSON.stringify(claudeCodeFixture({
        startedAt: "2026-07-20T16:00:00.000Z",
        completedAt: "2026-07-21T16:00:00.000Z",
        complete: true,
        gaps: [],
        reconciliation: "matched",
      })));

      await execFileAsync(process.execPath, [
        reviewScript.pathname,
        "collect",
        "--config",
        configPath,
        "--fixture",
        fixturePath,
        "--window",
        windowPath,
        "--day",
        "2026-07-21",
      ], { cwd: directory });
      const window = JSON.parse(await readFile(windowPath, "utf8"));

      expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
        { role: "user", text: "Collect this publication-safe Claude Code message." },
      ]);
      expect(window).not.toHaveProperty("status");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects path-bearing Pi fixture sessions at the registry boundary", () => {
    const config = {
      platform: "pi",
      sourceId: "pi-local",
      timeZone: "Asia/Taipei",
    };
    const fixture = {
      piSessions: [{
        sessionId: "pi-session-main",
        provenance: "primary",
        entries: [],
        path: "/private/raw-pi-session.jsonl",
      }],
    };
    const selected = selectPlatformCollection({ config, fixture });

    expect(() => selected.collect({
      config,
      fixture,
      sourceId: config.sourceId,
      reviewDay: "2026-07-21",
      timeZone: config.timeZone,
      state: { sessions: {} },
    })).toThrow("Pi session contains an unsupported schema");
  });

  test("rejects an unknown platform before writing a Review Window", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-platform-"));
    const configPath = join(directory, "config.json");
    const fixturePath = join(directory, "fixture.json");
    const windowPath = join(directory, "review-window.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "mystery-agent",
        sourceId: "mystery-local",
        sourceLabel: "Mystery / Local",
        timeZone: "Asia/Taipei",
      }));
      await writeFile(fixturePath, JSON.stringify({ sessions: [] }));

      await expect(execFileAsync(process.execPath, [
        reviewScript.pathname,
        "collect",
        "--config",
        configPath,
        "--fixture",
        fixturePath,
        "--window",
        windowPath,
        "--day",
        "2026-07-16",
      ], { cwd: directory })).rejects.toThrow(/Unsupported Agent Platform: mystery-agent/);
      await expect(access(windowPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects an unknown platform before committing candidate cursors", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-platform-"));
    const configPath = join(directory, "config.json");
    const windowPath = join(directory, "review-window.json");
    const statePath = join(directory, "state.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "mystery-agent",
        sourceId: "mystery-local",
        sourceLabel: "Mystery / Local",
        timeZone: "Asia/Taipei",
      }));
      await writeFile(windowPath, JSON.stringify({
        sourceId: "mystery-local",
        reviewDay: "2026-07-16",
        candidateCursors: {
          conversation: { timestamp: 1784167200000, messageId: "message-1" },
        },
      }));

      await expect(execFileAsync(process.execPath, [
        reviewScript.pathname,
        "no-update",
        "--config",
        configPath,
        "--window",
        windowPath,
        "--state",
        statePath,
      ], { cwd: directory })).rejects.toThrow(/Unsupported Agent Platform: mystery-agent/);
      await expect(access(statePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("rejects an incomplete platform configuration before writing a Review Window", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-platform-"));
    const configPath = join(directory, "config.json");
    const fixturePath = join(directory, "fixture.json");
    const windowPath = join(directory, "review-window.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "codex",
        timeZone: "Asia/Taipei",
      }));
      await writeFile(fixturePath, JSON.stringify({ threads: [] }));

      await expect(execFileAsync(process.execPath, [
        reviewScript.pathname,
        "collect",
        "--config",
        configPath,
        "--fixture",
        fixturePath,
        "--window",
        windowPath,
        "--day",
        "2026-07-16",
      ], { cwd: directory })).rejects.toThrow(/Missing required config field: sourceId/);
      await expect(access(windowPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("fails closed before Codex collection when the review thread id is unavailable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agent-blog-codex-platform-"));
    const configPath = join(directory, "config.json");
    const windowPath = join(directory, "review-window.json");
    const statePath = join(directory, "state.json");

    try {
      await writeFile(configPath, JSON.stringify({
        platform: "codex",
        sourceId: "codex-local",
        timeZone: "Asia/Taipei",
      }));

      let failure;
      try {
        await execFileAsync(process.execPath, [
          reviewScript.pathname,
          "collect",
          "--config",
          configPath,
          "--window",
          windowPath,
          "--state",
          statePath,
          "--day",
          "2026-07-16",
        ], {
          cwd: directory,
          env: { ...process.env, CODEX_THREAD_ID: "" },
        });
      } catch (error) {
        failure = error;
      }

      expect(failure?.stderr).toContain("Codex collection requires the current review thread id");
      await expect(access(windowPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(statePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("uses attribution from the selected platform registration", () => {
    const submission = createReviewSubmission({
      config: {
        platform: "codex",
        sourceId: "codex-local",
        sourceLabel: "owner@example.com",
        timeZone: "Asia/Taipei",
      },
      reviewDay: "2026-07-16",
      draft: {
        title: "Codex support",
        summary: "Codex became an Agent Source.",
        highlights: [{
          title: "Added Codex collection",
          outcome: "Visible Codex messages can now enter a Review Window.",
        }],
      },
    });

    expect(submission.markdown).toContain('source: "Codex / Local"');
    expect(submission.markdown).toContain('platforms: ["Codex"]');
  });
});
