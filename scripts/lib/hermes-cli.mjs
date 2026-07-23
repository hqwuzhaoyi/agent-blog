import { spawn } from "node:child_process";

class HermesSchemaError extends Error {}

function assertHermesSourceBoundary(hermesHome, hermesProfile) {
  const hasHome = typeof hermesHome === "string" && hermesHome.length > 0;
  const hasProfile = typeof hermesProfile === "string" && hermesProfile.length > 0;
  if (hasHome === hasProfile) {
    throw new Error("Hermes collection requires exactly one of hermesHome or hermesProfile");
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

function timestampOf(message) {
  const value = message?.timestamp;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function compareMessageIds(left, right) {
  const leftId = String(left);
  const rightId = String(right);
  if (/^\d+$/.test(leftId) && /^\d+$/.test(rightId)) {
    const leftNumber = BigInt(leftId);
    const rightNumber = BigInt(rightId);
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }
  return leftId.localeCompare(rightId);
}

function stripHiddenMarkup(text) {
  const reasoning = "think|thinking|reasoning|thought|REASONING_SCRATCHPAD";
  const tools = "tool_call|tool_calls|tool_result|function_call|function_calls|function";
  return text
    .replace(new RegExp(`<(?:${reasoning})\\b[^>]*>[\\s\\S]*?<\\/(?:${reasoning})\\s*>`, "gi"), "")
    .replace(new RegExp(`^[\\s\\S]*?<\\/(?:${reasoning})\\s*>`, "i"), "")
    .replace(new RegExp(`(?:^|\\n)\\s*<(?:${reasoning})\\b[^>]*>[\\s\\S]*$`, "i"), "")
    .replace(new RegExp(`<(?:${tools})\\b[^>]*>[\\s\\S]*?<\\/(?:${tools})\\s*>`, "gi"), "")
    .replace(new RegExp(`(?:^|\\n)\\s*<(?:${tools})\\b[^>]*>[\\s\\S]*$`, "i"), "")
    .replace(new RegExp(`<\\/?(?:${reasoning}|${tools})\\b[^>]*>`, "gi"), "")
    .trim();
}

function visibleText(message) {
  const content = message?.content;
  if (typeof content === "string") return stripHiddenMarkup(content);
  if (!Array.isArray(content)) return "";
  return stripHiddenMarkup(content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n"));
}

function hasKnownContentSchema(content) {
  if (typeof content === "string") return true;
  if (!Array.isArray(content)) return false;
  return content.every((block) => (
    block &&
    typeof block === "object" &&
    (block.type === "image_url" || (block.type === "text" && typeof block.text === "string"))
  ));
}

function newestCursor(messages) {
  return messages.reduce((latest, message) => {
    const candidate = { timestamp: message.timestamp, messageId: message.id };
    if (!latest || candidate.timestamp > latest.timestamp) return candidate;
    if (
      candidate.timestamp === latest.timestamp &&
      compareMessageIds(candidate.messageId, latest.messageId) > 0
    ) return candidate;
    return latest;
  }, null);
}

async function readText(stream) {
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  return text;
}

async function drainBounded(stream, maxObservedBytes = 64 * 1024) {
  let observedBytes = 0;
  let truncated = false;
  try {
    for await (const chunk of stream) {
      const remaining = maxObservedBytes - observedBytes;
      const chunkBytes = Buffer.byteLength(chunk);
      if (remaining > 0) observedBytes += Math.min(remaining, chunkBytes);
      if (chunkBytes > remaining) truncated = true;
    }
    return { failed: false, observedBytes, truncated };
  } catch {
    return { failed: true, observedBytes, truncated };
  }
}

async function checkedText(result, label) {
  try {
    const [stdout, stderrStatus, completion] = await Promise.all([
      readText(result.stdout),
      drainBounded(result.stderr),
      result.completed,
    ]);
    if (stderrStatus.failed || completion.code !== 0) throw new Error(`${label} failed`);
    return stdout;
  } catch {
    throw new Error(`${label} failed`);
  }
}

function retainLiveSession(raw, { reviewDay, timeZone, state, excludeSessionId }, lineNumber) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HermesSchemaError();
  }
  const metadata = {
    id: raw.id,
    source: raw.source,
    parent_session_id: raw.parent_session_id,
    started_at: raw.started_at,
    ended_at: raw.ended_at,
    end_reason: raw.end_reason,
  };
  const sessionKey = metadata.id;
  const savedCursor = state.sessions?.[sessionKey];
  let hasAnchor = !savedCursor;
  let hasLaterRow = false;
  let schemaInvalid = false;
  const messages = [];
  const isBaseEligible = (
    sessionKey &&
    sessionKey !== excludeSessionId &&
    !["cron", "tool"].includes(metadata.source)
  );

  if (isBaseEligible && !Array.isArray(raw.messages)) schemaInvalid = true;
  if (isBaseEligible && Array.isArray(raw.messages)) {
    for (const message of raw.messages) {
      const timestamp = timestampOf(message);
      const id = String(message?.id ?? "");
      const isCandidate = (
        message?.active !== 0 &&
        message?.active !== false &&
        Boolean(message?.id) &&
        Boolean(timestamp) &&
        dateInTimeZone(timestamp, timeZone) === reviewDay &&
        (!savedCursor ||
          timestamp > savedCursor.timestamp ||
          (timestamp === savedCursor.timestamp && compareMessageIds(id, savedCursor.messageId) > 0))
      );
      if (!["user", "assistant", "system", "tool"].includes(message?.role)) {
        if (isCandidate) schemaInvalid = true;
        continue;
      }
      if (!["user", "assistant"].includes(message.role)) continue;
      if (savedCursor) {
        if (id === savedCursor.messageId && timestamp === savedCursor.timestamp) hasAnchor = true;
        if (
          timestamp > savedCursor.timestamp ||
          (timestamp === savedCursor.timestamp && compareMessageIds(id, savedCursor.messageId) > 0)
        ) hasLaterRow = true;
      }
      if (!isCandidate) continue;
      if (!hasKnownContentSchema(message.content)) {
        schemaInvalid = true;
        continue;
      }
      const text = visibleText(message);
      if (!text) continue;
      messages.push({ id, sessionKey, role: message.role, timestamp, text });
    }
  }

  return {
    metadata,
    messages,
    cursor: newestCursor(messages),
    hasAnchor,
    hasLaterRow,
    schemaInvalid,
    lineNumber,
  };
}

function buildLiveReviewWindow(records, { sourceId, reviewDay, timeZone, state, excludeSessionId }) {
  const metadataById = new Map(records.map((record) => [record.metadata.id, record.metadata]));
  const messages = [];
  const candidateCursors = {};

  for (const record of records) {
    const session = record.metadata;
    const sessionKey = session.id;
    if (
      !sessionKey ||
      sessionKey === excludeSessionId ||
      ["cron", "tool"].includes(session.source)
    ) continue;
    if (session.parent_session_id) {
      const parent = metadataById.get(session.parent_session_id);
      const isVisibleContinuation = (
        ["compression", "branched"].includes(parent?.end_reason) &&
        Number.isFinite(parent?.ended_at) &&
        Number.isFinite(session.started_at) &&
        session.started_at >= parent.ended_at
      );
      if (!isVisibleContinuation) continue;
    }
    if (record.schemaInvalid) {
      throw new Error(`Unsupported Hermes export schema at line ${record.lineNumber}`);
    }
    if (state.sessions?.[sessionKey] && !record.hasAnchor && record.hasLaterRow) {
      throw new Error(`Hermes session rewrite detected: ${sessionKey}`);
    }
    if (record.cursor) candidateCursors[sessionKey] = record.cursor;
    messages.push(...record.messages);
  }

  messages.sort((left, right) => (
    left.timestamp - right.timestamp ||
    left.sessionKey.localeCompare(right.sessionKey) ||
    compareMessageIds(left.id, right.id)
  ));
  return { sourceId, reviewDay, timeZone, messages, candidateCursors };
}

async function readExportWindow(result, maxLineBytes, context) {
  const stderrPromise = drainBounded(result.stderr);
  const records = [];
  let buffer = "";
  let lineNumber = 0;

  function parseLine(line) {
    lineNumber += 1;
    const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!normalized) return;
    if (Buffer.byteLength(normalized) > maxLineBytes) {
      throw new Error(`Hermes export line exceeds ${maxLineBytes} bytes`);
    }
    let raw;
    try {
      raw = JSON.parse(normalized);
    } catch {
      throw new Error(`Malformed Hermes export JSONL at line ${lineNumber}`);
    }
    try {
      records.push(retainLiveSession(raw, context, lineNumber));
    } catch (error) {
      if (error instanceof HermesSchemaError) {
        throw new Error(`Unsupported Hermes export schema at line ${lineNumber}`);
      }
      throw error;
    }
  }

  try {
    for await (const chunk of result.stdout) {
      buffer += chunk.toString();
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        parseLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (Buffer.byteLength(buffer) > maxLineBytes) {
        throw new Error(`Hermes export line exceeds ${maxLineBytes} bytes`);
      }
    }
    if (buffer) parseLine(buffer);
  } catch (error) {
    try {
      result.cancel?.();
    } catch {
      // Cancellation is best-effort; never expose process details from this boundary.
    }
    await Promise.allSettled([stderrPromise, result.completed]);
    if (
      /^Malformed Hermes export JSONL at line \d+$/.test(error?.message) ||
      /^Unsupported Hermes export schema at line \d+$/.test(error?.message) ||
      /^Hermes export line exceeds \d+ bytes$/.test(error?.message)
    ) throw error;
    throw new Error("Hermes session export failed");
  }

  let stderrStatus;
  let completion;
  try {
    [stderrStatus, completion] = await Promise.all([stderrPromise, result.completed]);
  } catch {
    throw new Error("Hermes session export failed");
  }
  if (stderrStatus.failed || completion.code !== 0) {
    throw new Error("Hermes session export failed");
  }
  return buildLiveReviewWindow(records, context);
}

export function createHermesCommandExecutor({
  spawnProcess = spawn,
  hermesHome,
  hermesProfile,
} = {}) {
  assertHermesSourceBoundary(hermesHome, hermesProfile);
  return async function executeCommand(binary, args) {
    const spawnOptions = { stdio: ["ignore", "pipe", "pipe"] };
    if (hermesHome) spawnOptions.env = { ...process.env, HERMES_HOME: hermesHome };
    const commandArgs = hermesProfile ? ["--profile", hermesProfile, ...args] : args;
    if (hermesProfile) {
      spawnOptions.env = { ...process.env };
      delete spawnOptions.env.HERMES_HOME;
    }
    const child = spawnProcess(binary, commandArgs, spawnOptions);
    const completed = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    return {
      stdout: child.stdout,
      stderr: child.stderr,
      completed,
      cancel() {
        child.kill("SIGTERM");
      },
    };
  };
}

export async function probeHermesCompatibility({
  binary = "hermes",
  executeCommand = createHermesCommandExecutor(),
} = {}) {
  const versionOutput = await checkedText(await executeCommand(binary, ["--version"]), "Hermes version probe");
  const match = versionOutput.match(/Hermes Agent v(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[1]) !== 0 || Number(match[2]) !== 11) {
    throw new Error("Unsupported Hermes version; expected v0.11.x");
  }

  const help = await checkedText(
    await executeCommand(binary, ["sessions", "export", "--help"]),
    "Hermes exporter capability probe",
  );
  if (!help.includes("--source") || !help.includes("--session-id") || !help.includes("use - for stdout")) {
    throw new Error("Hermes session exporter does not expose the required stdout contract");
  }

  return { version: `${match[1]}.${match[2]}.${match[3]}`, exporter: true };
}

export function buildHermesReviewWindow({
  sessions,
  sourceId,
  reviewDay,
  timeZone,
  state,
  excludeSessionId,
}) {
  const context = { sourceId, reviewDay, timeZone, state, excludeSessionId };
  const records = sessions.map((session, index) => {
    try {
      return retainLiveSession(session, context, index + 1);
    } catch (error) {
      if (error instanceof HermesSchemaError) {
        throw new Error(`Unsupported Hermes export schema at line ${index + 1}`);
      }
      throw error;
    }
  });
  return buildLiveReviewWindow(records, context);
}

export async function collectHermesWindow({
  sourceId,
  reviewDay,
  timeZone,
  state,
  binary = "hermes",
  executeCommand,
  spawnProcess,
  hermesHome,
  hermesProfile,
  maxExportLineBytes = 8 * 1024 * 1024,
  excludeSessionId,
}) {
  assertHermesSourceBoundary(hermesHome, hermesProfile);
  const commandExecutor = executeCommand ?? createHermesCommandExecutor({
    spawnProcess,
    hermesHome,
    hermesProfile,
  });
  await probeHermesCompatibility({ binary, executeCommand: commandExecutor });
  const result = await commandExecutor(binary, ["sessions", "export", "-"]);
  return readExportWindow(result, maxExportLineBytes, {
    sourceId,
    reviewDay,
    timeZone,
    state,
    excludeSessionId,
  });
}
