import { access, appendFile, chmod, copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadPiSessionsReadOnly } from "../scripts/lib/pi-session-loader.mjs";

const fixture = fileURLToPath(new URL("./fixtures/pi/current-session.jsonl", import.meta.url));
const legacyFixture = fileURLToPath(new URL("./fixtures/pi/legacy-session-v1.jsonl", import.meta.url));
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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Pi read-only session loading", () => {
  test("opens a restrictive private snapshot and leaves the authoritative session unchanged", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-source-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-snapshots-");
    const sourcePath = join(sessionDirectory, "current-session.jsonl");
    await copyFile(fixture, sourcePath);
    await chmod(sourcePath, 0o640);

    const sourceBytesBefore = await readFile(sourcePath);
    const sourceStatBefore = await stat(sourcePath, { bigint: true });
    let openedSnapshotPath;
    let openedSnapshotMode;
    let openedSnapshotDirectoryMode;
    const sessionManager = {
      listAll: vi.fn(async () => [{ id: "pi-session-current", path: sourcePath }]),
      open: vi.fn((path) => {
        openedSnapshotPath = path;
        openedSnapshotMode = Number(statSync(path).mode & 0o777);
        openedSnapshotDirectoryMode = Number(statSync(dirname(path)).mode & 0o777);
        const { header, entries } = readSyntheticSession(path);
        return {
          getHeader: () => header,
          getEntries: () => entries,
        };
      }),
    };

    const result = await loadPiSessionsReadOnly({ sessionManager, sessionDirectory, snapshotRoot });

    expect(result).toEqual({
      sessions: [{
        sessionId: "pi-session-current",
        entries: [
          expect.objectContaining({ type: "message", id: "entry-user" }),
          expect.objectContaining({ type: "message", id: "entry-assistant" }),
        ],
      }],
      deferred: [],
    });
    expect(sessionManager.listAll).toHaveBeenCalledWith(sessionDirectory);
    expect(openedSnapshotPath).not.toBe(sourcePath);
    expect(openedSnapshotDirectoryMode).toBe(0o700);
    expect(openedSnapshotMode).toBe(0o600);
    await expect(access(openedSnapshotPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(sourcePath)).toEqual(sourceBytesBefore);
    const sourceStatAfter = await stat(sourcePath, { bigint: true });
    expect(sourceStatAfter.mode).toBe(sourceStatBefore.mode);
    expect(sourceStatAfter.mtimeNs).toBe(sourceStatBefore.mtimeNs);
  });

  test("defers a Conversation Source that changes while its snapshot is copied", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-concurrent-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-snapshots-");
    const sourcePath = join(sessionDirectory, "active-session.jsonl");
    await copyFile(fixture, sourcePath);
    let snapshotPath;
    const fileSystem = {
      chmod,
      mkdtemp,
      rm,
      stat,
      copyFile: async (source, destination) => {
        snapshotPath = destination;
        await copyFile(source, destination);
        await appendFile(source, `${JSON.stringify({
          type: "message",
          id: "concurrent-entry",
          parentId: "entry-assistant",
          timestamp: "2026-07-21T01:00:03.000Z",
          message: { role: "user", content: "A concurrent synthetic append." },
        })}\n`);
      },
    };
    const sessionManager = {
      listAll: vi.fn(async () => [{ id: "pi-session-current", path: sourcePath }]),
      open: vi.fn(() => {
        throw new Error("A changing source must not be opened");
      }),
    };

    const result = await loadPiSessionsReadOnly({
      sessionManager,
      sessionDirectory,
      snapshotRoot,
      fileSystem,
    });

    expect(result).toEqual({
      sessions: [],
      deferred: [{ sessionId: "pi-session-current", reason: "source-changed" }],
    });
    await expect(access(snapshotPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("cleans the snapshot and redacts SDK errors that contain raw session data", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-failure-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-snapshots-");
    const sourcePath = join(sessionDirectory, "failing-session.jsonl");
    await copyFile(fixture, sourcePath);
    let openedSnapshotPath;
    const rawBody = "RAW SYNTHETIC SESSION BODY MUST NOT ESCAPE";
    const sessionManager = {
      listAll: vi.fn(async () => [{ id: "pi-session-current", path: sourcePath }]),
      open: vi.fn((path) => {
        openedSnapshotPath = path;
        throw new Error(`${rawBody}: ${path}`);
      }),
    };

    let failure;
    try {
      await loadPiSessionsReadOnly({ sessionManager, sessionDirectory, snapshotRoot });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "PiSessionLoadError",
      code: "snapshot-load-failed",
      message: "Pi session snapshot could not be loaded safely",
    });
    expect(String(failure)).not.toContain(rawBody);
    expect(String(failure)).not.toContain(sourcePath);
    expect(String(failure)).not.toContain(openedSnapshotPath);
    await expect(access(openedSnapshotPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("confines official SDK legacy migration to the private snapshot", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-legacy-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-snapshots-");
    const sourcePath = join(sessionDirectory, "legacy-session.jsonl");
    await copyFile(legacyFixture, sourcePath);
    await chmod(sourcePath, 0o640);
    const sourceBytesBefore = await readFile(sourcePath);
    const sourceStatBefore = await stat(sourcePath, { bigint: true });
    let snapshotPath;
    let snapshotBytesBeforeMigration;
    let snapshotBytesAfterMigration;
    const sessionManager = {
      listAll: vi.fn(async () => [{ id: "pi-session-legacy", path: sourcePath }]),
      open: vi.fn((path) => {
        snapshotPath = path;
        snapshotBytesBeforeMigration = readFileSync(path);
        const migratedHeader = {
          type: "session",
          version: 3,
          id: "pi-session-legacy",
          timestamp: "2026-07-21T02:00:00.000Z",
          cwd: "/synthetic/legacy-project",
        };
        const migratedEntry = {
          type: "message",
          id: "migrated-entry",
          parentId: null,
          timestamp: "2026-07-21T02:00:01.000Z",
          message: { role: "user", content: "Migrate only the synthetic snapshot." },
        };
        writeFileSync(path, `${JSON.stringify(migratedHeader)}\n${JSON.stringify(migratedEntry)}\n`);
        snapshotBytesAfterMigration = readFileSync(path);
        return {
          getHeader: () => migratedHeader,
          getEntries: () => [migratedEntry],
        };
      }),
    };

    const result = await loadPiSessionsReadOnly({ sessionManager, sessionDirectory, snapshotRoot });

    expect(result.sessions).toEqual([{
      sessionId: "pi-session-legacy",
      entries: [expect.objectContaining({ id: "migrated-entry" })],
    }]);
    expect(snapshotBytesAfterMigration).not.toEqual(snapshotBytesBeforeMigration);
    await expect(access(snapshotPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(sourcePath)).toEqual(sourceBytesBefore);
    const sourceStatAfter = await stat(sourcePath, { bigint: true });
    expect(sourceStatAfter.mode).toBe(sourceStatBefore.mode);
    expect(sourceStatAfter.mtimeNs).toBe(sourceStatBefore.mtimeNs);
  });

  test("removes a temporary directory when private permission setup fails", async () => {
    const sessionDirectory = await temporaryDirectory("agent-blog-pi-permission-");
    const snapshotRoot = await temporaryDirectory("agent-blog-pi-snapshots-");
    const sourcePath = join(sessionDirectory, "current-session.jsonl");
    await copyFile(fixture, sourcePath);
    let createdSnapshotDirectory;
    const rawFailure = "RAW PERMISSION FAILURE";
    const fileSystem = {
      copyFile,
      rm,
      stat,
      mkdtemp: async (prefix) => {
        createdSnapshotDirectory = await mkdtemp(prefix);
        return createdSnapshotDirectory;
      },
      chmod: async () => {
        throw new Error(rawFailure);
      },
    };
    const sessionManager = {
      listAll: vi.fn(async () => [{ id: "pi-session-current", path: sourcePath }]),
      open: vi.fn(),
    };

    let failure;
    try {
      await loadPiSessionsReadOnly({ sessionManager, sessionDirectory, snapshotRoot, fileSystem });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "PiSessionLoadError",
      code: "snapshot-create-failed",
    });
    expect(String(failure)).not.toContain(rawFailure);
    await expect(access(createdSnapshotDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
