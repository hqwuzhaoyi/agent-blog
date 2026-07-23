import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const JOURNAL_VERSION = 1;
export const CLAUDE_CODE_EXCLUDE_SESSION_ENV = "CLAUDE_CODE_EXCLUDE_SESSION_ID";
export const CLAUDE_CODE_REVIEW_WORKER_ENV = "AGENT_BLOG_CLAUDE_REVIEW_WORKER";

function newJournal(startedAt) {
  return {
    version: JOURNAL_VERSION,
    coverage: {
      startedAt,
      complete: false,
      gaps: [],
    },
    events: [],
    pendingDisplays: {},
  };
}

function opaqueId(prefix, ...parts) {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
  return `${prefix}-${digest}`;
}

function normalizeReceivedAt(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new TypeError("receivedAt must be an ISO-8601 timestamp");
  }
  return new Date(value).toISOString();
}

function normalizeDirectUser(payload, receivedAt) {
  if (
    payload?.hook_event_name !== "UserPromptSubmit" ||
    typeof payload.session_id !== "string" ||
    !payload.session_id.trim() ||
    typeof payload.prompt !== "string" ||
    !payload.prompt.trim()
  ) return null;

  const sessionId = payload.session_id.trim();
  const text = payload.prompt.trim();
  return {
    sessionId,
    role: "user",
    receivedAt,
    sequence: 0,
    text,
  };
}

function normalizeDisplayBatch(payload, receivedAt) {
  if (
    payload?.hook_event_name !== "MessageDisplay" ||
    typeof payload.session_id !== "string" ||
    !payload.session_id.trim() ||
    typeof payload.message_id !== "string" ||
    !payload.message_id.trim() ||
    !Number.isInteger(payload.index) ||
    payload.index < 0 ||
    typeof payload.final !== "boolean" ||
    typeof payload.delta !== "string"
  ) return null;

  return {
    sessionId: payload.session_id.trim(),
    messageId: payload.message_id.trim(),
    index: payload.index,
    final: payload.final,
    text: payload.delta,
    receivedAt,
  };
}

function exclusionReason(payload, excludeSessionId, reviewWorker) {
  if (reviewWorker === true) return "self-review-worker";

  if (
    typeof excludeSessionId === "string" &&
    excludeSessionId &&
    payload?.session_id === excludeSessionId
  ) return "self-review-session";

  if (
    payload?.isSynthetic === true ||
    payload?.synthetic === true ||
    (payload?.origin && payload.origin.kind !== "human")
  ) return "synthetic";

  if (
    payload?.agent_id ||
    payload?.agent_transcript_path ||
    payload?.parent_tool_use_id
  ) return "subagent";

  const nonVisibleFields = [
    "tool_name",
    "tool_input",
    "tool_response",
    "thinking",
    "image",
    "images",
    "result",
    "tool_use_result",
  ];
  if (
    ["UserPromptSubmit", "MessageDisplay"].includes(payload?.hook_event_name) &&
    nonVisibleFields.some((field) => payload[field] !== undefined)
  ) return "non-visible-content";

  return null;
}

function hasUncertainProvenance(payload) {
  return ["UserPromptSubmit", "MessageDisplay"].includes(payload?.hook_event_name) &&
    typeof payload.agent_type === "string" &&
    payload.agent_type.trim() &&
    !payload.agent_id;
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

function isTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && Boolean(value);
}

function isValidGap(gap) {
  return hasOnlyKeys(gap, ["reason", "sessionId", "messageId", "receivedAt"]) &&
    isNonEmptyString(gap.reason) &&
    isTimestamp(gap.receivedAt) &&
    (gap.sessionId === undefined || isNonEmptyString(gap.sessionId)) &&
    (gap.messageId === undefined || isNonEmptyString(gap.messageId));
}

function isValidEvent(event, index) {
  return hasOnlyKeys(event, [
    "id",
    "sessionId",
    "messageId",
    "role",
    "receivedAt",
    "sequence",
    "text",
  ]) &&
    isNonEmptyString(event.id) &&
    isNonEmptyString(event.sessionId) &&
    isNonEmptyString(event.messageId) &&
    ["user", "assistant"].includes(event.role) &&
    isTimestamp(event.receivedAt) &&
    event.sequence === index + 1 &&
    isNonEmptyString(event.text);
}

function isValidPendingDisplay(pending) {
  if (
    !hasOnlyKeys(pending, [
      "sessionId",
      "messageId",
      "batches",
      "finalIndex",
      "finalReceivedAt",
    ]) ||
    !isNonEmptyString(pending.sessionId) ||
    !isNonEmptyString(pending.messageId) ||
    !hasOnlyKeys(pending.batches, Object.keys(pending.batches ?? {})) ||
    !(pending.finalIndex === null || (Number.isInteger(pending.finalIndex) && pending.finalIndex >= 0)) ||
    !(pending.finalReceivedAt === null || isTimestamp(pending.finalReceivedAt))
  ) return false;

  return Object.entries(pending.batches).every(([index, batch]) => (
    String(Number(index)) === index &&
    Number(index) >= 0 &&
    hasOnlyKeys(batch, ["text", "final", "receivedAt"]) &&
    typeof batch.text === "string" &&
    typeof batch.final === "boolean" &&
    isTimestamp(batch.receivedAt)
  ));
}

function validateJournal(value) {
  if (
    !hasOnlyKeys(value, ["version", "coverage", "events", "pendingDisplays"]) ||
    value.version !== JOURNAL_VERSION ||
    !hasOnlyKeys(value.coverage, ["startedAt", "complete", "gaps"]) ||
    !isTimestamp(value.coverage?.startedAt) ||
    value.coverage?.complete !== false ||
    !Array.isArray(value.coverage?.gaps) ||
    !value.coverage.gaps.every(isValidGap) ||
    !Array.isArray(value.events) ||
    !value.events.every(isValidEvent) ||
    !value.pendingDisplays ||
    typeof value.pendingDisplays !== "object" ||
    Array.isArray(value.pendingDisplays) ||
    !Object.values(value.pendingDisplays).every(isValidPendingDisplay)
  ) {
    const error = new Error("Claude Code capture journal is corrupt or unsupported");
    error.code = "CLAUDE_CODE_JOURNAL_CORRUPT";
    error.coverageComplete = false;
    throw error;
  }
  return value;
}

async function readJournalOrCreate(path, startedAt) {
  try {
    return validateJournal(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") {
      await rejectPartialWrite(path);
      return newJournal(startedAt);
    }
    if (error instanceof SyntaxError) {
      const corrupt = new Error("Claude Code capture journal is corrupt or partially written");
      corrupt.code = "CLAUDE_CODE_JOURNAL_CORRUPT";
      corrupt.coverageComplete = false;
      throw corrupt;
    }
    throw error;
  }
}

async function rejectPartialWrite(path) {
  let entries;
  try {
    entries = await readdir(dirname(path));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!entries.some((entry) => entry.startsWith(`${basename(path)}.tmp-`))) return;

  const partial = new Error("Claude Code capture journal has an interrupted temporary write");
  partial.code = "CLAUDE_CODE_JOURNAL_PARTIAL_WRITE";
  partial.coverageComplete = false;
  throw partial;
}

async function writePrivateJournal(path, journal) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const file = await open(temporaryPath, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

async function withJournalLock(path, action) {
  const directory = dirname(path);
  const lockPath = `${path}.lock`;
  await mkdir(directory, { recursive: true, mode: 0o700 });

  let lock;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      lock = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await delay(5);
    }
  }
  if (!lock) {
    const error = new Error("Timed out waiting for the Claude Code capture journal lock");
    error.code = "CLAUDE_CODE_JOURNAL_LOCK_TIMEOUT";
    error.coverageComplete = false;
    throw error;
  }

  try {
    return await action();
  } finally {
    await lock.close();
    await unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

function appendEvent(journal, event) {
  event.sequence = (journal.events.at(-1)?.sequence ?? 0) + 1;
  journal.events.push(event);
}

export async function readClaudeCodeCaptureJournal(path) {
  try {
    return validateJournal(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") {
      await rejectPartialWrite(path);
      throw error;
    }
    if (error instanceof SyntaxError) {
      const corrupt = new Error("Claude Code capture journal is corrupt or partially written");
      corrupt.code = "CLAUDE_CODE_JOURNAL_CORRUPT";
      corrupt.coverageComplete = false;
      throw corrupt;
    }
    throw error;
  }
}

export async function captureClaudeCodeHookEvent({
  payload,
  journalPath,
  receivedAt,
  excludeSessionId,
  reviewWorker = false,
}) {
  const normalizedAt = normalizeReceivedAt(receivedAt);
  const excluded = exclusionReason(payload, excludeSessionId, reviewWorker);
  if (excluded) return { status: "ignored", reason: excluded };
  if (hasUncertainProvenance(payload)) {
    return withJournalLock(journalPath, async () => {
      const journal = await readJournalOrCreate(journalPath, normalizedAt);
      const gap = {
        reason: "uncertain-provenance",
        sessionId: typeof payload.session_id === "string" ? payload.session_id : "unknown",
        receivedAt: normalizedAt,
      };
      journal.coverage.gaps.push(gap);
      await writePrivateJournal(journalPath, journal);
      return { status: "incomplete", reason: gap.reason };
    });
  }
  const event = normalizeDirectUser(payload, normalizedAt);
  const batch = normalizeDisplayBatch(payload, normalizedAt);
  if (!event && !batch) return { status: "ignored", reason: "not-a-visible-message" };

  return withJournalLock(journalPath, async () => {
    const journal = await readJournalOrCreate(journalPath, normalizedAt);
    if (event) {
      const turnBoundary = journal.events.findLast((existing) => (
        existing.sessionId === event.sessionId && existing.role === "assistant"
      ))?.sequence ?? 0;
      event.id = opaqueId("user", event.sessionId, event.text, String(turnBoundary));
      event.messageId = opaqueId("prompt", event.sessionId, event.text, String(turnBoundary));
      if (journal.events.some((existing) => existing.id === event.id)) {
        return { status: "ignored", reason: "duplicate" };
      }
      appendEvent(journal, event);
      await writePrivateJournal(journalPath, journal);
      return { status: "captured", event: journal.events.find((existing) => existing.id === event.id) };
    }

    const assistantId = opaqueId("assistant", batch.sessionId, batch.messageId);
    if (journal.events.some((existing) => existing.id === assistantId)) {
      return { status: "ignored", reason: "duplicate" };
    }

    const pendingKey = opaqueId("display", batch.sessionId, batch.messageId);
    const pending = journal.pendingDisplays[pendingKey] ?? {
      sessionId: batch.sessionId,
      messageId: batch.messageId,
      batches: {},
      finalIndex: null,
      finalReceivedAt: null,
    };
    const existing = pending.batches[String(batch.index)];
    if (existing) {
      if (existing.text === batch.text && existing.final === batch.final) {
        return { status: "ignored", reason: "duplicate" };
      }
      journal.coverage.gaps.push({
        reason: "conflicting-display-batch",
        sessionId: batch.sessionId,
        messageId: batch.messageId,
        receivedAt: batch.receivedAt,
      });
      delete journal.pendingDisplays[pendingKey];
      await writePrivateJournal(journalPath, journal);
      return { status: "incomplete", reason: "conflicting-display-batch" };
    }
    if (
      batch.final &&
      Number.isInteger(pending.finalIndex) &&
      pending.finalIndex !== batch.index
    ) {
      journal.coverage.gaps.push({
        reason: "conflicting-display-final",
        sessionId: batch.sessionId,
        messageId: batch.messageId,
        receivedAt: batch.receivedAt,
      });
      delete journal.pendingDisplays[pendingKey];
      await writePrivateJournal(journalPath, journal);
      return { status: "incomplete", reason: "conflicting-display-final" };
    }

    pending.batches[String(batch.index)] = {
      text: batch.text,
      final: batch.final,
      receivedAt: batch.receivedAt,
    };
    if (batch.final) {
      pending.finalIndex = batch.index;
      pending.finalReceivedAt = batch.receivedAt;
    }
    journal.pendingDisplays[pendingKey] = pending;

    const complete = Number.isInteger(pending.finalIndex) &&
      Array.from({ length: pending.finalIndex + 1 }, (_, index) => String(index))
        .every((index) => pending.batches[index]);
    if (!complete) {
      await writePrivateJournal(journalPath, journal);
      return { status: "pending" };
    }

    const text = Array.from(
      { length: pending.finalIndex + 1 },
      (_, index) => pending.batches[String(index)].text,
    ).join("").trim();
    delete journal.pendingDisplays[pendingKey];
    if (!text) {
      await writePrivateJournal(journalPath, journal);
      return { status: "ignored", reason: "empty" };
    }

    const assistantEvent = {
      id: assistantId,
      sessionId: batch.sessionId,
      messageId: batch.messageId,
      role: "assistant",
      receivedAt: pending.finalReceivedAt,
      sequence: 0,
      text,
    };
    appendEvent(journal, assistantEvent);
    await writePrivateJournal(journalPath, journal);
    return {
      status: "captured",
      event: journal.events.find((existing) => existing.id === assistantId),
    };
  });
}
