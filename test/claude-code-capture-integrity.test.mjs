import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  captureClaudeCodeHookEvent,
  readClaudeCodeCaptureJournal,
} from "../scripts/lib/claude-code-capture.mjs";

describe("Claude Code capture journal integrity", () => {
  test("marks uncertain primary-agent provenance incomplete without storing its text", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-uncertain",
        hook_event_name: "UserPromptSubmit",
        prompt: "Do not retain this provenance-uncertain prompt.",
        agent_type: "custom-reviewer",
      },
      journalPath,
      receivedAt: "2026-07-22T00:06:00.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);
    const bytes = await readFile(journalPath, "utf8");

    expect(result).toMatchObject({ status: "incomplete", reason: "uncertain-provenance" });
    expect(journal.coverage).toMatchObject({
      complete: false,
      gaps: [expect.objectContaining({ reason: "uncertain-provenance" })],
    });
    expect(journal.events).toEqual([]);
    expect(bytes).not.toContain("Do not retain this provenance-uncertain prompt.");
    expect(bytes).not.toContain("custom-reviewer");
  });

  test("rejects a corrupt journal without claiming complete coverage", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(journalPath, "{\"version\":1,\"coverage\":", "utf8");

    await expect(readClaudeCodeCaptureJournal(journalPath)).rejects.toMatchObject({
      code: "CLAUDE_CODE_JOURNAL_CORRUPT",
      coverageComplete: false,
    });
  });

  test("rejects structurally valid JSON that contains a retained raw payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(journalPath, JSON.stringify({
      version: 1,
      coverage: {
        startedAt: "2026-07-22T00:06:30.000Z",
        complete: false,
        gaps: [],
      },
      events: [{
        id: "event-unsafe",
        sessionId: "session-unsafe",
        messageId: "message-unsafe",
        role: "assistant",
        receivedAt: "2026-07-22T00:06:30.000Z",
        sequence: 1,
        text: "safe displayed text",
        rawPayload: { thinking: "must not survive" },
      }],
      pendingDisplays: {},
    }), "utf8");

    await expect(readClaudeCodeCaptureJournal(journalPath)).rejects.toMatchObject({
      code: "CLAUDE_CODE_JOURNAL_CORRUPT",
      coverageComplete: false,
    });
  });

  test("rejects an interrupted temporary write when no authoritative journal exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    await mkdir(dirname(journalPath), { recursive: true });
    await writeFile(`${journalPath}.tmp-interrupted`, "{\"version\":1", "utf8");

    await expect(readClaudeCodeCaptureJournal(journalPath)).rejects.toMatchObject({
      code: "CLAUDE_CODE_JOURNAL_PARTIAL_WRITE",
      coverageComplete: false,
    });
  });
});
