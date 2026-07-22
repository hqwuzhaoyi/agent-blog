import { loadPiSessionsReadOnly } from "./pi-session-loader.mjs";

const KNOWN_ENTRY_TYPES = new Set([
  "message",
  "thinking_level_change",
  "model_change",
  "compaction",
  "branch_summary",
  "custom",
  "custom_message",
  "label",
  "session_info",
]);
const EXCLUDED_MESSAGE_ROLES = new Set([
  "toolResult",
  "bashExecution",
  "custom",
  "branchSummary",
  "compactionSummary",
]);
const USER_CONTENT_TYPES = new Set(["text", "image"]);
const ASSISTANT_CONTENT_TYPES = new Set(["text", "thinking", "toolCall"]);
const NORMALIZED_SESSION_KEYS = new Set(["sessionId", "provenance", "entries"]);

export class PiReviewWindowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PiReviewWindowError";
    this.code = code;
  }
}

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

function unsupportedSchema() {
  return new PiReviewWindowError("unsupported-schema", "Pi session contains an unsupported schema");
}

function validateNormalizedSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) throw unsupportedSchema();
  const keys = Reflect.ownKeys(session);
  if (
    keys.length !== NORMALIZED_SESSION_KEYS.size ||
    keys.some((key) => typeof key !== "string" || !NORMALIZED_SESSION_KEYS.has(key)) ||
    typeof session.sessionId !== "string" ||
    !session.sessionId ||
    !Array.isArray(session.entries)
  ) {
    throw unsupportedSchema();
  }
}

function visibleMessageText(message) {
  if (!message || typeof message !== "object" || typeof message.role !== "string") {
    throw unsupportedSchema();
  }
  if (EXCLUDED_MESSAGE_ROLES.has(message.role)) return null;
  if (message.role !== "user" && message.role !== "assistant") throw unsupportedSchema();
  if (message.role === "user" && typeof message.content === "string") return message.content.trim();
  if (!Array.isArray(message.content)) throw unsupportedSchema();

  const allowedTypes = message.role === "user" ? USER_CONTENT_TYPES : ASSISTANT_CONTENT_TYPES;
  const text = [];
  for (const block of message.content) {
    if (!block || typeof block !== "object" || !allowedTypes.has(block.type)) throw unsupportedSchema();
    if (block.type !== "text") continue;
    if (typeof block.text !== "string") throw unsupportedSchema();
    text.push(block.text);
  }
  return text.join("\n").trim();
}

function compareOpaqueIds(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function isAfterCursor(message, cursor) {
  if (!cursor) return true;
  if (message.timestamp !== cursor.timestamp) return message.timestamp > cursor.timestamp;
  return compareOpaqueIds(message.id, String(cursor.messageId)) > 0;
}

function newestCursor(messages) {
  return messages.reduce((latest, message) => {
    if (!latest || message.timestamp > latest.timestamp) {
      return { timestamp: message.timestamp, messageId: message.id };
    }
    if (message.timestamp === latest.timestamp && compareOpaqueIds(message.id, latest.messageId) > 0) {
      return { timestamp: message.timestamp, messageId: message.id };
    }
    return latest;
  }, null);
}

export function buildPiReviewWindowFromSessions({
  sessions,
  sourceId,
  reviewDay,
  timeZone,
  state,
  excludeSessionId,
}) {
  if (!Array.isArray(sessions)) throw unsupportedSchema();
  const messages = [];
  const candidateCursors = {};

  for (const session of sessions) {
    validateNormalizedSession(session);
    if (session.sessionId === excludeSessionId) continue;
    if (session.provenance === "subagent") continue;
    if (session.provenance !== "primary") {
      throw new PiReviewWindowError("uncertain-provenance", "Pi session provenance is not supported");
    }
    const sessionMessages = [];
    for (const entry of session.entries) {
      if (!entry || typeof entry !== "object" || !KNOWN_ENTRY_TYPES.has(entry.type)) {
        throw new PiReviewWindowError("unsupported-schema", "Pi session contains an unsupported schema");
      }
      const timestamp = Date.parse(entry.timestamp);
      if (typeof entry.id !== "string" || !entry.id || !Number.isFinite(timestamp)) {
        throw unsupportedSchema();
      }
      if (entry.type !== "message") continue;
      const role = entry.message?.role;
      const text = visibleMessageText(entry.message);
      if (text === null) continue;
      if (!text) continue;
      if (dateInTimeZone(timestamp, timeZone) !== reviewDay) continue;
      sessionMessages.push({
        id: String(entry.id),
        sessionKey: session.sessionId,
        role,
        timestamp,
        text,
      });
    }
    const freshMessages = sessionMessages.filter((message) => (
      isAfterCursor(message, state.sessions?.[session.sessionId])
    ));
    const cursor = newestCursor(freshMessages);
    if (cursor) candidateCursors[session.sessionId] = cursor;
    messages.push(...freshMessages);
  }
  messages.sort((left, right) => (
    left.timestamp - right.timestamp || compareOpaqueIds(left.id, right.id)
  ));

  return {
    sourceId,
    reviewDay,
    timeZone,
    messages,
    candidateCursors,
  };
}

export async function collectPiReviewWindow({
  sdk,
  sourceId,
  reviewDay,
  timeZone,
  state,
  sessionDir,
  excludeSessionId,
  snapshotRoot,
  fileSystem,
}) {
  const loaded = await loadPiSessionsReadOnly({
    sessionManager: sdk.SessionManager,
    sessionDirectory: sessionDir,
    snapshotRoot,
    fileSystem,
  });
  const sessions = [];
  for (const session of loaded.sessions) {
    if (session.sessionId === excludeSessionId) continue;
    let provenance = "unknown";
    try {
      provenance = sdk.classifySession(session.sessionId);
    } catch {
      // The shared builder converts uncertain provenance into a stable fail-closed error.
    }
    sessions.push({
      sessionId: session.sessionId,
      provenance,
      entries: session.entries,
    });
  }
  const window = buildPiReviewWindowFromSessions({
    sessions,
    sourceId,
    reviewDay,
    timeZone,
    state,
    excludeSessionId,
  });
  return { ...window, deferred: loaded.deferred };
}
