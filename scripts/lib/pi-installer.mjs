import { resolve } from "node:path";

import { loadPiSdkRuntime } from "./pi-sdk.mjs";

const REVIEW_PROMPT = "Use the pi-review skill to run the complete Agent Blog daily review. Never merge the pull request.";

export class PiInstallerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PiInstallerError";
    this.code = code;
  }
}

async function checkedCommand(command, binary, args, options, label) {
  const result = await command(binary, args, options);
  if (result.code !== 0) throw new Error(`${label} failed`);
  return String(result.stdout ?? "");
}

function parseCliCompatibility(versionOutput, helpOutput) {
  const match = versionOutput.match(/(?:^|\s)(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
  if (!match || Number(match[1]) !== 0 || Number(match[2]) !== 81) {
    throw new PiInstallerError("unsupported-cli", "Unsupported Pi CLI version; expected 0.81.x");
  }
  if (
    !helpOutput.includes("--print") ||
    !helpOutput.includes("--no-session") ||
    !helpOutput.includes("--skill") ||
    !helpOutput.includes("--offline") ||
    !helpOutput.includes("--list-models")
  ) {
    throw new PiInstallerError(
      "unsupported-cli",
      "Pi CLI does not expose the required one-shot skill contract",
    );
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export async function planPiInstallation({
  repositoryDir,
  piAgentDir,
  binary = "pi",
  moduleLoader,
  command,
  fs,
  timeZone,
  sourceId = "pi-local",
  sourceLabel = "Pi / Local",
  repoScopedCredentialConfirmed,
  piAuthReadyConfirmed,
}) {
  if (!repositoryDir) throw new Error("repositoryDir is required");
  if (!piAgentDir) throw new Error("piAgentDir is required");
  if (repoScopedCredentialConfirmed !== true) {
    throw new Error(
      "Pi setup requires the operator to confirm the GitHub credential is scoped only to the Publication Repository",
    );
  }
  if (piAuthReadyConfirmed !== true) {
    throw new Error(
      "Pi setup requires the operator to confirm Pi authentication is configured and working",
    );
  }
  const cwd = resolve(repositoryDir);
  const blogPreferences = JSON.parse(
    await fs.readFile(resolve(cwd, "src/blog.config.json"), "utf8"),
  );
  const sdk = await loadPiSdkRuntime({ moduleLoader });
  const versionOutput = await checkedCommand(
    command,
    binary,
    ["--version"],
    { cwd },
    "Pi version probe",
  );
  const helpOutput = await checkedCommand(
    command,
    binary,
    ["--help"],
    { cwd },
    "Pi capability probe",
  );
  const cliVersion = parseCliCompatibility(versionOutput, helpOutput);

  const dirty = await checkedCommand(command, "git", ["status", "--porcelain"], { cwd }, "Git status probe");
  if (dirty.trim()) throw new Error("Commit the selected blog configuration before installing Pi");
  await checkedCommand(
    command,
    "git",
    ["check-ignore", ".agent-blog"],
    { cwd },
    "Private Agent Blog state ignore probe",
  );
  const remote = await checkedCommand(command, "git", ["remote", "get-url", "origin"], { cwd }, "Git origin probe");
  if (!/github\.com[:/]/.test(remote)) {
    throw new Error("Publication Repository origin must be on GitHub");
  }
  const permissionOutput = await checkedCommand(
    command,
    "gh",
    ["repo", "view", "--json", "viewerPermission"],
    { cwd },
    "GitHub repository access probe",
  );
  let viewerPermission;
  try {
    viewerPermission = JSON.parse(permissionOutput).viewerPermission;
  } catch {
    throw new PiInstallerError(
      "repository-write-required",
      "GitHub repository permission could not be verified",
    );
  }
  if (!new Set(["WRITE", "MAINTAIN", "ADMIN"]).has(viewerPermission)) {
    throw new PiInstallerError(
      "repository-write-required",
      "Publication Repository write permission is required",
    );
  }

  const worker = {
    binary,
    args: [
      "-p",
      "--no-session",
      "--skill",
      resolve(cwd, ".agents/skills/pi-review/SKILL.md"),
      REVIEW_PROMPT,
    ],
    cwd,
    oneShot: true,
    persistentSession: false,
  };

  return {
    status: "dry-run",
    repositoryDir: cwd,
    compatibility: { ...sdk.compatibility, cliVersion },
    repositoryAccess: {
      git: true,
      github: true,
      privateStateIgnored: true,
      viewerPermission,
      repoScopedCredentialConfirmed: repoScopedCredentialConfirmed === true,
    },
    piAccess: {
      capabilityProbe: "pi --help",
      supportsOfflineModelStatus: true,
      piAuthReadyConfirmed: piAuthReadyConfirmed === true,
      credentialValuesRead: false,
    },
    source: {
      id: sourceId,
      label: sourceLabel,
      platform: "pi",
      boundary: { type: "agent-dir", value: piAgentDir },
    },
    timeZone,
    blog: { theme: blogPreferences.theme, language: blogPreferences.language },
    lifecycle: {
      manual: { reviewCommand: ["npm", "run", "review", "--", "manual"] },
      scheduled: { reviewCommand: ["npm", "run", "review", "--", "collect"] },
      worker,
    },
    schedules: {
      osScheduler: {
        cron: "15 0 * * *",
        timeZone,
        workingDirectory: cwd,
        command: worker,
        installAutomatically: false,
      },
    },
  };
}

export async function applyPiInstallation(options) {
  if (options?.apply !== true) {
    throw new Error("Pi installation requires explicit --apply authorization");
  }
  if (options.noPersistentSubagents !== true) {
    throw new Error("Pi installation requires the operator to confirm that this Pi Agent Source has no persistent subagents");
  }
  if (options.scheduler && options.scheduler !== "manual" && options.scheduler !== "os") {
    throw new Error("scheduler must be manual or os");
  }
  const plan = await planPiInstallation(options);
  const configPath = resolve(plan.repositoryDir, ".agent-blog/config.json");
  let existing = {};
  try {
    existing = JSON.parse(await options.fs.readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Existing Agent Blog config is not valid JSON");
  }
  const config = {
    ...existing,
    privateTerms: existing.privateTerms ?? options.privateTerms ?? [],
    baseBranch: existing.baseBranch ?? options.baseBranch ?? "main",
    sourceId: plan.source.id,
    sourceLabel: plan.source.label,
    platform: "pi",
    timeZone: plan.timeZone,
    theme: plan.blog.theme,
    language: plan.blog.language,
    piAgentDir: plan.source.boundary.value,
    piSessionDir: resolve(plan.source.boundary.value, "sessions"),
    piProvenance: {
      noPersistentSubagents: options.noPersistentSubagents === true,
      excludedSessionIds: [...new Set(options.excludedSessionIds ?? [])],
    },
    piSecurity: {
      repoScopedCredentialConfirmed: true,
      piAuthReadyConfirmed: true,
      credentialValuesRead: false,
    },
  };
  const privateDir = resolve(plan.repositoryDir, ".agent-blog");
  await options.fs.mkdir(privateDir, { recursive: true });
  await options.fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await options.fs.chmod(configPath, 0o600);
  let schedule = { type: "manual", applied: false };
  if (options.scheduler === "os") {
    schedule = {
      type: "os-scheduler",
      applied: false,
      descriptor: plan.schedules.osScheduler,
    };
  }
  return { ...plan, status: "configured", schedule };
}
