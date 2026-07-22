import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { captureClaudeCodeHookEvent } from "../scripts/lib/claude-code-capture.mjs";
import { collectClaudeCodeReviewWindow } from "../scripts/lib/claude-code-collector.mjs";

const completeCoverage = {
  startedAt: "2026-07-20T16:00:00.000Z",
  completedAt: "2026-07-21T16:00:00.000Z",
  complete: true,
  gaps: [],
  reconciliation: "matched",
};

const visibleEvent = {
  id: "event-user-1",
  sessionId: "session-primary-a",
  messageId: "message-user-1",
  role: "user",
  receivedAt: "2026-07-21T02:00:00.000Z",
  sequence: 1,
  text: "Prepare the complete Claude Code Review Window.",
};

describe("Claude Code Review Window collection", () => {
  test("turns a complete reconciled capture interval into the standard Review Window", async () => {
    const window = await collectClaudeCodeReviewWindow({
      events: [visibleEvent],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window).toEqual({
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      messages: [{
        id: "event-user-1",
        sessionKey: "session-primary-a",
        role: "user",
        timestamp: 1784599200000,
        text: "Prepare the complete Claude Code Review Window.",
      }],
      candidateCursors: {
        "session-primary-a": {
          sequence: 1,
          timestamp: 1784599200000,
          messageId: "event-user-1",
        },
      },
    });
  });

  test("uses local receipt sequence across time-zone boundaries and excludes the review session", async () => {
    const event = (overrides) => ({
      ...visibleEvent,
      ...overrides,
    });
    const window = await collectClaudeCodeReviewWindow({
      events: [
        event({
          id: "event-next-day",
          sessionId: "session-primary-a",
          receivedAt: "2026-07-21T16:00:00.000Z",
          sequence: 5,
          text: "Already the next Review Day.",
        }),
        event({
          id: "event-session-b",
          sessionId: "session-primary-b",
          role: "assistant",
          receivedAt: "2026-07-21T15:59:59.999Z",
          sequence: 3,
          text: "Last visible message of the Review Day.",
        }),
        event({
          id: "event-session-a",
          sessionId: "session-primary-a",
          receivedAt: "2026-07-20T16:00:00.000Z",
          sequence: 2,
          text: "First visible message of the Review Day.",
        }),
        event({
          id: "event-review-worker",
          sessionId: "session-review-worker",
          receivedAt: "2026-07-21T03:00:00.000Z",
          sequence: 4,
          text: "The review worker must not review itself.",
        }),
        event({
          id: "event-previous-day",
          sessionId: "session-primary-a",
          receivedAt: "2026-07-20T15:59:59.999Z",
          sequence: 1,
          text: "Still the previous Review Day.",
        }),
      ],
      inventory: [
        {
          sessionId: "session-primary-a",
          provenance: "primary",
          lastModified: "2026-07-21T02:00:00.000Z",
          summary: "private session summary",
          cwd: "/private/project-a",
        },
        { sessionId: "session-primary-b", provenance: "primary" },
        { sessionId: "session-review-worker", provenance: "primary" },
      ],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      excludeSessionId: "session-review-worker",
    });

    expect(window.messages.map(({ id, sessionKey }) => ({ id, sessionKey }))).toEqual([
      { id: "event-session-a", sessionKey: "session-primary-a" },
      { id: "event-session-b", sessionKey: "session-primary-b" },
    ]);
    expect(window.candidateCursors).toEqual({
      "session-primary-a": {
        sequence: 2,
        timestamp: 1784563200000,
        messageId: "event-session-a",
      },
      "session-primary-b": {
        sequence: 3,
        timestamp: 1784649599999,
        messageId: "event-session-b",
      },
    });
    expect(JSON.stringify(window)).not.toContain("private session summary");
    expect(JSON.stringify(window)).not.toContain("/private/project-a");
  });

  test.each([
    [
      "a missing start marker",
      { ...completeCoverage, startedAt: undefined },
      "missing-coverage-marker",
    ],
    [
      "capture installed after the Review Day began",
      { ...completeCoverage, startedAt: "2026-07-21T00:00:00.000Z" },
      "historical-coverage-missing",
    ],
    [
      "capture stopped before the Review Day ended",
      { ...completeCoverage, completedAt: "2026-07-21T12:00:00.000Z" },
      "missing-coverage-marker",
    ],
    [
      "a recorded coverage gap",
      {
        ...completeCoverage,
        gaps: [{ reason: "uncertain-provenance", receivedAt: "2026-07-21T02:00:00.000Z" }],
      },
      "coverage-gap",
    ],
  ])("returns no cursor for incomplete coverage caused by %s", async (_label, coverage, reason) => {
    const result = await collectClaudeCodeReviewWindow({
      events: [visibleEvent],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason,
      messages: [],
      candidateCursors: {},
    });
  });

  test("reads normalized events from the private capture journal", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-collector-"));
    const journalPath = join(root, "private", "events.json");
    await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-journal",
        hook_event_name: "UserPromptSubmit",
        prompt: "Read this normalized journal event.",
      },
      journalPath,
      receivedAt: "2026-07-21T04:00:00.000Z",
    });

    const window = await collectClaudeCodeReviewWindow({
      journalPath,
      inventory: [{ sessionId: "session-journal", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Read this normalized journal event." },
    ]);
  });

  test("returns incomplete without cursors when the normalized journal is corrupt", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-collector-"));
    const journalPath = join(root, "private", "events.json");
    await mkdir(join(root, "private"), { recursive: true });
    await writeFile(journalPath, "{\"version\":1,\"coverage\":", "utf8");

    const result = await collectClaudeCodeReviewWindow({
      journalPath,
      inventory: [],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "journal-corrupt",
      messages: [],
      candidateCursors: {},
    });
  });

  test("returns incomplete when the requested capture journal does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-collector-"));
    const result = await collectClaudeCodeReviewWindow({
      journalPath: join(root, "missing", "events.json"),
      inventory: [],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "missing-capture-interval",
      messages: [],
      candidateCursors: {},
    });
  });

  test.each([
    [
      "the coverage reconciliation reports a mismatch",
      [{ sessionId: "session-primary-a", provenance: "primary" }],
      { ...completeCoverage, reconciliation: "mismatch" },
      "reconciliation-mismatch",
    ],
    [
      "a captured session is absent from supported inventory",
      [],
      completeCoverage,
      "reconciliation-mismatch",
    ],
    [
      "a captured session has uncertain subagent provenance",
      [{ sessionId: "session-primary-a", provenance: "uncertain" }],
      completeCoverage,
      "uncertain-subagent-provenance",
    ],
  ])("fails closed when %s", async (_label, inventory, coverage, reason) => {
    const result = await collectClaudeCodeReviewWindow({
      events: [visibleEvent],
      inventory,
      coverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason,
      messages: [],
      candidateCursors: {},
    });
  });

  test("resumes after an exact per-session cursor on retry", async () => {
    const laterEvent = {
      ...visibleEvent,
      id: "event-assistant-2",
      messageId: "message-assistant-2",
      role: "assistant",
      receivedAt: "2026-07-21T02:01:00.000Z",
      sequence: 2,
      text: "Only this event is new on retry.",
    };
    const window = await collectClaudeCodeReviewWindow({
      events: [laterEvent, visibleEvent],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "session-primary-a": {
            sequence: 1,
            timestamp: 1784599200000,
            messageId: "event-user-1",
          },
        },
      },
    });

    expect(window.messages.map((message) => message.id)).toEqual(["event-assistant-2"]);
    expect(window.candidateCursors["session-primary-a"]).toEqual({
      sequence: 2,
      timestamp: 1784599260000,
      messageId: "event-assistant-2",
    });
  });

  test("returns incomplete when a saved cursor anchor disappeared before a later event", async () => {
    const result = await collectClaudeCodeReviewWindow({
      events: [{ ...visibleEvent, sequence: 2 }],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "session-primary-a": {
            sequence: 1,
            timestamp: 1784599140000,
            messageId: "event-missing-anchor",
          },
        },
      },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "cursor-reconciliation-mismatch",
      messages: [],
      candidateCursors: {},
    });
  });

  test("returns incomplete when an existing Claude Code cursor is malformed", async () => {
    const result = await collectClaudeCodeReviewWindow({
      events: [visibleEvent],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "session-primary-a": {
            timestamp: 1784599200000,
            messageId: "event-user-1",
          },
        },
      },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "cursor-reconciliation-mismatch",
      messages: [],
      candidateCursors: {},
    });
  });

  test("returns a standard empty complete window when there is no update", async () => {
    const window = await collectClaudeCodeReviewWindow({
      events: [],
      inventory: [],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window).toEqual({
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      messages: [],
      candidateCursors: {},
    });
  });

  test("rejects direct event input that is not a closed normalized journal schema", async () => {
    const result = await collectClaudeCodeReviewWindow({
      events: [{
        ...visibleEvent,
        rawPayload: { transcriptPath: "/private/raw/session.jsonl" },
      }],
      inventory: [{ sessionId: "session-primary-a", provenance: "primary" }],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "malformed-normalized-event",
      messages: [],
      candidateCursors: {},
    });
  });

  test("does not let external coverage override a journal gap or pending display batch", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-collector-"));
    const gapJournalPath = join(root, "gap", "events.json");
    const pendingJournalPath = join(root, "pending", "events.json");
    await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-uncertain",
        hook_event_name: "UserPromptSubmit",
        prompt: "This uncertain prompt must not be collected.",
        agent_type: "custom-reviewer",
      },
      journalPath: gapJournalPath,
      receivedAt: "2026-07-21T05:00:00.000Z",
    });
    await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-pending",
        hook_event_name: "MessageDisplay",
        message_id: "message-pending",
        index: 0,
        final: false,
        delta: "An unfinished displayed response.",
      },
      journalPath: pendingJournalPath,
      receivedAt: "2026-07-21T05:01:00.000Z",
    });
    const common = {
      inventory: [],
      coverage: completeCoverage,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    };

    const gap = await collectClaudeCodeReviewWindow({ ...common, journalPath: gapJournalPath });
    const pending = await collectClaudeCodeReviewWindow({ ...common, journalPath: pendingJournalPath });

    expect(gap).toMatchObject({
      status: "incomplete",
      reason: "journal-coverage-gap",
      candidateCursors: {},
    });
    expect(pending).toMatchObject({
      status: "incomplete",
      reason: "pending-display-batches",
      candidateCursors: {},
    });
  });
});
