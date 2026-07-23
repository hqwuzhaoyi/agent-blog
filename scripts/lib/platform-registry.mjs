import {
  buildClaudeCodeReviewWindowFromFixture,
  collectClaudeCodeLiveWindow,
} from "./claude-code-collector.mjs";
import {
  CLAUDE_AGENT_SDK_PACKAGE,
  CLAUDE_AGENT_SDK_VERSION,
} from "./claude-code-runtime.mjs";
import { buildCodexReviewWindow, collectCodexWindow } from "./codex-app-server.mjs";
import { buildHermesReviewWindow, collectHermesWindow } from "./hermes-cli.mjs";
import { buildReviewWindowFromSessions, collectGatewayWindow } from "./openclaw-gateway.mjs";
import { buildPiReviewWindowFromSessions, collectPiReviewWindow } from "./pi-review-window.mjs";
import { loadPiSdkRuntime, validatePiLiveConfig } from "./pi-sdk.mjs";

const registry = {
  openclaw: {
    platform: Object.freeze({
      id: "openclaw",
      label: "OpenClaw",
      defaultSourceLabel: "OpenClaw / Gateway 01",
    }),
    collectLive({ config, ...input }) {
      return collectGatewayWindow({
        ...input,
        binary: config.openclawBinary || "openclaw",
      });
    },
    collectFixture({ fixture, config: _config, ...input }) {
      return buildReviewWindowFromSessions({ sessions: fixture.sessions ?? [], ...input });
    },
  },
  codex: {
    platform: Object.freeze({
      id: "codex",
      label: "Codex",
      defaultSourceLabel: "Codex / Local",
    }),
    collectLive({ config, ...input }) {
      return collectCodexWindow({
        ...input,
        binary: config.codexBinary || "codex",
        excludeThreadId: input.excludeThreadId ?? process.env.CODEX_THREAD_ID,
      });
    },
    collectFixture({ fixture, config: _config, ...input }) {
      return buildCodexReviewWindow({ threads: fixture.threads ?? [], ...input });
    },
  },
  hermes: {
    platform: Object.freeze({
      id: "hermes",
      label: "Hermes",
      defaultSourceLabel: "Hermes / Local",
    }),
    collectLive({ config, ...input }) {
      return collectHermesWindow({
        ...input,
        binary: config.hermesBinary || "hermes",
        hermesHome: config.hermesHome,
        hermesProfile: config.hermesProfile,
        excludeSessionId: config.reviewSessionId || process.env.HERMES_SESSION_ID,
      });
    },
    collectFixture({ fixture, config: _config, ...input }) {
      return buildHermesReviewWindow({ sessions: fixture.sessions ?? [], ...input });
    },
  },
  pi: {
    platform: Object.freeze({
      id: "pi",
      label: "Pi",
      defaultSourceLabel: "Pi / Local",
    }),
    async collectLive({ config, ...input }) {
      validatePiLiveConfig(config);
      const sdk = await loadPiSdkRuntime({ provenancePolicy: config.piProvenance });
      return collectPiReviewWindow({
        ...input,
        sdk,
        sessionDir: config.piSessionDir,
        excludeSessionId: config.reviewSessionId,
      });
    },
    collectFixture({ fixture, config: _config, ...input }) {
      return buildPiReviewWindowFromSessions({ sessions: fixture.piSessions ?? [], ...input });
    },
  },
  "claude-code": {
    platform: Object.freeze({
      id: "claude-code",
      label: "Claude Code",
      defaultSourceLabel: "Claude Code / Local",
    }),
    collectLive({ config, ...input }) {
      return collectClaudeCodeLiveWindow({
        ...input,
        journalPath: config.claudeCode?.journalPath,
        coverageStartedAt: config.claudeCode?.coverage?.startedAt,
        excludeSessionId: config.reviewSessionId || process.env.CLAUDE_CODE_EXCLUDE_SESSION_ID,
        moduleLoader: async (specifier) => {
          if (specifier !== CLAUDE_AGENT_SDK_PACKAGE) throw new Error("Unexpected SDK package");
          return {
            version: CLAUDE_AGENT_SDK_VERSION,
            module: await import(CLAUDE_AGENT_SDK_PACKAGE),
          };
        },
      });
    },
    collectFixture({ fixture, config: _config, ...input }) {
      return buildClaudeCodeReviewWindowFromFixture({
        fixture: fixture.claudeCode ?? {},
        ...input,
      });
    },
  },
};

export function resolveAgentPlatform(config) {
  const registration = registry[config?.platform];
  if (!registration) throw new Error(`Unsupported Agent Platform: ${config?.platform ?? "missing"}`);
  return registration.platform;
}

export function selectPlatformCollection({ config, fixture }) {
  const registration = registry[config?.platform];
  const platform = resolveAgentPlatform(config);

  const mode = fixture === undefined ? "live" : "fixture";
  if (mode === "live" && platform.id === "pi") validatePiLiveConfig(config);
  return {
    platform,
    mode,
    collect: mode === "live" ? registration.collectLive : registration.collectFixture,
  };
}
