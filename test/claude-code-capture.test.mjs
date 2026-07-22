import { mkdtemp, readFile, stat } from "node:fs/promises";
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

describe("Claude Code prospective capture seam", () => {
  test("records a direct user prompt as a minimal private Visible Message", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");

    const result = await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:01:02.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);
    const bytes = await readFile(journalPath, "utf8");
    const mode = (await stat(journalPath)).mode & 0o777;

    expect(result.status).toBe("captured");
    expect(journal.events).toHaveLength(1);
    expect(journal.events[0]).toMatchObject({
      sessionId: "session-user-a",
      role: "user",
      receivedAt: "2026-07-22T00:01:02.000Z",
      sequence: 1,
      text: "Implement the prospective capture seam.",
    });
    expect(journal.coverage.complete).toBe(false);
    expect(mode).toBe(0o600);
    expect(bytes).not.toContain("transcript_path");
    expect(bytes).not.toContain("/private/raw/session-user-a.jsonl");
    expect(bytes).not.toContain("permission_mode");
  });

  test("deduplicates a retried direct user hook delivery within one session", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:01:02.000Z",
    });
    const retry = await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:01:03.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(retry).toMatchObject({ status: "ignored", reason: "duplicate" });
    expect(journal.events).toHaveLength(1);
    expect(journal.events[0].receivedAt).toBe("2026-07-22T00:01:02.000Z");
  });

  test("keeps an identical prompt submitted again after the intervening assistant response", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");

    const first = await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:01:02.000Z",
    });
    const response = await captureClaudeCodeHookEvent({
      payload: {
        ...fixture.assistantBatches[1],
        session_id: fixture.directUser.session_id,
        message_id: "message-between-repeated-prompts",
        index: 0,
        delta: "The first response is visible.",
      },
      journalPath,
      receivedAt: "2026-07-22T00:01:03.000Z",
    });
    const second = await captureClaudeCodeHookEvent({
      payload: fixture.directUser,
      journalPath,
      receivedAt: "2026-07-22T00:01:04.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect([first.status, response.status, second.status]).toEqual([
      "captured",
      "captured",
      "captured",
    ]);
    expect(journal.events.map(({ sequence, role, text }) => ({ sequence, role, text }))).toEqual([
      { sequence: 1, role: "user", text: "Implement the prospective capture seam." },
      { sequence: 2, role: "assistant", text: "The first response is visible." },
      { sequence: 3, role: "user", text: "Implement the prospective capture seam." },
    ]);
    expect(journal.events[0].id).not.toBe(journal.events[2].id);
  });

  test("assembles displayed assistant batches once despite out-of-order retries", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    const [first, final] = fixture.assistantBatches;

    const waiting = await captureClaudeCodeHookEvent({
      payload: final,
      journalPath,
      receivedAt: "2026-07-22T00:02:02.000Z",
    });
    const captured = await captureClaudeCodeHookEvent({
      payload: first,
      journalPath,
      receivedAt: "2026-07-22T00:02:01.000Z",
    });
    const retryFirst = await captureClaudeCodeHookEvent({
      payload: first,
      journalPath,
      receivedAt: "2026-07-22T00:02:03.000Z",
    });
    const retryFinal = await captureClaudeCodeHookEvent({
      payload: final,
      journalPath,
      receivedAt: "2026-07-22T00:02:04.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(waiting.status).toBe("pending");
    expect(captured.status).toBe("captured");
    expect(retryFirst).toMatchObject({ status: "ignored", reason: "duplicate" });
    expect(retryFinal).toMatchObject({ status: "ignored", reason: "duplicate" });
    expect(journal.events).toEqual([
      expect.objectContaining({
        sessionId: "session-display-b",
        messageId: "message-visible-1",
        role: "assistant",
        receivedAt: "2026-07-22T00:02:02.000Z",
        sequence: 1,
        text: "Implemented capture and verified batching.",
      }),
    ]);
    expect(journal.pendingDisplays).toEqual({});
  });

  test("marks two different final batches for one displayed message incomplete", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    const firstFinal = {
      ...fixture.assistantBatches[1],
      index: 2,
      delta: "First final marker.",
    };
    const conflictingFinal = {
      ...fixture.assistantBatches[1],
      index: 1,
      delta: "Conflicting final marker.",
    };

    expect((await captureClaudeCodeHookEvent({
      payload: firstFinal,
      journalPath,
      receivedAt: "2026-07-22T00:02:02.000Z",
    })).status).toBe("pending");
    const result = await captureClaudeCodeHookEvent({
      payload: conflictingFinal,
      journalPath,
      receivedAt: "2026-07-22T00:02:03.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(result).toMatchObject({ status: "incomplete", reason: "conflicting-display-final" });
    expect(journal.events).toEqual([]);
    expect(journal.pendingDisplays).toEqual({});
    expect(journal.coverage.gaps).toEqual([
      expect.objectContaining({ reason: "conflicting-display-final" }),
    ]);
  });

  test("never renumbers an accepted event when a late receipt carries an earlier timestamp", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    const acceptedFirst = {
      ...fixture.directUser,
      session_id: "session-accepted-first",
      prompt: "Accepted first.",
    };
    const receivedLate = {
      ...fixture.directUser,
      session_id: "session-received-late",
      prompt: "Received later with an earlier clock value.",
    };

    const first = await captureClaudeCodeHookEvent({
      payload: acceptedFirst,
      journalPath,
      receivedAt: "2026-07-22T00:03:02.000Z",
    });
    const late = await captureClaudeCodeHookEvent({
      payload: receivedLate,
      journalPath,
      receivedAt: "2026-07-22T00:03:01.000Z",
    });
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(first.event.sequence).toBe(1);
    expect(late.event.sequence).toBe(2);
    expect(journal.events.map(({ sessionId, sequence }) => ({ sessionId, sequence }))).toEqual([
      { sessionId: "session-accepted-first", sequence: 1 },
      { sessionId: "session-received-late", sequence: 2 },
    ]);
    expect(journal.coverage.startedAt).toBe("2026-07-22T00:03:02.000Z");
  });

  test("assigns deterministic local sequences when concurrent sessions arrive together", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-capture-"));
    const journalPath = join(root, "private", "events.json");
    const earlier = {
      ...fixture.directUser,
      session_id: "session-concurrent-a",
      prompt: "Earlier local receipt.",
    };
    const later = {
      ...fixture.directUser,
      session_id: "session-concurrent-b",
      prompt: "Later local receipt.",
    };

    const accepted = await Promise.all([
      captureClaudeCodeHookEvent({
        payload: later,
        journalPath,
        receivedAt: "2026-07-22T00:03:02.000Z",
      }),
      captureClaudeCodeHookEvent({
        payload: earlier,
        journalPath,
        receivedAt: "2026-07-22T00:03:01.000Z",
      }),
    ]);
    const journal = await readClaudeCodeCaptureJournal(journalPath);

    expect(accepted.map(({ event }) => event.sequence).sort()).toEqual([1, 2]);
    for (const { event } of accepted) {
      expect(journal.events.find((stored) => stored.id === event.id)?.sequence).toBe(event.sequence);
    }
    expect(journal.events.map(({ sequence }) => sequence)).toEqual([1, 2]);
    expect(journal.coverage.startedAt).toBe(journal.events[0].receivedAt);
  });
});
