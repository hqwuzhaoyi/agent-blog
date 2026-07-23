import { describe, expect, test, vi } from "vitest";
import { buildCodexReviewWindow, collectCodexWindow } from "../scripts/lib/codex-app-server.mjs";

const thread = {
  id: "thread-main",
  source: "cli",
  parentThreadId: null,
  turns: [
    {
      id: "turn-1",
      startedAt: 1784163600,
      completedAt: 1784167200,
      items: [
        {
          id: "item-user",
          type: "userMessage",
          content: [
            { type: "text", text: "Add Codex as an Agent Source." },
            { type: "localImage", path: "/private/screenshot.png" },
          ],
        },
        { id: "item-reasoning", type: "reasoning", summary: ["private reasoning"] },
        { id: "item-command", type: "commandExecution", command: "printenv" },
        { id: "item-agent", type: "agentMessage", text: "The Codex collector is covered by tests." },
      ],
    },
  ],
};

describe("Codex app-server collection", () => {
  test("fails before starting app-server when the current review thread is unknown", async () => {
    const clientFactory = vi.fn();

    await expect(collectCodexWindow({
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      excludeThreadId: "",
      clientFactory,
    })).rejects.toThrow("Codex collection requires the current review thread id");

    expect(clientFactory).not.toHaveBeenCalled();
  });

  test("keeps visible user and agent messages while excluding non-text inputs and execution items", () => {
    const window = buildCodexReviewWindow({
      threads: [thread],
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Add Codex as an Agent Source." },
      { role: "assistant", text: "The Codex collector is covered by tests." },
    ]);
    expect(window.candidateCursors["thread-main"]).toEqual({
      timestamp: 1784167200000,
      messageId: "item-agent",
    });
  });

  test("resumes after the saved per-thread cursor", () => {
    const window = buildCodexReviewWindow({
      threads: [thread],
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "thread-main": { timestamp: 1784163600000, messageId: "item-user" },
        },
      },
    });

    expect(window.messages).toHaveLength(1);
    expect(window.messages[0].id).toBe("item-agent");
  });

  test("excludes the Codex thread running the review workflow", () => {
    const window = buildCodexReviewWindow({
      threads: [thread],
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      excludeThreadId: "thread-main",
    });

    expect(window.messages).toEqual([]);
    expect(window.candidateCursors).toEqual({});
  });

  test("keeps only upstream-declared interactive primary threads", () => {
    const window = buildCodexReviewWindow({
      threads: [
        { ...thread, id: "thread-cli", source: "cli", parentThreadId: null },
        { ...thread, id: "thread-vscode", source: "vscode", parentThreadId: null },
        { ...thread, id: "thread-app", source: "appServer", parentThreadId: null },
        { ...thread, id: "thread-exec", source: "exec", parentThreadId: null },
        {
          ...thread,
          id: "thread-subagent",
          source: { subAgent: "review" },
          parentThreadId: "thread-cli",
        },
        { ...thread, id: "thread-unknown", source: "unknown", parentThreadId: null },
        { ...thread, id: "thread-unclassified", source: undefined, parentThreadId: null },
      ],
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect([...new Set(window.messages.map((message) => message.sessionKey))]).toEqual([
      "thread-cli",
      "thread-vscode",
      "thread-app",
    ]);
    expect(Object.keys(window.candidateCursors)).toEqual([
      "thread-cli",
      "thread-vscode",
      "thread-app",
    ]);
  });

  test("paginates active and archived interactive threads through the supported API", async () => {
    const requests = [];
    const listedThreads = new Map([
      ["active-1", { id: "active-1", updatedAt: 1784167200, source: "cli", parentThreadId: null }],
      ["active-2", { id: "active-2", updatedAt: 1784167200, source: "vscode", parentThreadId: null }],
      ["archived-1", { id: "archived-1", updatedAt: 1784167200, source: "appServer", parentThreadId: null }],
    ]);
    const client = {
      initialize: vi.fn(),
      close: vi.fn(),
      request: vi.fn(async (method, params) => {
        requests.push([method, params]);
        if (method === "thread/read") {
          return { thread: { ...listedThreads.get(params.threadId), turns: [] } };
        }
        if (!params.archived && !params.cursor) {
          return {
            data: [
              listedThreads.get("active-1"),
              { id: "active-exec", updatedAt: 1784167200, source: "exec", parentThreadId: null },
              {
                id: "active-subagent",
                updatedAt: 1784167200,
                source: { subAgent: "review" },
                parentThreadId: "active-1",
              },
            ],
            nextCursor: "page-2",
          };
        }
        if (!params.archived) return { data: [listedThreads.get("active-2")], nextCursor: null };
        return {
          data: [
            listedThreads.get("archived-1"),
            { id: "archived-unknown", updatedAt: 1784167200, source: "unknown", parentThreadId: null },
          ],
          nextCursor: null,
        };
      }),
    };

    await collectCodexWindow({
      sourceId: "codex-local",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      excludeThreadId: "review-thread",
      clientFactory: () => client,
    });

    expect(client.initialize).toHaveBeenCalledOnce();
    expect(client.close).toHaveBeenCalledOnce();
    expect(requests.filter(([method]) => method === "thread/read").map(([, params]) => params)).toEqual([
      { threadId: "active-1", includeTurns: true },
      { threadId: "active-2", includeTurns: true },
      { threadId: "archived-1", includeTurns: true },
    ]);
    expect(requests.filter(([method]) => method === "thread/list").map(([, params]) => params.archived)).toEqual([
      false,
      false,
      true,
    ]);
    expect(requests.filter(([method]) => method === "thread/list").map(([, params]) => params.sourceKinds)).toEqual([
      ["cli", "vscode", "appServer"],
      ["cli", "vscode", "appServer"],
      ["cli", "vscode", "appServer"],
    ]);
  });
});
