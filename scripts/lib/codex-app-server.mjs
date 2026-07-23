import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const INTERACTIVE_THREAD_SOURCES = new Set(["cli", "vscode", "appServer"]);

function isInteractivePrimaryThread(thread) {
  return thread?.parentThreadId === null && INTERACTIVE_THREAD_SOURCES.has(thread.source);
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

function messageTimestamp(turn, role) {
  const seconds = role === "assistant"
    ? turn.completedAt ?? turn.startedAt
    : turn.startedAt ?? turn.completedAt;
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

function userMessageText(item) {
  return (item.content ?? [])
    .filter((content) => content?.type === "text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function isAfterCursor(message, cursor) {
  if (!cursor) return true;
  if (message.timestamp !== cursor.timestamp) return message.timestamp > cursor.timestamp;
  return message.id > cursor.messageId;
}

function newestCursor(messages) {
  return messages.reduce((latest, message) => {
    const candidate = { timestamp: message.timestamp, messageId: message.id };
    if (!latest || candidate.timestamp > latest.timestamp) return candidate;
    if (candidate.timestamp === latest.timestamp && candidate.messageId > latest.messageId) return candidate;
    return latest;
  }, null);
}

export function buildCodexReviewWindow({
  threads,
  sourceId,
  reviewDay,
  timeZone,
  state,
  excludeThreadId,
}) {
  const visibleMessages = [];
  const candidateCursors = {};

  for (const thread of threads) {
    const threadId = thread.id;
    if (!threadId || threadId === excludeThreadId || !isInteractivePrimaryThread(thread)) continue;

    const messages = (thread.turns ?? []).flatMap((turn) => (turn.items ?? []).flatMap((item) => {
      let role;
      let text;
      if (item.type === "userMessage") {
        role = "user";
        text = userMessageText(item);
      } else if (item.type === "agentMessage") {
        role = "assistant";
        text = typeof item.text === "string" ? item.text.trim() : "";
      } else {
        return [];
      }

      const timestamp = messageTimestamp(turn, role);
      if (!item.id || !text || !timestamp || dateInTimeZone(timestamp, timeZone) !== reviewDay) return [];
      return [{
        id: String(item.id),
        sessionKey: threadId,
        role,
        timestamp,
        text,
      }];
    }));

    const freshMessages = messages.filter((message) => isAfterCursor(message, state.sessions?.[threadId]));
    const cursor = newestCursor(freshMessages);
    if (cursor) candidateCursors[threadId] = cursor;
    visibleMessages.push(...freshMessages);
  }

  visibleMessages.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  return { sourceId, reviewDay, timeZone, messages: visibleMessages, candidateCursors };
}

export function createAppServerClient({ binary = "codex", spawnProcess = spawn } = {}) {
  const process = spawnProcess(binary, ["app-server", "--listen", "stdio://"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: process.stdout });
  const pending = new Map();
  let nextId = 0;
  let stderr = "";

  function fail(error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  process.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id === undefined || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message ?? "Codex app-server request failed"));
    else resolve(message.result);
  });
  process.on("error", fail);
  process.stdin.on("error", fail);
  process.on("exit", (code) => fail(
    new Error(`Codex app-server exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`),
  ));

  function send(message) {
    process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        send({ method, id, params });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  return {
    async initialize() {
      await request("initialize", {
        clientInfo: { name: "agent_blog", title: "Agent Blog", version: "0.1.0" },
      });
      send({ method: "initialized", params: {} });
    },
    request,
    close() {
      lines.close();
      process.stdin.end();
    },
  };
}

export async function collectCodexWindow({
  sourceId,
  reviewDay,
  timeZone,
  state,
  binary = "codex",
  clientFactory = createAppServerClient,
  excludeThreadId,
}) {
  if (typeof excludeThreadId !== "string" || !excludeThreadId.trim()) {
    throw new Error("Codex collection requires the current review thread id");
  }
  const client = clientFactory({ binary });
  const threads = [];

  try {
    await client.initialize();
    for (const archived of [false, true]) {
      let cursor = null;
      do {
        const page = await client.request("thread/list", {
          cursor,
          limit: 100,
          archived,
          sortKey: "updated_at",
          sortDirection: "desc",
          sourceKinds: [...INTERACTIVE_THREAD_SOURCES],
        });
        const candidates = (page.data ?? []).filter((listed) => (
          isInteractivePrimaryThread(listed) && (
            !Number.isFinite(listed.updatedAt) ||
            dateInTimeZone(listed.updatedAt * 1000, timeZone) >= reviewDay
          )
        ));
        for (const listed of candidates) {
          if (listed.id === excludeThreadId) continue;
          const result = await client.request("thread/read", {
            threadId: listed.id,
            includeTurns: true,
          });
          threads.push(result.thread);
        }
        cursor = candidates.length ? page.nextCursor ?? null : null;
      } while (cursor);
    }
  } finally {
    client.close();
  }

  return buildCodexReviewWindow({
    threads,
    sourceId,
    reviewDay,
    timeZone,
    state,
    excludeThreadId,
  });
}
