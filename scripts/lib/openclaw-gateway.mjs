import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export function previousReviewDay(now, timeZone) {
  const today = dateInTimeZone(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

function timestampOf(message) {
  const raw = message.timestamp ?? message.createdAt ?? message.created_at ?? message.ts;
  if (typeof raw === "number") return raw < 10_000_000_000 ? raw * 1000 : raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textOf(message) {
  const content = message.content ?? message.text ?? message.message?.content ?? message.message?.text;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .filter((block) => !block?.type || ["text", "input_text", "output_text"].includes(block.type))
    .map((block) => (typeof block === "string" ? block : block?.text ?? ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isAfterCursor(message, cursor) {
  if (!cursor) return true;
  const timestamp = timestampOf(message);
  if (timestamp > cursor.timestamp) return true;
  if (timestamp < cursor.timestamp) return false;
  return message.id !== cursor.messageId;
}

function newestCursor(messages) {
  return messages.reduce((latest, message) => {
    const candidate = { timestamp: timestampOf(message), messageId: String(message.id ?? "") };
    if (!latest || candidate.timestamp > latest.timestamp) return candidate;
    if (candidate.timestamp === latest.timestamp && candidate.messageId > latest.messageId) return candidate;
    return latest;
  }, null);
}

export function buildReviewWindowFromSessions({ sessions, sourceId, reviewDay, timeZone, state }) {
  const visibleMessages = [];
  const candidateCursors = {};

  for (const session of sessions) {
    const key = session.key ?? session.sessionKey;
    if (
      !key ||
      session.spawnedBy ||
      key.includes(":subagent:") ||
      key.startsWith("cron:") ||
      session.kind === "cron"
    ) continue;

    const dayMessages = (session.messages ?? []).filter(
      (message) => timestampOf(message) && dateInTimeZone(timestampOf(message), timeZone) === reviewDay,
    );
    const freshMessages = dayMessages.filter((message) => isAfterCursor(message, state.sessions?.[key]));
    const cursor = newestCursor(freshMessages);
    if (cursor) candidateCursors[key] = cursor;

    for (const message of freshMessages) {
      const role = message.role ?? message.message?.role;
      if (!['user', 'assistant'].includes(role)) continue;
      const text = textOf(message);
      if (!text) continue;
      visibleMessages.push({
        id: String(message.id ?? ""),
        sessionKey: key,
        agentId: session.agentId,
        role,
        timestamp: timestampOf(message),
        text,
      });
    }
  }

  visibleMessages.sort((left, right) => left.timestamp - right.timestamp);

  return { sourceId, reviewDay, timeZone, messages: visibleMessages, candidateCursors };
}

function unwrapGatewayPayload(payload) {
  if (payload?.result !== undefined) return payload.result;
  return payload;
}

async function gatewayCall(binary, method, params) {
  const { stdout } = await execFileAsync(
    binary,
    ["gateway", "call", method, "--params", JSON.stringify(params), "--json"],
    { maxBuffer: 12 * 1024 * 1024 },
  );
  return unwrapGatewayPayload(JSON.parse(stdout));
}

export function sessionsListParams(limit, offset) {
  return { limit, offset, configuredAgentsOnly: true };
}

async function listSessions(binary) {
  const sessions = [];
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const payload = await gatewayCall(binary, "sessions.list", sessionsListParams(limit, offset));
    const rows = payload.sessions ?? [];
    sessions.push(...rows);
    if (rows.length < limit || sessions.length >= (payload.totalCount ?? Infinity)) break;
  }

  return sessions;
}

export async function collectGatewayWindow({
  sourceId,
  reviewDay,
  timeZone,
  state,
  binary = "openclaw",
}) {
  const sessions = await listSessions(binary);
  const hydrated = [];

  for (const session of sessions) {
    const key = session.key ?? session.sessionKey;
    if (
      !key ||
      session.spawnedBy ||
      key.includes(":subagent:") ||
      key.startsWith("cron:") ||
      session.kind === "cron"
    ) continue;
    const history = await gatewayCall(binary, "chat.history", {
      sessionKey: key,
      agentId: session.agentId,
      limit: 1000,
      maxChars: 500000,
    });
    hydrated.push({ ...session, key, messages: history.messages ?? [] });
  }

  return buildReviewWindowFromSessions({ sessions: hydrated, sourceId, reviewDay, timeZone, state });
}
