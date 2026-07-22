import { resolve } from "node:path";

import { CLAUDE_CODE_REVIEW_WORKER_ENV } from "./claude-code-capture.mjs";
import { loadClaudeCodeRuntime } from "./claude-code-runtime.mjs";

const MINIMUM_CLI_VERSION = [2, 1, 166];

async function checkedCommand(command, binary, args, options, label) {
  const result = await command(binary, args, options);
  if (result.code !== 0) throw new Error(`${label} failed`);
  return String(result.stdout ?? "");
}

async function checkedStatus(command, binary, args, options, label) {
  const result = await command(binary, args, options);
  if (result.code !== 0) throw new Error(`${label} failed`);
}

function parseCliVersion(output) {
  const match = output.match(/(?:^|\s)(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
  if (!match) throw new Error("Unable to determine Claude Code version");
  const version = match.slice(1).map(Number);
  for (let index = 0; index < MINIMUM_CLI_VERSION.length; index += 1) {
    if (version[index] > MINIMUM_CLI_VERSION[index]) break;
    if (version[index] < MINIMUM_CLI_VERSION[index]) {
      throw new Error("Unsupported Claude Code version; MessageDisplay requires 2.1.166 or newer");
    }
  }
  return version.join(".");
}

function schedulePlan({ scheduler = "desktop", repositoryDir, timeZone, binary }) {
  const environment = { [CLAUDE_CODE_REVIEW_WORKER_ENV]: "1" };
  if (scheduler === "desktop") {
    return {
      type: "desktop-local-task",
      at: "00:15",
      timeZone,
      workingDirectory: repositoryDir,
      worktreeIsolation: false,
      environment,
      installAutomatically: false,
      requiresAppOpen: true,
      requiresMachineAwake: true,
    };
  }
  if (scheduler === "os") {
    return {
      type: "os-scheduler",
      at: "00:15",
      timeZone,
      workingDirectory: repositoryDir,
      command: [binary, "-p", "/claude-code-review"],
      environment,
      generatedOnly: true,
      installAutomatically: false,
    };
  }
  if (scheduler === "manual") {
    return {
      type: "manual",
      command: [binary, "-p", "/claude-code-review"],
      environment,
      installAutomatically: false,
    };
  }
  throw new Error("scheduler must be desktop, os, or manual");
}

async function readOptionalJson(files, path, label) {
  try {
    return JSON.parse(await files.readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`${label} is not valid JSON`);
  }
}

function mergeCaptureHook(settings, eventName, command) {
  const hooks = settings.hooks ?? {};
  const existing = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
  const alreadyInstalled = existing.some((group) => (
    Array.isArray(group?.hooks) && group.hooks.some((hook) => hook?.command === command)
  ));
  return {
    ...settings,
    hooks: {
      ...hooks,
      [eventName]: alreadyInstalled ? existing : [
        ...existing,
        {
          matcher: "",
          hooks: [{ type: "command", command }],
        },
      ],
    },
  };
}

export async function planClaudeCodeInstallation({
  repositoryDir,
  binary = "claude",
  moduleLoader,
  command,
  files,
  timeZone,
  sourceId = "claude-code-local",
  sourceLabel = "Claude Code / Local",
  retentionDays = 30,
  scheduler = "desktop",
  repositoryCredentialConfirmed = false,
}) {
  if (!repositoryDir) throw new Error("repositoryDir is required");
  if (repositoryCredentialConfirmed !== true) {
    throw new Error("Claude Code setup requires repository-scoped credential confirmation");
  }
  const cwd = resolve(repositoryDir);
  const blogPreferences = JSON.parse(
    await files.readFile(resolve(cwd, "src/blog.config.json"), "utf8"),
  );
  await files.readFile(resolve(cwd, ".claude/skills/claude-code-review/SKILL.md"), "utf8");

  const cliVersion = parseCliVersion(await checkedCommand(
    command,
    binary,
    ["--version"],
    { cwd },
    "Claude Code version probe",
  ));
  await checkedStatus(
    command,
    binary,
    ["auth", "status"],
    { cwd },
    "Claude Code authentication capability probe",
  );

  const runtime = await loadClaudeCodeRuntime({ moduleLoader });
  await runtime.sdk.listSessions({ limit: 1 });

  const remote = await checkedCommand(
    command,
    "git",
    ["remote", "get-url", "origin"],
    { cwd },
    "Git origin probe",
  );
  if (!/github\.com[:/]/.test(remote)) {
    throw new Error("Publication Repository origin must be on GitHub");
  }
  await checkedStatus(
    command,
    "git",
    ["check-ignore", "-q", ".agent-blog"],
    { cwd },
    "Private state ignore probe",
  );
  await checkedStatus(command, "gh", ["auth", "status"], { cwd }, "GitHub authentication probe");
  const repositoryOutput = await checkedCommand(
    command,
    "gh",
    ["repo", "view", "--json", "nameWithOwner,viewerPermission"],
    { cwd },
    "GitHub repository access probe",
  );
  let repository;
  try {
    repository = JSON.parse(repositoryOutput);
  } catch {
    throw new Error("GitHub repository access probe returned malformed JSON");
  }
  if (!repository?.nameWithOwner || !["ADMIN", "MAINTAIN", "WRITE"].includes(
    repository.viewerPermission,
  )) {
    throw new Error("GitHub repository write permission is required");
  }

  return {
    status: "dry-run",
    repositoryDir: cwd,
    compatibility: {
      cliVersion,
      messageDisplay: true,
      ...runtime.compatibility,
    },
    authentication: { claudeCode: true, probe: "exit-status-only" },
    repositoryAccess: {
      git: true,
      github: true,
      scope: "operator-confirmed-repository-only",
      viewerPermission: repository.viewerPermission,
      operatorConfirmed: true,
    },
    source: { id: sourceId, label: sourceLabel, platform: "claude-code" },
    blog: { theme: blogPreferences.theme, language: blogPreferences.language },
    hooks: {
      events: ["UserPromptSubmit", "MessageDisplay"],
      captureOnly: true,
      reviewWorkerEnv: CLAUDE_CODE_REVIEW_WORKER_ENV,
      command: `${CLAUDE_CODE_REVIEW_WORKER_ENV}=\"\${${CLAUDE_CODE_REVIEW_WORKER_ENV}:-0}\" node \"$CLAUDE_PROJECT_DIR/scripts/install-claude-code.mjs\" --capture-hook`,
    },
    skill: {
      path: ".claude/skills/claude-code-review/SKILL.md",
      reads: [".agent-blog/review-window.json"],
    },
    coverage: { startsOnApply: true, historicalBackfill: false },
    retention: { journalDays: retentionDays },
    privateState: { directory: ".agent-blog", fileMode: "0600" },
    schedule: schedulePlan({ scheduler, repositoryDir: cwd, timeZone, binary }),
  };
}

export async function applyClaudeCodeInstallation(options) {
  if (options?.apply !== true) {
    throw new Error("Claude Code installation requires explicit --apply authorization");
  }
  const plan = await planClaudeCodeInstallation(options);
  const { files, binary = "claude", now = () => new Date() } = options;
  const settingsPath = resolve(plan.repositoryDir, ".claude/settings.json");
  const configPath = resolve(plan.repositoryDir, ".agent-blog/config.json");
  const existingSettings = await readOptionalJson(
    files,
    settingsPath,
    "Existing Claude Code project settings",
  );
  const existingConfig = await readOptionalJson(
    files,
    configPath,
    "Existing Agent Blog config",
  );
  let settings = mergeCaptureHook(existingSettings, "UserPromptSubmit", plan.hooks.command);
  settings = mergeCaptureHook(settings, "MessageDisplay", plan.hooks.command);
  const savedStartedAt = existingConfig.claudeCode?.coverage?.startedAt;
  const startedAt = typeof savedStartedAt === "string" && Number.isFinite(Date.parse(savedStartedAt))
    ? savedStartedAt
    : new Date(now()).toISOString();
  const config = {
    ...existingConfig,
    sourceId: plan.source.id,
    sourceLabel: plan.source.label,
    platform: "claude-code",
    timeZone: plan.schedule.timeZone ?? options.timeZone,
    theme: plan.blog.theme,
    language: plan.blog.language,
    claudeCode: {
      ...existingConfig.claudeCode,
      binary,
      sdkPackagePin: plan.compatibility.packagePin,
      journalPath: ".agent-blog/claude-visible-events.json",
      repositoryAccess: {
        viewerPermission: plan.repositoryAccess.viewerPermission,
        credentialScopeConfirmedByOperator: true,
      },
      coverage: {
        ...existingConfig.claudeCode?.coverage,
        startedAt,
        historicalBackfill: false,
      },
      retention: {
        ...existingConfig.claudeCode?.retention,
        ...plan.retention,
      },
    },
  };

  await files.mkdir(resolve(plan.repositoryDir, ".claude"), { recursive: true });
  await files.mkdir(resolve(plan.repositoryDir, ".agent-blog"), { recursive: true, mode: 0o700 });
  await files.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  await files.chmod(settingsPath, 0o600);
  await files.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await files.chmod(configPath, 0o600);

  return {
    ...plan,
    status: "configured",
    coverage: { ...plan.coverage, startedAt },
  };
}
