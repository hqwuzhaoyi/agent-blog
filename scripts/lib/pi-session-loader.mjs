import { chmod, copyFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const defaultFileSystem = { chmod, copyFile, mkdtemp, rm, stat };

export class PiSessionLoadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PiSessionLoadError";
    this.code = code;
  }
}

function sameSourceVersion(before, after) {
  return before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeNs === after.mtimeNs &&
    before.ctimeNs === after.ctimeNs;
}

export async function loadPiSessionsReadOnly({
  sessionManager,
  sessionDirectory,
  snapshotRoot = tmpdir(),
  fileSystem = defaultFileSystem,
}) {
  let candidates;
  try {
    candidates = await sessionManager.listAll(sessionDirectory);
  } catch {
    throw new PiSessionLoadError("discovery-failed", "Pi session discovery failed safely");
  }
  if (candidates.length === 0) return { sessions: [], deferred: [] };

  let snapshotDirectory;
  try {
    snapshotDirectory = await fileSystem.mkdtemp(join(snapshotRoot, "agent-blog-pi-"));
    await fileSystem.chmod(snapshotDirectory, 0o700);
  } catch {
    if (snapshotDirectory) {
      try {
        await fileSystem.rm(snapshotDirectory, { recursive: true, force: true });
      } catch {
        throw new PiSessionLoadError("snapshot-cleanup-failed", "Pi snapshot cleanup failed safely");
      }
    }
    throw new PiSessionLoadError("snapshot-create-failed", "Pi snapshot directory could not be created safely");
  }

  try {
    const sessions = [];
    const deferred = [];

    for (const [index, candidate] of candidates.entries()) {
      try {
        const snapshotPath = join(snapshotDirectory, `${index}.jsonl`);
        const sourceBefore = await fileSystem.stat(candidate.path, { bigint: true });
        await fileSystem.copyFile(candidate.path, snapshotPath);
        await fileSystem.chmod(snapshotPath, 0o600);
        const sourceAfter = await fileSystem.stat(candidate.path, { bigint: true });
        if (!sameSourceVersion(sourceBefore, sourceAfter)) {
          deferred.push({ sessionId: candidate.id, reason: "source-changed" });
          continue;
        }
        const snapshot = sessionManager.open(snapshotPath);
        const header = snapshot.getHeader();
        sessions.push({
          sessionId: header.id,
          entries: snapshot.getEntries(),
        });
      } catch {
        throw new PiSessionLoadError(
          "snapshot-load-failed",
          "Pi session snapshot could not be loaded safely",
        );
      }
    }

    return { sessions, deferred };
  } finally {
    try {
      await fileSystem.rm(snapshotDirectory, { recursive: true, force: true });
    } catch {
      throw new PiSessionLoadError("snapshot-cleanup-failed", "Pi snapshot cleanup failed safely");
    }
  }
}
