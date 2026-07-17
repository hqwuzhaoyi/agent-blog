import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { buildReviewWindowFromSessions, sessionsListParams } from "../scripts/lib/openclaw-gateway.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/gateway-day.json", import.meta.url), "utf8"),
);

describe("OpenClaw Gateway collection", () => {
  test("uses only currently supported sessions.list parameters", () => {
    expect(sessionsListParams(100, 200)).toEqual({
      limit: 100,
      offset: 200,
      configuredAgentsOnly: true,
    });
  });

  test("keeps visible primary-session messages and excludes tools and spawned agents", () => {
    const window = buildReviewWindowFromSessions({
      sessions: fixture.sessions,
      sourceId: "openclaw-main",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Finish the publication workflow and verify the static site." },
      { role: "assistant", text: "The site builds successfully and the review gate is documented." },
    ]);
    expect(window.candidateCursors["agent:main:main"]).toEqual({
      timestamp: 1784167200000,
      messageId: "m-2",
    });
  });

  test("resumes after the saved per-session cursor", () => {
    const window = buildReviewWindowFromSessions({
      sessions: fixture.sessions,
      sourceId: "openclaw-main",
      reviewDay: "2026-07-16",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "agent:main:main": { timestamp: 1784163600000, messageId: "m-1" },
        },
      },
    });

    expect(window.messages).toHaveLength(1);
    expect(window.messages[0].id).toBe("m-2");
  });
});
