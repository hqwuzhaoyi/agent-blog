import { readClaudeCodeCaptureJournal } from "./claude-code-capture.mjs";
import {
  loadClaudeCodeRuntime,
  reconcileClaudeCodeRuntime,
} from "./claude-code-runtime.mjs";

function dateInTimeZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDateTime(timestamp, timeZone) {
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}.${values.fractionalSecond}`,
  };
}

function incompleteResult({ sourceId, reviewDay, timeZone }, reason) {
  return {
    status: "incomplete",
    reason,
    sourceId,
    reviewDay,
    timeZone,
    messages: [],
    candidateCursors: {},
  };
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

function isNormalizedEvent(event) {
  return hasOnlyKeys(event, [
    "id",
    "sessionId",
    "messageId",
    "role",
    "receivedAt",
    "sequence",
    "text",
  ]) &&
    typeof event.id === "string" && Boolean(event.id) &&
    typeof event.sessionId === "string" && Boolean(event.sessionId) &&
    typeof event.messageId === "string" && Boolean(event.messageId) &&
    ["user", "assistant"].includes(event.role) &&
    typeof event.receivedAt === "string" && Number.isFinite(Date.parse(event.receivedAt)) &&
    Number.isInteger(event.sequence) && event.sequence > 0 &&
    typeof event.text === "string" && Boolean(event.text.trim());
}

function isNormalizedInventorySession(session) {
  return hasOnlyKeys(session, ["sessionId", "provenance"]) &&
    typeof session.sessionId === "string" && Boolean(session.sessionId) &&
    ["primary", "subagent", "uncertain"].includes(session.provenance);
}

function isNormalizedCoverage(coverage) {
  return hasOnlyKeys(coverage, [
    "startedAt",
    "completedAt",
    "complete",
    "gaps",
    "reconciliation",
  ]) && Array.isArray(coverage.gaps);
}

function coverageFailure(coverage, reviewDay, timeZone) {
  if (coverage?.complete !== true) return "coverage-incomplete";
  if (!Array.isArray(coverage.gaps)) return "missing-coverage-marker";
  if (coverage.gaps.length > 0) return "coverage-gap";
  if (coverage.reconciliation === "mismatch") return "reconciliation-mismatch";
  if (coverage.reconciliation !== "matched") return "missing-coverage-marker";

  const started = localDateTime(coverage.startedAt, timeZone);
  const completed = localDateTime(coverage.completedAt, timeZone);
  if (!started || !completed) return "missing-coverage-marker";
  if (started.date > reviewDay || (started.date === reviewDay && started.time > "00:00:00.000")) {
    return "historical-coverage-missing";
  }
  if (completed.date < reviewDay || (
    completed.date === reviewDay && completed.time < "23:59:59.999"
  )) return "missing-coverage-marker";
  return null;
}

function newestCursor(messages) {
  const latest = messages.at(-1);
  if (!latest) return null;
  return {
    sequence: latest.sequence,
    timestamp: latest.timestamp,
    messageId: latest.id,
  };
}

export async function collectClaudeCodeReviewWindow({
  journalPath,
  events,
  inventory,
  coverage,
  sourceId,
  reviewDay,
  timeZone,
  state,
  excludeSessionId,
}) {
  const failure = coverageFailure(coverage, reviewDay, timeZone);
  if (failure) return incompleteResult({ sourceId, reviewDay, timeZone }, failure);

  if (journalPath) {
    try {
      const journal = await readClaudeCodeCaptureJournal(journalPath);
      if (journal.coverage.gaps.length > 0) {
        return incompleteResult({ sourceId, reviewDay, timeZone }, "journal-coverage-gap");
      }
      if (Object.keys(journal.pendingDisplays).length > 0) {
        return incompleteResult({ sourceId, reviewDay, timeZone }, "pending-display-batches");
      }
      events = journal.events;
    } catch (error) {
      const reason = error?.code === "CLAUDE_CODE_JOURNAL_CORRUPT"
        ? "journal-corrupt"
        : error?.code === "CLAUDE_CODE_JOURNAL_PARTIAL_WRITE"
          ? "journal-partial-write"
          : error?.code === "ENOENT"
            ? "missing-capture-interval"
            : null;
      if (!reason) throw error;
      return incompleteResult({ sourceId, reviewDay, timeZone }, reason);
    }
  }
  if (!Array.isArray(events) || !events.every(isNormalizedEvent)) {
    return incompleteResult({ sourceId, reviewDay, timeZone }, "malformed-normalized-event");
  }

  const inventoryBySession = new Map(
    (inventory ?? []).map((session) => [session?.sessionId, session]),
  );
  const includedEvents = (events ?? []).filter((event) => event.sessionId !== excludeSessionId);
  for (const event of includedEvents) {
    const session = inventoryBySession.get(event.sessionId);
    if (!session) {
      return incompleteResult({ sourceId, reviewDay, timeZone }, "reconciliation-mismatch");
    }
    if (session.provenance !== "primary") {
      return incompleteResult({ sourceId, reviewDay, timeZone }, "uncertain-subagent-provenance");
    }
  }

  for (const [sessionId, cursor] of Object.entries(state?.sessions ?? {})) {
    if (sessionId === excludeSessionId) continue;
    const sessionEvents = includedEvents.filter((event) => event.sessionId === sessionId);
    const validCursor = (
      Number.isInteger(cursor?.sequence) &&
      cursor.sequence > 0 &&
      Number.isFinite(cursor?.timestamp) &&
      typeof cursor?.messageId === "string" &&
      cursor.messageId
    );
    if (!validCursor) {
      return incompleteResult(
        { sourceId, reviewDay, timeZone },
        "cursor-reconciliation-mismatch",
      );
    }
    const hasLaterEvent = validCursor && sessionEvents.some((event) => event.sequence > cursor.sequence);
    const hasAnchor = validCursor && sessionEvents.some((event) => (
      event.sequence === cursor.sequence &&
      event.id === cursor.messageId &&
      Date.parse(event.receivedAt) === cursor.timestamp
    ));
    if (hasLaterEvent && !hasAnchor) {
      return incompleteResult(
        { sourceId, reviewDay, timeZone },
        "cursor-reconciliation-mismatch",
      );
    }
  }

  const messages = includedEvents
    .filter((event) => (
      dateInTimeZone(event.receivedAt, timeZone) === reviewDay
    ))
    .map((event) => ({
      id: event.id,
      sessionKey: event.sessionId,
      role: event.role,
      timestamp: Date.parse(event.receivedAt),
      sequence: event.sequence,
      text: event.text,
    }))
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));

  const freshMessages = messages.filter((message) => {
    const cursor = state?.sessions?.[message.sessionKey];
    return !cursor || message.sequence > cursor.sequence;
  });
  const candidateCursors = {};
  for (const sessionId of new Set(freshMessages.map((message) => message.sessionKey))) {
    const cursor = newestCursor(freshMessages.filter((message) => message.sessionKey === sessionId));
    if (cursor) candidateCursors[sessionId] = cursor;
  }

  return {
    sourceId,
    reviewDay,
    timeZone,
    messages: freshMessages.map(({ sequence: _sequence, ...message }) => message),
    candidateCursors,
  };
}

export async function collectClaudeCodeLiveWindow({
  sourceId,
  reviewDay,
  timeZone,
  state,
  journalPath,
  coverageStartedAt,
  excludeSessionId,
  moduleLoader,
  now = () => new Date(),
}) {
  const context = { sourceId, reviewDay, timeZone };
  let journal;
  try {
    journal = await readClaudeCodeCaptureJournal(journalPath);
  } catch (error) {
    const reason = error?.code === "CLAUDE_CODE_JOURNAL_CORRUPT"
      ? "journal-corrupt"
      : error?.code === "CLAUDE_CODE_JOURNAL_PARTIAL_WRITE"
        ? "journal-partial-write"
        : error?.code === "ENOENT"
          ? "missing-capture-interval"
          : null;
    if (!reason) throw error;
    return incompleteResult(context, reason);
  }
  if (journal.coverage.gaps.length > 0) {
    return incompleteResult(context, "journal-coverage-gap");
  }
  if (Object.keys(journal.pendingDisplays).length > 0) {
    return incompleteResult(context, "pending-display-batches");
  }

  let completedAt;
  try {
    completedAt = new Date(typeof now === "function" ? now() : now).toISOString();
  } catch {
    return incompleteResult(context, "missing-coverage-marker");
  }
  const coverage = {
    startedAt: coverageStartedAt,
    completedAt,
    complete: true,
    gaps: [],
    reconciliation: "matched",
  };
  const failure = coverageFailure(coverage, reviewDay, timeZone);
  if (failure) return incompleteResult(context, failure);

  let reconciled;
  try {
    const { sdk } = await loadClaudeCodeRuntime({ moduleLoader });
    reconciled = await reconcileClaudeCodeRuntime({
      sdk,
      events: journal.events,
      coverage,
      excludeSessionId,
    });
  } catch {
    return incompleteResult(context, "reconciliation-unavailable");
  }
  return collectClaudeCodeReviewWindow({
    events: journal.events,
    inventory: reconciled.inventory,
    coverage: reconciled.coverage,
    sourceId,
    reviewDay,
    timeZone,
    state,
    excludeSessionId,
  });
}

export async function buildClaudeCodeReviewWindowFromFixture({
  fixture,
  sourceId,
  reviewDay,
  timeZone,
  state,
  excludeSessionId,
}) {
  const context = { sourceId, reviewDay, timeZone };
  if (
    !hasOnlyKeys(fixture, ["events", "inventory", "coverage"]) ||
    !Object.hasOwn(fixture, "events") ||
    !Object.hasOwn(fixture, "inventory") ||
    !Object.hasOwn(fixture, "coverage") ||
    !Array.isArray(fixture.events) ||
    !fixture.events.every(isNormalizedEvent) ||
    !Array.isArray(fixture.inventory) ||
    !fixture.inventory.every(isNormalizedInventorySession) ||
    !fixture.coverage ||
    typeof fixture.coverage !== "object" ||
    Array.isArray(fixture.coverage) ||
    !isNormalizedCoverage(fixture.coverage)
  ) return incompleteResult(context, "malformed-fixture");

  return collectClaudeCodeReviewWindow({
    events: fixture.events,
    inventory: fixture.inventory,
    coverage: fixture.coverage,
    sourceId,
    reviewDay,
    timeZone,
    state,
    excludeSessionId,
  });
}
