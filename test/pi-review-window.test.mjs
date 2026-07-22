import { appendFile, chmod, copyFile, mkdtemp, rm, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildPiReviewWindowFromSessions,
  collectPiReviewWindow,
} from "../scripts/lib/pi-review-window.mjs";

const reviewFixture = fileURLToPath(new URL("./fixtures/pi/review-window-session.jsonl", import.meta.url));
const orderedBranchesFixture = fileURLToPath(new URL("./fixtures/pi/ordered-branches-session.jsonl", import.meta.url));
const unknownEntryFixture = fileURLToPath(new URL("./fixtures/pi/unknown-entry-session.jsonl", import.meta.url));
const unknownContentFixture = fileURLToPath(new URL("./fixtures/pi/unknown-content-session.jsonl", import.meta.url));
const malformedFixture = fileURLToPath(new URL("./fixtures/pi/malformed-session.jsonl", import.meta.url));
const deferredFixture = fileURLToPath(new URL("./fixtures/pi/deferred-session.jsonl", import.meta.url));
const temporaryDirectories = [];

async function temporaryDirectory(prefix) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(path);
  return path;
}

function readSyntheticSession(path) {
  const [header, ...entries] = readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  return { header, entries };
}

async function syntheticSdk({
  fixture = reviewFixture,
  provenance = "primary",
  sessionId = "pi-session-review",
} = {}) {
  const sessionDirectory = await temporaryDirectory("agent-blog-pi-review-source-");
  const sourcePath = join(sessionDirectory, "review-window-session.jsonl");
  await copyFile(fixture, sourcePath);
  const sessionManager = {
    listAll: async () => [{ id: sessionId, path: sourcePath }],
    open: (path) => {
      const { header, entries } = readSyntheticSession(path);
      return {
        getHeader: () => header,
        getEntries: () => entries,
      };
    },
  };
  return {
    sdk: {
      SessionManager: sessionManager,
      classifySession: () => provenance,
    },
    sessionDirectory,
    sourcePath,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Pi normalized session fixture adapter", () => {
  test("builds the standard Review Window and cursor from SDK-normalized sessions", () => {
    const { entries } = readSyntheticSession(orderedBranchesFixture);

    const window = buildPiReviewWindowFromSessions({
      sessions: [{
        sessionId: "pi-session-order",
        provenance: "primary",
        entries,
      }],
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "pi-session-order": { timestamp: 1784602801000, messageId: "0000000a" },
        },
      },
    });

    expect(window).toEqual({
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      messages: [
        {
          id: "0000000b",
          sessionKey: "pi-session-order",
          role: "assistant",
          timestamp: 1784602801000,
          text: "Second branch by stable ID.",
        },
        {
          id: "0000000c",
          sessionKey: "pi-session-order",
          role: "assistant",
          timestamp: 1784602802000,
          text: "Later branch entry.",
        },
      ],
      candidateCursors: {
        "pi-session-order": { timestamp: 1784602802000, messageId: "0000000c" },
      },
    });
    expect(window).not.toHaveProperty("deferred");
  });

  test("fails closed on open session shapes, uncertain provenance, and unknown SDK entries", () => {
    const { entries } = readSyntheticSession(orderedBranchesFixture);
    const { entries: unknownEntries } = readSyntheticSession(unknownEntryFixture);
    const common = {
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
    };
    const cases = [
      {
        session: {
          sessionId: "pi-session-open",
          provenance: "primary",
          entries,
          path: "/private/raw-session.jsonl",
        },
        code: "unsupported-schema",
      },
      {
        session: {
          sessionId: "pi-session-unknown",
          provenance: "unknown",
          entries,
        },
        code: "uncertain-provenance",
      },
      {
        session: {
          sessionId: "pi-session-schema",
          provenance: "primary",
          entries: unknownEntries,
        },
        code: "unsupported-schema",
      },
    ];

    for (const fixture of cases) {
      let failure;
      try {
        buildPiReviewWindowFromSessions({
          ...common,
          sessions: [fixture.session],
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({
        name: "PiReviewWindowError",
        code: fixture.code,
      });
      expect(String(failure)).not.toContain("/private/raw-session.jsonl");
    }
  });
});

describe("Pi Review Window collection", () => {
  test("keeps only explicit user and assistant text from the selected Review Day", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk();
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-review-snapshots-");

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
    });

    expect(window.messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "Plan the Pi review." },
      { role: "assistant", text: "The Pi review is planned." },
      { role: "user", text: "Explore branch A." },
      { role: "assistant", text: "Explore branch B." },
      { role: "assistant", text: "The Review Day is complete." },
    ]);
  });

  test("orders same-time branch messages by stable opaque entry ID", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk({
      fixture: orderedBranchesFixture,
      sessionId: "pi-session-order",
    });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-order-snapshots-");

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
    });

    expect(window.messages.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: "0000000a", text: "First branch by stable ID." },
      { id: "0000000b", text: "Second branch by stable ID." },
      { id: "0000000c", text: "Later branch entry." },
    ]);
  });

  test("resumes after the per-session cursor and proposes the newest visible entry", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk({
      fixture: orderedBranchesFixture,
      sessionId: "pi-session-order",
    });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-cursor-snapshots-");

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: {
        sessions: {
          "pi-session-order": { timestamp: 1784602801000, messageId: "0000000a" },
        },
      },
      sessionDir: sessionDirectory,
      snapshotRoot,
    });

    expect({
      messageIds: window.messages.map((message) => message.id),
      cursor: window.candidateCursors["pi-session-order"],
    }).toEqual({
      messageIds: ["0000000b", "0000000c"],
      cursor: { timestamp: 1784602802000, messageId: "0000000c" },
    });
  });

  test("excludes the Pi session running the review itself", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk();
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-self-review-snapshots-");

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      excludeSessionId: "pi-session-review",
      snapshotRoot,
    });

    expect({ messages: window.messages, candidateCursors: window.candidateCursors }).toEqual({
      messages: [],
      candidateCursors: {},
    });
  });

  test("fails closed when Pi session provenance is uncertain", async () => {
    const { sdk, sessionDirectory, sourcePath } = await syntheticSdk({ provenance: "unknown" });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-provenance-snapshots-");

    let failure;
    try {
      await collectPiReviewWindow({
        sdk,
        sourceId: "pi-local",
        reviewDay: "2026-07-21",
        timeZone: "Asia/Taipei",
        state: { sessions: {} },
        sessionDir: sessionDirectory,
        snapshotRoot,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "PiReviewWindowError",
      code: "uncertain-provenance",
      message: "Pi session provenance is not supported",
    });
    expect(String(failure)).not.toContain(sourcePath);
  });

  test("fails closed instead of partially collecting an unknown Pi entry schema", async () => {
    const { sdk, sessionDirectory, sourcePath } = await syntheticSdk({
      fixture: unknownEntryFixture,
      sessionId: "pi-session-unknown",
    });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-schema-snapshots-");

    let failure;
    try {
      await collectPiReviewWindow({
        sdk,
        sourceId: "pi-local",
        reviewDay: "2026-07-21",
        timeZone: "Asia/Taipei",
        state: { sessions: {} },
        sessionDir: sessionDirectory,
        snapshotRoot,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "PiReviewWindowError",
      code: "unsupported-schema",
      message: "Pi session contains an unsupported schema",
    });
    expect(String(failure)).not.toContain(sourcePath);
  });

  test("fails closed instead of partially collecting an unknown Pi content block", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk({
      fixture: unknownContentFixture,
      sessionId: "pi-session-unknown-content",
    });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-content-schema-snapshots-");

    await expect(collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
    })).rejects.toMatchObject({
      name: "PiReviewWindowError",
      code: "unsupported-schema",
    });
  });

  test("fails closed instead of partially collecting malformed Pi entries", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk({
      fixture: malformedFixture,
      sessionId: "pi-session-malformed",
    });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-malformed-snapshots-");

    await expect(collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
    })).rejects.toMatchObject({
      name: "PiReviewWindowError",
      code: "unsupported-schema",
    });
  });

  test("keeps stable sessions while a concurrent Conversation Source is deferred without a cursor", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-mixed-source-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-mixed-snapshots-");
    const stableSource = join(sessionDirectory, "stable.jsonl");
    const deferredSource = join(sessionDirectory, "deferred.jsonl");
    await copyFile(orderedBranchesFixture, stableSource);
    await copyFile(deferredFixture, deferredSource);
    const sdk = {
      SessionManager: {
        listAll: async () => [
          { id: "pi-session-order", path: stableSource },
          { id: "pi-session-deferred", path: deferredSource },
        ],
        open: (path) => {
          const { header, entries } = readSyntheticSession(path);
          return {
            getHeader: () => header,
            getEntries: () => entries,
          };
        },
      },
      classifySession: () => "primary",
    };
    const fileSystem = {
      chmod,
      mkdtemp,
      rm,
      stat,
      copyFile: async (source, destination) => {
        await copyFile(source, destination);
        if (source === deferredSource) {
          await appendFile(source, `${JSON.stringify({
            type: "message",
            id: "00000002",
            parentId: "00000001",
            timestamp: "2026-07-21T07:00:02.000Z",
            message: { role: "assistant", content: [{ type: "text", text: "Concurrent append." }] },
          })}\n`);
        }
      },
    };

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
      fileSystem,
    });

    expect({
      messageIds: window.messages.map((message) => message.id),
      candidateCursors: window.candidateCursors,
      deferred: window.deferred,
    }).toEqual({
      messageIds: ["0000000a", "0000000b", "0000000c"],
      candidateCursors: {
        "pi-session-order": { timestamp: 1784602802000, messageId: "0000000c" },
      },
      deferred: [{ sessionId: "pi-session-deferred", reason: "source-changed" }],
    });
  });

  test("excludes a session explicitly classified as a persistent subagent", async () => {
    const { sdk, sessionDirectory } = await syntheticSdk({ provenance: "subagent" });
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-subagent-snapshots-");

    const window = await collectPiReviewWindow({
      sdk,
      sourceId: "pi-local",
      reviewDay: "2026-07-21",
      timeZone: "Asia/Taipei",
      state: { sessions: {} },
      sessionDir: sessionDirectory,
      snapshotRoot,
    });

    expect({ messages: window.messages, candidateCursors: window.candidateCursors }).toEqual({
      messages: [],
      candidateCursors: {},
    });
  });
});
