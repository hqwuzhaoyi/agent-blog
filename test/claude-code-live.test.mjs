import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

import { captureClaudeCodeHookEvent } from "../scripts/lib/claude-code-capture.mjs";
import {
  buildClaudeCodeReviewWindowFromFixture,
  collectClaudeCodeLiveWindow,
} from "../scripts/lib/claude-code-collector.mjs";

function pinnedModuleLoader({ sessions, messagesBySession }) {
  const load = vi.fn(async () => ({
    version: "0.3.217",
    module: {
      listSessions: async ({ offset }) => offset === 0 ? sessions : [],
      getSessionMessages: async (sessionId, { offset }) => (
        offset === 0 ? messagesBySession[sessionId] ?? [] : []
      ),
    },
  }));
  return load;
}

async function capturedJournal() {
  const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-live-"));
  const journalPath = join(root, "private", "events.json");
  await captureClaudeCodeHookEvent({
    payload: {
      session_id: "session-live",
      hook_event_name: "UserPromptSubmit",
      prompt: "Collect this complete live interval.",
    },
    journalPath,
    receivedAt: "2026-07-21T02:00:00.000Z",
  });
  await captureClaudeCodeHookEvent({
    payload: {
      session_id: "session-live",
      hook_event_name: "MessageDisplay",
      message_id: "message-assistant-live",
      index: 0,
      final: true,
      delta: "The live interval is complete.",
    },
    journalPath,
    receivedAt: "2026-07-21T02:01:00.000Z",
  });
  return journalPath;
}

describe("Claude Code registry adapters", () => {
  test("collects a live window only after a complete prospective Review Day", async () => {
    const journalPath = await capturedJournal();
    const moduleLoader = pinnedModuleLoader({
      sessions: [{ sessionId: "session-live", lastModified: "2099-01-01T00:00:00.000Z" }],
      messagesBySession: {
        "session-live": [
          {
            type: "user",
            uuid: "sdk-user-live",
            session_id: "session-live",
            parent_tool_use_id: null,
            message: { content: "private raw prompt" },
          },
          {
            type: "assistant",
            uuid: "message-assistant-live",
            session_id: "session-live",
            parent_tool_use_id: null,
            message: { content: "private raw answer" },
          },
        ],
      },
    });

    const window = await collectClaudeCodeLiveWindow({
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      journalPath,
      coverageStartedAt: "2026-07-20T16:00:00.000Z",
      excludeSessionId: "session-review-worker",
      moduleLoader,
      now: () => new Date("2026-07-21T16:15:00.000Z"),
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Collect this complete live interval." },
      { role: "assistant", text: "The live interval is complete." },
    ]);
    expect(window.candidateCursors["session-live"]).toMatchObject({
      sequence: 2,
      messageId: expect.any(String),
    });
    expect(moduleLoader).toHaveBeenCalledOnce();
    expect(JSON.stringify(window)).not.toContain("private raw");
    expect(JSON.stringify(window)).not.toContain("2099-01-01");
  });

  test("does not consult SDK activity when prospective markers do not cover the Review Day", async () => {
    const journalPath = await capturedJournal();
    const moduleLoader = vi.fn(async () => {
      throw new Error("SDK must not load for an incomplete prospective interval");
    });
    const common = {
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      journalPath,
      excludeSessionId: "session-review-worker",
      moduleLoader,
    };

    const installedLate = await collectClaudeCodeLiveWindow({
      ...common,
      coverageStartedAt: "2026-07-21T00:00:00.000Z",
      now: () => new Date("2026-07-21T16:15:00.000Z"),
    });
    const beforeDayEnd = await collectClaudeCodeLiveWindow({
      ...common,
      coverageStartedAt: "2026-07-20T16:00:00.000Z",
      now: () => new Date("2026-07-21T12:00:00.000Z"),
    });

    expect(installedLate).toMatchObject({
      status: "incomplete",
      reason: "historical-coverage-missing",
      candidateCursors: {},
    });
    expect(beforeDayEnd).toMatchObject({
      status: "incomplete",
      reason: "missing-coverage-marker",
      candidateCursors: {},
    });
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  test("returns live incomplete when SDK reconciliation proves a missed hook", async () => {
    const journalPath = await capturedJournal();
    const moduleLoader = pinnedModuleLoader({
      sessions: [{ sessionId: "session-live" }],
      messagesBySession: {
        "session-live": [
          {
            type: "user",
            uuid: "sdk-user-live",
            session_id: "session-live",
            parent_tool_use_id: null,
          },
          {
            type: "assistant",
            uuid: "message-assistant-live",
            session_id: "session-live",
            parent_tool_use_id: null,
          },
          {
            type: "assistant",
            uuid: "sdk-missed-hook",
            session_id: "session-live",
            parent_tool_use_id: null,
            message: { content: "private missed message without time" },
          },
        ],
      },
    });

    const result = await collectClaudeCodeLiveWindow({
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      journalPath,
      coverageStartedAt: "2026-07-20T16:00:00.000Z",
      excludeSessionId: "session-review-worker",
      moduleLoader,
      now: () => new Date("2026-07-21T16:15:00.000Z"),
    });

    expect(result).toMatchObject({
      status: "incomplete",
      reason: "reconciliation-mismatch",
      messages: [],
      candidateCursors: {},
    });
    expect(JSON.stringify(result)).not.toContain("private missed message");
  });

  test("builds fixture windows only from a closed normalized fixture object", async () => {
    const fixture = {
      events: [{
        id: "fixture-event-1",
        sessionId: "fixture-session",
        messageId: "fixture-message-1",
        role: "user",
        receivedAt: "2026-07-21T02:00:00.000Z",
        sequence: 1,
        text: "Collect the fixture window.",
      }],
      inventory: [{ sessionId: "fixture-session", provenance: "primary" }],
      coverage: {
        startedAt: "2026-07-20T16:00:00.000Z",
        completedAt: "2026-07-21T16:00:00.000Z",
        complete: true,
        gaps: [],
        reconciliation: "matched",
      },
    };
    const common = {
      sourceId: "claude-code-fixture",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    };

    const window = await buildClaudeCodeReviewWindowFromFixture({ fixture, ...common });
    const rejected = await Promise.all([
      { ...fixture, rawTranscript: "/private/session.jsonl" },
      {
        ...fixture,
        events: [{ ...fixture.events[0], rawPayload: { thinking: "private" } }],
      },
      {
        ...fixture,
        inventory: [{ ...fixture.inventory[0], summary: "private SDK summary" }],
      },
      {
        ...fixture,
        coverage: { ...fixture.coverage, lastModified: "2099-01-01T00:00:00.000Z" },
      },
    ].map((candidate) => buildClaudeCodeReviewWindowFromFixture({
      fixture: candidate,
      ...common,
    })));

    expect(window.messages.map(({ text }) => text)).toEqual(["Collect the fixture window."]);
    for (const result of rejected) {
      expect(result).toMatchObject({
        status: "incomplete",
        reason: "malformed-fixture",
        messages: [],
        candidateCursors: {},
      });
    }
  });

  test("stops before SDK reconciliation for a journal gap or pending display batch", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-claude-live-"));
    const gapPath = join(root, "gap", "events.json");
    const pendingPath = join(root, "pending", "events.json");
    await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-gap",
        hook_event_name: "UserPromptSubmit",
        prompt: "Do not retain uncertain provenance.",
        agent_type: "custom-reviewer",
      },
      journalPath: gapPath,
      receivedAt: "2026-07-21T02:00:00.000Z",
    });
    await captureClaudeCodeHookEvent({
      payload: {
        session_id: "session-pending",
        hook_event_name: "MessageDisplay",
        message_id: "message-pending",
        index: 0,
        final: false,
        delta: "Unfinished display.",
      },
      journalPath: pendingPath,
      receivedAt: "2026-07-21T02:00:00.000Z",
    });
    const moduleLoader = vi.fn(async () => {
      throw new Error("SDK must not load for an incomplete journal");
    });
    const common = {
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      coverageStartedAt: "2026-07-20T16:00:00.000Z",
      moduleLoader,
      now: () => new Date("2026-07-21T16:15:00.000Z"),
    };

    const gap = await collectClaudeCodeLiveWindow({ ...common, journalPath: gapPath });
    const pending = await collectClaudeCodeLiveWindow({ ...common, journalPath: pendingPath });

    expect(gap).toMatchObject({ status: "incomplete", reason: "journal-coverage-gap" });
    expect(pending).toMatchObject({ status: "incomplete", reason: "pending-display-batches" });
    expect(gap.candidateCursors).toEqual({});
    expect(pending.candidateCursors).toEqual({});
    expect(moduleLoader).not.toHaveBeenCalled();
  });

  test("uses one normalized journal snapshot throughout live reconciliation", async () => {
    const journalPath = await capturedJournal();
    const moduleLoader = vi.fn(async () => ({
      version: "0.3.217",
      module: {
        listSessions: async () => {
          await writeFile(journalPath, "{corrupted after the snapshot", "utf8");
          return [{ sessionId: "session-live" }];
        },
        getSessionMessages: async () => [
          {
            type: "user",
            uuid: "sdk-user-live",
            session_id: "session-live",
            parent_tool_use_id: null,
          },
          {
            type: "assistant",
            uuid: "message-assistant-live",
            session_id: "session-live",
            parent_tool_use_id: null,
          },
        ],
      },
    }));

    const window = await collectClaudeCodeLiveWindow({
      sourceId: "claude-code-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      journalPath,
      coverageStartedAt: "2026-07-20T16:00:00.000Z",
      moduleLoader,
      now: () => new Date("2026-07-21T16:15:00.000Z"),
    });

    expect(window.messages).toHaveLength(2);
    expect(window).not.toHaveProperty("status", "incomplete");
  });
});
