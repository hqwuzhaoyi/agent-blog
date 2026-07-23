import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  captureClaudeCodeHookEvent,
  readClaudeCodeCaptureJournal,
} from "../scripts/lib/claude-code-capture.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/claude-code/hook-events.json", import.meta.url), "utf8"),
);

describe("Claude Code prospective capture exclusions", () => {
  test("retains no tool, thinking, image, result, synthetic, subagent, malformed, empty, or unknown payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:04:00.000Z",
    });

    const results = [];
    for (const [index, payload] of fixture.excluded.entries()) {
      results.push(await captureClaudeCodeHookEvent({
        payload,
        journalPath,
        receivedAt: `2026-07-22T00:04:${String(index + 1).padStart(2, "0")}.000Z`,
      }));
    }
    const journal = await readClaudeCodeCaptureJournal(journalPath);
    const bytes = await readFile(journalPath, "utf8");

    expect(results.every((result) => result.status === "ignored")).toBe(true);
    expect(journal.events).toHaveLength(1);
    expect(journal.pendingDisplays).toEqual({});
    for (const privateValue of [
      "never-persist-this-secret",
      "private chain of thought",
      "/private/screenshot.png",
      "private tool result",
      "synthetic background notification",
      "intermediate subagent output",
      "wrong shape",
      "future private value",
    ]) expect(bytes).not.toContain(privateValue);
  });

  test("excludes the capture worker's own review session", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:05:00.000Z",
      excludeSessionId: "session-user-a",
    });

    expect(result).toMatchObject({ status: "ignored", reason: "self-review-session" });
    await expect(readFile(journalPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
