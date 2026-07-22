import { describe, expect, test, vi } from "vitest";
import {
  reconcileClaudeCodeRuntime,
} from "../scripts/lib/claude-code-runtime.mjs";
import { collectClaudeCodeReviewWindow } from "../scripts/lib/claude-code-collector.mjs";

const coverage = {
  startedAt: "2026-07-20T16:00:00.000Z",
  completedAt: "2026-07-21T16:00:00.000Z",
  complete: true,
  gaps: [],
};

function event(sessionId, sequence) {
  return {
    id: `event-${sessionId}-${sequence}`,
    sessionId,
    messageId: `message-${sessionId}-${sequence}`,
    role: sequence % 2 ? "user" : "assistant",
    receivedAt: `2026-07-21T0${sequence}:00:00.000Z`,
    sequence,
    text: `Visible event ${sequence}`,
  };
}

describe("Claude Code runtime reconciliation", () => {
  test("paginates supported SDK inventory without exposing or using private activity metadata", async () => {
    const listSessions = vi.fn(async ({ limit, offset }) => {
      expect(limit).toBe(2);
      if (offset === 0) return [
        {
          sessionId: "session-primary-b",
          summary: "private summary B",
          cwd: "/private/project-b",
          lastModified: "2099-01-01T00:00:00.000Z",
        },
        {
          sessionId: "session-review-worker",
          summary: "private self-review summary",
          createdAt: "1999-01-01T00:00:00.000Z",
        },
      ];
      if (offset === 2) return [{
        sessionId: "session-primary-a",
        summary: "private summary A",
        cwd: "/private/project-a",
      }];
      throw new Error(`unexpected list offset ${offset}`);
    });
    const getSessionMessages = vi.fn(async (sessionId, { limit, offset }) => {
      expect(limit).toBe(2);
      if (sessionId === "session-primary-a" && offset === 0) return [{
        type: "user",
        uuid: "sdk-user-a",
        session_id: sessionId,
        parent_tool_use_id: null,
        message: { content: "private raw prompt A" },
      }];
      if (sessionId === "session-primary-b" && offset === 0) return [{
        type: "assistant",
        uuid: "sdk-assistant-b",
        session_id: sessionId,
        parent_tool_use_id: null,
        message: { content: [{ type: "text", text: "private raw answer B" }] },
      }];
      throw new Error(`unexpected message page ${sessionId}:${offset}`);
    });

    const result = await reconcileClaudeCodeRuntime({
      sdk: { listSessions, getSessionMessages },
      events: [event("session-primary-b", 2), event("session-primary-a", 1)],
      coverage,
      excludeSessionId: "session-review-worker",
      pageSize: 2,
    });

    expect(result).toEqual({
      inventory: [
        { sessionId: "session-primary-a", provenance: "primary" },
        { sessionId: "session-primary-b", provenance: "primary" },
      ],
      coverage: { ...coverage, reconciliation: "matched" },
    });
    expect(listSessions.mock.calls.map(([options]) => options.offset)).toEqual([0, 2]);
    expect(getSessionMessages.mock.calls.map(([sessionId]) => sessionId).sort()).toEqual([
      "session-primary-a",
      "session-primary-b",
    ]);
    const output = JSON.stringify(result);
    for (const privateValue of [
      "private summary",
      "/private/project",
      "private raw prompt",
      "private raw answer",
      "2099-01-01",
      "1999-01-01",
    ]) expect(output).not.toContain(privateValue);
  });

  test("marks malformed SDK history uncertain without inventing a coverage timestamp", async () => {
    const inputCoverage = {
      startedAt: "2026-07-20T16:00:00.000Z",
      complete: false,
      gaps: [],
    };
    const result = await reconcileClaudeCodeRuntime({
      sdk: {
        listSessions: async () => [{
          sessionId: "session-malformed",
          lastModified: "2026-07-21T16:00:00.000Z",
        }],
        getSessionMessages: async () => null,
      },
      events: [event("session-malformed", 1)],
      coverage: inputCoverage,
    });

    expect(result).toEqual({
      inventory: [{ sessionId: "session-malformed", provenance: "uncertain" }],
      coverage: { ...inputCoverage, reconciliation: "mismatch" },
    });
    expect(result.coverage).not.toHaveProperty("completedAt");
  });

  test("propagates an explicit subagent marker into an incomplete Review Window", async () => {
    const captured = event("session-subagent", 1);
    const reconciled = await reconcileClaudeCodeRuntime({
      sdk: {
        listSessions: async () => [{ sessionId: "session-subagent" }],
        getSessionMessages: async () => [{
          type: "assistant",
          uuid: "sdk-subagent-message",
          session_id: "session-subagent",
          parent_tool_use_id: "parent-tool-use",
          message: { content: "private subagent text" },
        }],
      },
      events: [captured],
      coverage,
    });
    const result = await collectClaudeCodeReviewWindow({
      events: [captured],
      ...reconciled,
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "uncertain-subagent-provenance",
      messages: [],
      candidateCursors: {},
    });
  });

  test("marks reconciliation mismatch when a primary session has an uncovered SDK message", async () => {
    const captured = event("session-missed-hook", 1);
    const result = await reconcileClaudeCodeRuntime({
      sdk: {
        listSessions: async () => [{ sessionId: "session-missed-hook" }],
        getSessionMessages: async () => [
          {
            type: "user",
            uuid: "sdk-covered-message",
            session_id: "session-missed-hook",
            parent_tool_use_id: null,
            message: { content: "private covered content" },
          },
          {
            type: "assistant",
            uuid: "sdk-uncovered-message",
            session_id: "session-missed-hook",
            parent_tool_use_id: null,
            message: { content: "private uncovered content without a timestamp" },
          },
        ],
      },
      events: [captured],
      coverage,
    });

    expect(result).toEqual({
      inventory: [{ sessionId: "session-missed-hook", provenance: "primary" }],
      coverage: { ...coverage, reconciliation: "mismatch" },
    });
    expect(JSON.stringify(result)).not.toContain("private uncovered content");
  });
});
