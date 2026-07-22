export const PI_SDK_PACKAGE = "@earendil-works/pi-coding-agent";
export const PI_SDK_VERSION = "0.81.1";
export const PI_SDK_PIN = `${PI_SDK_PACKAGE}@${PI_SDK_VERSION}`;

const SUPPORTED_SESSION_VERSION = 3;
export const PI_COMPATIBILITY_MATRIX = Object.freeze({
  cli: "0.81.x",
  sdk: PI_SDK_VERSION,
  session: SUPPORTED_SESSION_VERSION,
});

export class PiSdkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PiSdkError";
    this.code = code;
  }
}

export function validatePiLiveConfig(config) {
  const provenance = config?.piProvenance;
  const security = config?.piSecurity;
  if (
    typeof config?.piSessionDir !== "string" ||
    !config.piSessionDir.trim() ||
    !provenance ||
    provenance.noPersistentSubagents !== true ||
    !Array.isArray(provenance.excludedSessionIds) ||
    provenance.excludedSessionIds.some((value) => typeof value !== "string" || !value) ||
    !security ||
    security.repoScopedCredentialConfirmed !== true ||
    security.piAuthReadyConfirmed !== true ||
    security.credentialValuesRead !== false
  ) {
    throw new PiSdkError(
      "incomplete-config",
      "Pi Agent Source configuration is incomplete",
    );
  }
}

export async function loadPiSdkRuntime({
  moduleLoader = (specifier) => import(specifier),
  provenancePolicy = {},
} = {}) {
  let module;
  try {
    module = await moduleLoader(PI_SDK_PACKAGE);
  } catch {
    throw new PiSdkError("sdk-load-failed", "The supported Pi SDK could not be loaded");
  }
  if (
    module?.VERSION !== PI_SDK_VERSION ||
    module?.CURRENT_SESSION_VERSION !== SUPPORTED_SESSION_VERSION ||
    typeof module?.SessionManager?.listAll !== "function" ||
    typeof module?.SessionManager?.open !== "function"
  ) {
    throw new PiSdkError("unsupported-sdk", "The installed Pi SDK is not supported");
  }
  const excludedSessionIds = new Set(
    Array.isArray(provenancePolicy.excludedSessionIds)
      ? provenancePolicy.excludedSessionIds.filter((value) => typeof value === "string" && value)
      : [],
  );
  return {
    SessionManager: module.SessionManager,
    classifySession(sessionId) {
      if (excludedSessionIds.has(sessionId)) return "subagent";
      if (provenancePolicy.noPersistentSubagents === true) return "primary";
      return "unknown";
    },
    compatibility: {
      packageName: PI_SDK_PACKAGE,
      packagePin: PI_SDK_PIN,
      sdkVersion: module.VERSION,
      sessionVersion: module.CURRENT_SESSION_VERSION,
      sessionManager: { listAll: true, open: true },
      matrix: PI_COMPATIBILITY_MATRIX,
    },
  };
}
