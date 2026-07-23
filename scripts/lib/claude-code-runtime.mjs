export const CLAUDE_AGENT_SDK_PACKAGE = "@anthropic-ai/claude-agent-sdk";
export const CLAUDE_AGENT_SDK_VERSION = "0.3.217";
export const CLAUDE_AGENT_SDK_PIN = `${CLAUDE_AGENT_SDK_PACKAGE}@${CLAUDE_AGENT_SDK_VERSION}`;

export async function loadClaudeCodeRuntime({ moduleLoader }) {
  const loaded = await moduleLoader(CLAUDE_AGENT_SDK_PACKAGE);
  if (loaded?.version !== CLAUDE_AGENT_SDK_VERSION) {
    throw new Error(`Unsupported Claude Agent SDK version; expected ${CLAUDE_AGENT_SDK_VERSION}`);
  }
  if (
    typeof loaded.module?.listSessions !== "function" ||
    typeof loaded.module?.getSessionMessages !== "function"
  ) {
    throw new Error("Claude Agent SDK does not expose the required session capabilities");
  }
  return {
    sdk: loaded.module,
    compatibility: {
      packageName: CLAUDE_AGENT_SDK_PACKAGE,
      packagePin: CLAUDE_AGENT_SDK_PIN,
      sdkVersion: loaded.version,
      capabilities: { listSessions: true, getSessionMessages: true },
    },
  };
}

async function allPages(reader, pageSize) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await reader({ limit: pageSize, offset });
    if (!Array.isArray(page)) throw new Error("Claude Agent SDK returned a malformed page");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function provenanceOf(sessionId, messages) {
  if (messages.length === 0) return "uncertain";
  if (messages.some((message) => typeof message?.parent_tool_use_id === "string")) {
    return "subagent";
  }
  const documentedPrimaryShape = messages.every((message) => (
    ["user", "assistant"].includes(message?.type) &&
    typeof message.uuid === "string" &&
    message.uuid &&
    message.session_id === sessionId &&
    message.parent_tool_use_id === null
  ));
  return documentedPrimaryShape ? "primary" : "uncertain";
}

export async function reconcileClaudeCodeRuntime({
  sdk,
  events,
  coverage,
  excludeSessionId,
  pageSize = 100,
}) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new TypeError("pageSize must be positive");
  const listed = await allPages(
    (options) => sdk.listSessions(options),
    pageSize,
  );
  const sessions = new Map();
  for (const session of listed) {
    if (
      typeof session?.sessionId !== "string" ||
      !session.sessionId ||
      session.sessionId === excludeSessionId
    ) continue;
    sessions.set(session.sessionId, session);
  }

  const inventory = [];
  const sdkMessageCounts = new Map();
  for (const sessionId of [...sessions.keys()].sort()) {
    let provenance = "uncertain";
    try {
      const messages = await allPages(
        ({ limit, offset }) => sdk.getSessionMessages(sessionId, { limit, offset }),
        pageSize,
      );
      provenance = provenanceOf(sessionId, messages);
      sdkMessageCounts.set(sessionId, messages.length);
    } catch {
      // Reconciliation stays fail-closed; raw SDK errors and message payloads are not returned.
    }
    inventory.push({ sessionId, provenance });
  }

  const inventoryBySession = new Map(inventory.map((session) => [session.sessionId, session]));
  const capturedCounts = new Map();
  for (const event of events ?? []) {
    if (!event?.sessionId || event.sessionId === excludeSessionId) continue;
    capturedCounts.set(event.sessionId, (capturedCounts.get(event.sessionId) ?? 0) + 1);
  }
  const reconciliation = [...capturedCounts].every(([sessionId, capturedCount]) => (
    inventoryBySession.has(sessionId) &&
    inventoryBySession.get(sessionId).provenance !== "uncertain" &&
    sdkMessageCounts.get(sessionId) === capturedCount
  )) ? "matched" : "mismatch";

  return {
    inventory,
    coverage: { ...coverage, reconciliation },
  };
}
