import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, test, vi } from "vitest";
import {
  buildHermesReviewWindow,
  collectHermesWindow,
  createHermesCommandExecutor,
  probeHermesCompatibility,
} from "../scripts/lib/hermes-cli.mjs";

const exportFixture = await readFile(
  new URL("./fixtures/hermes/export-v0.11.jsonl", import.meta.url),
  "utf8",
);
const lineageFixture = await readFile(
  new URL("./fixtures/hermes/lineage-v0.11.jsonl", import.meta.url),
  "utf8",
);
const hermesCliSource = await readFile(
  new URL("../scripts/lib/hermes-cli.mjs", import.meta.url),
  "utf8",
);
const syntheticHermesHome = "/synthetic/hermes-home";

async function* chunks(...values) {
  for (const value of values) yield value;
}

function result(stdout, { code = 0, stderr = "" } = {}) {
  return {
    stdout: chunks(stdout),
    stderr: chunks(stderr),
    completed: Promise.resolve({ code }),
  };
}

function liveSpawn(outputs) {
  return vi.fn(() => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();
    const stdout = outputs.shift();
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.stderr.end();
      child.emit("close", 0, null);
    });
    return child;
  });
}

describe("Hermes CLI collection", () => {
  test("live export has no whole-session projected accumulator", () => {
    expect(hermesCliSource).not.toContain("readExportSessions");
    expect(hermesCliSource).not.toMatch(/sessions\.push\(projectExportSession/);
  });

  test("exposes the standard Review Window builder for registry fixtures", () => {
    const window = buildHermesReviewWindow({
      sessions: [JSON.parse(exportFixture.trim())],
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window.sourceId).toBe("hermes-local");
    expect(window.messages.map(({ id }) => id)).toEqual(["1", "2"]);
  });

  test("fixture Review Window builder uses the same unknown-schema allowlist", () => {
    expect(() => buildHermesReviewWindow({
      sessions: [{
        id: "future-fixture",
        source: "cli",
        messages: [{
          id: 1,
          role: "assistant",
          content: [{ type: "future-content", payload: "must-not-leak" }],
          timestamp: 1784163600,
        }],
      }],
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    })).toThrow(/^Unsupported Hermes export schema at line 1$/);
  });

  test("provides a stream-preserving executor for the local Hermes binary", async () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();
    const spawnProcess = vi.fn(() => child);
    const executeCommand = createHermesCommandExecutor({
      hermesHome: syntheticHermesHome,
      spawnProcess,
    });

    const execution = await executeCommand("custom-hermes", ["sessions", "export", "-"]);
    child.stdout.end("export data\n");
    child.stderr.end();
    child.emit("close", 0, null);

    expect(spawnProcess).toHaveBeenCalledWith(
      "custom-hermes",
      ["sessions", "export", "-"],
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
        env: expect.objectContaining({ HERMES_HOME: syntheticHermesHome }),
      }),
    );
    expect(await readFileFromStream(execution.stdout)).toBe("export data\n");
    await expect(execution.completed).resolves.toEqual({ code: 0, signal: null });
    execution.cancel();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  test("live collection pins all Hermes commands to the explicit home", async () => {
    const spawnProcess = liveSpawn([
      "Hermes Agent v0.11.4\n",
      "--source --session-id use - for stdout\n",
      exportFixture,
    ]);
    const executeCommand = createHermesCommandExecutor({
      hermesHome: "/profiles/writer",
      spawnProcess,
    });

    await collectHermesWindow({
      sourceId: "hermes-writer",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: "/profiles/writer",
      executeCommand,
    });

    expect(spawnProcess.mock.calls.map(([, args]) => args)).toEqual([
      ["--version"],
      ["sessions", "export", "--help"],
      ["sessions", "export", "-"],
    ]);
    for (const [, , options] of spawnProcess.mock.calls) {
      expect(options.env.HERMES_HOME).toBe("/profiles/writer");
    }
  });

  test("live collection pins all Hermes commands to the explicit profile", async () => {
    const spawnProcess = liveSpawn([
      "Hermes Agent v0.11.4\n",
      "--source --session-id use - for stdout\n",
      exportFixture,
    ]);
    const executeCommand = createHermesCommandExecutor({
      hermesProfile: "writer",
      spawnProcess,
    });

    await collectHermesWindow({
      sourceId: "hermes-writer",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesProfile: "writer",
      executeCommand,
    });

    expect(spawnProcess.mock.calls.map(([, args]) => args)).toEqual([
      ["--profile", "writer", "--version"],
      ["--profile", "writer", "sessions", "export", "--help"],
      ["--profile", "writer", "sessions", "export", "-"],
    ]);
    for (const [, , options] of spawnProcess.mock.calls) {
      expect(options.env?.HERMES_HOME).toBeUndefined();
    }
  });

  test("live collection requires exactly one explicit Hermes source boundary", async () => {
    const executeCommand = vi.fn(async () => result("Hermes Agent v0.11.4\n"));
    const base = {
      sourceId: "hermes-writer",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      executeCommand,
    };

    await expect(collectHermesWindow(base)).rejects.toThrow(
      "exactly one of hermesHome or hermesProfile",
    );
    await expect(collectHermesWindow({
      ...base,
      hermesHome: "/profiles/writer",
      hermesProfile: "writer",
    })).rejects.toThrow("exactly one of hermesHome or hermesProfile");
    expect(() => createHermesCommandExecutor({
      hermesHome: "/profiles/writer",
      hermesProfile: "writer",
    })).toThrow("exactly one of hermesHome or hermesProfile");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  test("fails closed outside the tested Hermes version and exporter capability", async () => {
    const unsupportedVersion = vi.fn(async () => result("Hermes Agent v0.18.2\n"));
    await expect(probeHermesCompatibility({
      executeCommand: unsupportedVersion,
    })).rejects.toThrow("Unsupported Hermes version; expected v0.11.x");
    expect(unsupportedVersion).toHaveBeenCalledOnce();

    const missingStdoutCapability = vi.fn(async (_binary, args) => (
      args[0] === "--version"
        ? result("Hermes Agent v0.11.9\n")
        : result("--source --session-id\n")
    ));
    await expect(probeHermesCompatibility({
      executeCommand: missingStdoutCapability,
    })).rejects.toThrow("Hermes session exporter does not expose the required stdout contract");

    let drainedChunks = 0;
    const failedProbe = vi.fn(async () => ({
      stdout: chunks(),
      stderr: (async function* sensitiveStderr() {
        for (const value of ["secret-token", "/private/profile/path", "x".repeat(100_000)]) {
          drainedChunks += 1;
          yield value;
        }
      }()),
      completed: Promise.resolve({ code: 1 }),
    }));
    await expect(probeHermesCompatibility({ executeCommand: failedProbe }))
      .rejects.toThrow(/^Hermes version probe failed$/);
    expect(drainedChunks).toBe(3);
  });

  test("uses the supported exporter and keeps only human and primary-agent Visible Messages", async () => {
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0 (2026.4.23)\n");
      if (args.at(-1) === "--help") {
        return result("usage: hermes sessions export output [--source SOURCE] [--session-id SESSION_ID]\noutput: use - for stdout\n");
      }
      return result(exportFixture);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    });

    expect(executeCommand.mock.calls.map(([, args]) => args)).toEqual([
      ["--version"],
      ["sessions", "export", "--help"],
      ["sessions", "export", "-"],
    ]);
    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Add Hermes as an Agent Source." },
      { role: "assistant", text: "The Hermes collector is covered by tests." },
    ]);
    expect(window.candidateCursors["hermes-main"]).toEqual({
      timestamp: 1784167200000,
      messageId: "2",
    });
  });

  test("fails atomically when one streamed export line exceeds the configured limit", async () => {
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") {
        return result("--source --session-id use - for stdout\n");
      }
      return {
        stdout: chunks(exportFixture.slice(0, 40), exportFixture.slice(40)),
        stderr: chunks(),
        completed: Promise.resolve({ code: 0 }),
      };
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
      maxExportLineBytes: 80,
    })).rejects.toThrow("Hermes export line exceeds 80 bytes");
  });

  test("rejects malformed and failed exports without echoing raw session content", async () => {
    const rawSecret = "raw-private-session-content";
    const cancel = vi.fn();
    const malformedExecutor = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return {
        stdout: chunks(`{\"id\":\"valid-empty\",\"source\":\"cli\",\"messages\":[]}\n{\"${rawSecret}\":`),
        stderr: chunks(),
        completed: Promise.resolve({ code: 0 }),
        cancel,
      };
    });
    let malformedError;
    try {
      await collectHermesWindow({
        sourceId: "hermes-local",
        reviewDay: "2026-07-16",
        timeZone: "Asia/Taipei",
        state: { sessions: {} },
        hermesHome: syntheticHermesHome,
        executeCommand: malformedExecutor,
      });
    } catch (error) {
      malformedError = error;
    }
    expect(malformedError?.message).toBe("Malformed Hermes export JSONL at line 2");
    expect(malformedError?.message).not.toContain(rawSecret);
    expect(cancel).toHaveBeenCalledOnce();

    const failedExecutor = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(`{\"${rawSecret}\":true}\n`, {
        code: 2,
        stderr: "export failed: secret-token /private/profile/path",
      });
    });
    let exportError;
    try {
      await collectHermesWindow({
        sourceId: "hermes-local",
        reviewDay: "2026-07-16",
        timeZone: "Asia/Taipei",
        state: { sessions: {} },
        hermesHome: syntheticHermesHome,
        executeCommand: failedExecutor,
      });
    } catch (error) {
      exportError = error;
    }
    expect(exportError?.message).toBe("Hermes session export failed");
    expect(exportError?.message).not.toMatch(/secret-token|private\/profile|raw-private/);
    expect(hermesCliSource).not.toMatch(/readText\(result\.stderr\)|stderr\.trim\(\)/);
  });

  test("sanitizes exporter stream failures before returning them", async () => {
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return {
        stdout: (async function* failedStream() {
          throw new Error("stream failed in /private/profile/path with secret-token");
        }()),
        stderr: chunks("another-secret"),
        completed: Promise.resolve({ code: 1 }),
        cancel() {
          throw new Error("cancel leaked /private/profile/path");
        },
      };
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    })).rejects.toThrow(/^Hermes session export failed$/);
  });

  test("keeps compression continuations and user branches while excluding live-parent children and automation", async () => {
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(lineageFixture);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    });

    expect(window.messages.map(({ sessionKey, text }) => ({ sessionKey, text }))).toEqual([
      { sessionKey: "compressed-tip", text: "Compression continuation remains visible." },
      { sessionKey: "branch-child", text: "Explore the user-created branch." },
    ]);
  });

  test("keeps structured text while stripping orphan reasoning and leaked tool markup", async () => {
    const exported = `${JSON.stringify({
      id: "markup-session",
      source: "cli",
      parent_session_id: null,
      messages: [
        {
          id: 61,
          role: "user",
          content: [
            { type: "text", text: "Keep this user text." },
            { type: "image_url", image_url: { url: "file:///private/image.png" } },
          ],
          timestamp: 1784163600,
        },
        {
          id: 62,
          role: "assistant",
          content: "private scratchpad</reasoning><tool_call>{\"secret\":true}</tool_call>Keep this assistant text.",
          timestamp: 1784167200,
        },
      ],
    })}\n`;
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Keep this user text." },
      { role: "assistant", text: "Keep this assistant text." },
    ]);
  });

  test("fails the whole window on an unknown candidate message role", async () => {
    const exported = [
      {
        id: "known-session",
        source: "cli",
        messages: [{ id: 1, role: "user", content: "Valid earlier text.", timestamp: 1784163600 }],
      },
      {
        id: "future-role-session",
        source: "cli",
        messages: [{ id: 2, role: "future-role", content: "must-not-leak", timestamp: 1784167200 }],
      },
    ].map((session) => JSON.stringify(session)).join("\n").concat("\n");
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    })).rejects.toThrow(/^Unsupported Hermes export schema at line 2$/);
  });

  test("fails the whole window when an eligible session has a non-array messages schema", async () => {
    const exported = [
      {
        id: "known-session",
        source: "cli",
        messages: [{ id: 1, role: "user", content: "Valid earlier text.", timestamp: 1784163600 }],
      },
      {
        id: "future-schema-session",
        source: "cli",
        messages: { role: "assistant", content: "must-not-leak", timestamp: 1784167200 },
      },
    ].map((session) => JSON.stringify(session)).join("\n").concat("\n");
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    })).rejects.toThrow(/^Unsupported Hermes export schema at line 2$/);
  });

  test("fails the whole window on an unknown candidate content block", async () => {
    const exported = [
      {
        id: "known-session",
        source: "cli",
        messages: [{ id: 1, role: "user", content: "Valid earlier text.", timestamp: 1784163600 }],
      },
      {
        id: "future-content-session",
        source: "cli",
        messages: [{
          id: 2,
          role: "assistant",
          content: [
            { type: "text", text: "must-not-be-partially-kept" },
            { type: "future-content", payload: "must-not-leak" },
          ],
          timestamp: 1784167200,
        }],
      },
    ].map((session) => JSON.stringify(session)).join("\n").concat("\n");
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    })).rejects.toThrow(/^Unsupported Hermes export schema at line 2$/);
  });

  test("orders integer message IDs numerically when timestamps tie", async () => {
    const exported = `${JSON.stringify({
      id: "cursor-session",
      source: "cli",
      parent_session_id: null,
      messages: [
        { id: 2, role: "user", content: "Already reviewed.", timestamp: 1784163600 },
        { id: 10, role: "assistant", content: "New at the same timestamp.", timestamp: 1784163600 },
      ],
    })}\n`;
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "cursor-session": { timestamp: 1784163600000, messageId: "2" },
        },
      },
      hermesHome: syntheticHermesHome,
      executeCommand,
    });

    expect(window.messages.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "10", text: "New at the same timestamp." },
    ]);
    expect(window.candidateCursors["cursor-session"].messageId).toBe("10");
  });

  test("fails closed when a saved cursor anchor disappears before newer rewritten rows", async () => {
    const exported = `${JSON.stringify({
      id: "rewritten-session",
      source: "cli",
      parent_session_id: null,
      messages: [
        { id: 80, role: "user", content: "Reinserted older prompt.", timestamp: 1784163600 },
        { id: 81, role: "assistant", content: "Reinserted older answer.", timestamp: 1784167200 },
      ],
    })}\n`;
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    await expect(collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "rewritten-session": { timestamp: 1784160000000, messageId: "7" },
        },
      },
      hermesHome: syntheticHermesHome,
      executeCommand,
    })).rejects.toThrow("Hermes session rewrite detected: rewritten-session");
  });

  test("excludes the Hermes session running the review workflow", async () => {
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exportFixture);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
      excludeSessionId: "hermes-main",
    });

    expect(window.messages).toEqual([]);
    expect(window.candidateCursors).toEqual({});
  });

  test("does not admit inactive compacted messages", async () => {
    const exported = `${JSON.stringify({
      id: "compacted-session",
      source: "cli",
      parent_session_id: null,
      messages: [
        {
          id: 91,
          role: "user",
          content: "Archived pre-compaction prompt.",
          timestamp: 1784163600,
          active: 0,
          compacted: 1,
        },
        {
          id: 92,
          role: "assistant",
          content: "Active post-compaction response.",
          timestamp: 1784167200,
          active: 1,
          compacted: 0,
        },
      ],
    })}\n`;
    const executeCommand = vi.fn(async (_binary, args) => {
      if (args[0] === "--version") return result("Hermes Agent v0.11.0\n");
      if (args.at(-1) === "--help") return result("--source --session-id use - for stdout\n");
      return result(exported);
    });

    const window = await collectHermesWindow({
      sourceId: "hermes-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      hermesHome: syntheticHermesHome,
      executeCommand,
    });

    expect(window.messages.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "92", text: "Active post-compaction response." },
    ]);
  });
});

async function readFileFromStream(stream) {
  let value = "";
  for await (const chunk of stream) value += chunk.toString();
  return value;
}
