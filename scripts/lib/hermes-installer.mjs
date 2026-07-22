import { basename, resolve } from "node:path";

const JOB_NAME = "Agent Blog daily review";
const MANUAL_REVIEW_PROMPT = "Use the agent-blog-review skill for this Publication Repository. This is an operator-requested manual run: enter the npm run review -- manual lifecycle, then submit material work or record no-update, and never merge a pull request.";
const SCHEDULED_REVIEW_PROMPT = "Use the agent-blog-review skill for this Publication Repository. Enter the npm run review -- collect lifecycle for the preceding Review Day, create or update a draft pull request only for material work, and never merge it.";

export function parseHermesInstallerArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--apply", "--dry-run", "--confirm-repo-scope"].includes(argument)) {
      values[argument.slice(2)] = true;
      continue;
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`${argument} requires a value`);
    values[argument.slice(2)] = next;
    index += 1;
  }
  if (values.apply && values["dry-run"]) {
    throw new Error("Choose either --apply or --dry-run");
  }
  return {
    apply: values.apply === true,
    repositoryDir: values.repo,
    hermesHome: values["hermes-home"],
    profile: values.profile,
    binary: values["hermes-binary"],
    timeZone: values.timezone,
    sourceId: values["source-id"],
    sourceLabel: values["source-label"],
    baseBranch: values["base-branch"],
    scheduler: values.scheduler,
    repositoryCredentialConfirmed: values["confirm-repo-scope"] === true,
    privateTerms: values["private-terms"]
      ? values["private-terms"].split(",").map((term) => term.trim()).filter(Boolean)
      : undefined,
  };
}

async function checkedCommand(command, binary, args, options, label) {
  const result = await command(binary, args, options);
  if (result.code !== 0) throw new Error(`${label} failed`);
  return String(result.stdout ?? "");
}

function parseCompatibility(versionOutput, exporterHelp) {
  const match = versionOutput.match(/Hermes Agent v(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[1]) !== 0 || Number(match[2]) !== 11) {
    throw new Error("Unsupported Hermes version; expected v0.11.x");
  }
  if (
    !exporterHelp.includes("--source") ||
    !exporterHelp.includes("--session-id") ||
    !exporterHelp.includes("use - for stdout")
  ) {
    throw new Error("Hermes session exporter does not expose the required stdout contract");
  }
  return { version: `${match[1]}.${match[2]}.${match[3]}`, exporter: true };
}

function defaultSource(name) {
  return { id: `hermes-${name}`, label: `Hermes / ${name}` };
}

function selectHermesSource({ hermesHome, profile, userHome }) {
  if (hermesHome && profile) throw new Error("Choose either hermesHome or profile, not both");
  if (profile) {
    if (!/^[A-Za-z0-9_-]+$/.test(profile)) throw new Error("Invalid Hermes profile name");
    if (!userHome) throw new Error("userHome is required when selecting a Hermes profile");
    return {
      name: profile,
      home: resolve(userHome, ".hermes/profiles", profile),
      boundary: { type: "profile", value: profile },
      commandPrefix: ["--profile", profile],
      commandOptions: {},
    };
  }
  if (!hermesHome) throw new Error("Choose a Hermes profile or home");
  return {
    name: basename(hermesHome) || "local",
    home: hermesHome,
    boundary: { type: "home", value: hermesHome },
    commandPrefix: [],
    commandOptions: { env: { HERMES_HOME: hermesHome } },
  };
}

export async function planHermesInstallation({
  repositoryDir,
  hermesHome,
  profile,
  userHome,
  binary = "hermes",
  command,
  files,
  timeZone,
  sourceId,
  sourceLabel,
  scheduler,
  repositoryCredentialConfirmed = false,
}) {
  if (!repositoryDir) throw new Error("repositoryDir is required");
  const cwd = resolve(repositoryDir);
  const selectedSource = selectHermesSource({ hermesHome, profile, userHome });
  const hermesCommandOptions = { cwd, ...selectedSource.commandOptions };
  const blogPreferences = JSON.parse(
    await files.readFile(resolve(cwd, "src/blog.config.json"), "utf8"),
  );
  const versionOutput = await checkedCommand(
    command,
    binary,
    [...selectedSource.commandPrefix, "--version"],
    hermesCommandOptions,
    "Hermes version probe",
  );
  const exporterHelp = await checkedCommand(
    command,
    binary,
    [...selectedSource.commandPrefix, "sessions", "export", "--help"],
    hermesCommandOptions,
    "Hermes exporter capability probe",
  );
  const compatibility = parseCompatibility(versionOutput, exporterHelp);
  await checkedCommand(
    command,
    binary,
    [...selectedSource.commandPrefix, "status", "--all"],
    hermesCommandOptions,
    "Hermes authentication status probe",
  );
  compatibility.authentication = "redacted-status-verified";

  const dirty = await checkedCommand(
    command,
    "git",
    ["status", "--porcelain"],
    { cwd },
    "Git status probe",
  );
  if (dirty.trim()) throw new Error("Commit the selected blog configuration before installing Hermes");
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
  const ignored = await checkedCommand(
    command,
    "git",
    ["check-ignore", ".agent-blog"],
    { cwd },
    "Agent Blog private-state ignore probe",
  );
  if (!ignored.trim()) throw new Error("Agent Blog private state must be ignored by Git");
  await checkedCommand(
    command,
    "gh",
    ["auth", "status", "--active", "--hostname", "github.com"],
    { cwd },
    "GitHub authentication probe",
  );
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
    throw new Error("GitHub repository permission probe returned malformed JSON");
  }
  if (!["ADMIN", "MAINTAIN", "WRITE"].includes(viewerPermission)) {
    throw new Error("GitHub repository write permission is required");
  }

  let scheduleSelection = { type: "manual", applied: false };
  if (scheduler === "hermes") {
    await checkedCommand(
      command,
      binary,
      [...selectedSource.commandPrefix, "cron", "status"],
      hermesCommandOptions,
      "Hermes cron status probe",
    );
    scheduleSelection = {
      type: "hermes-cron",
      gatewayScheduler: "available",
      applied: false,
    };
  } else if (scheduler === "os") {
    scheduleSelection = { type: "os-scheduler", applied: false };
  } else if (scheduler && scheduler !== "manual") {
    throw new Error("scheduler must be manual, hermes, or os");
  }

  const defaults = defaultSource(selectedSource.name);
  const buildWorker = (prompt) => ({
    binary,
    args: [
      ...selectedSource.commandPrefix,
      "chat",
      "--quiet",
      "--skills",
      "agent-blog-review",
      "--source",
      "tool",
      "-q",
      prompt,
    ],
    oneShot: true,
    persistentConfigChanges: false,
    source: "tool",
  });
  const manualWorker = buildWorker(MANUAL_REVIEW_PROMPT);
  const worker = buildWorker(SCHEDULED_REVIEW_PROMPT);
  return {
    status: "dry-run",
    repositoryDir: cwd,
    compatibility,
    repositoryAccess: {
      git: true,
      github: true,
      viewerPermission,
      privateStateIgnored: true,
      credentialScope: {
        operatorConfirmed: repositoryCredentialConfirmed === true,
        requiredForApply: true,
      },
    },
    source: {
      id: sourceId || defaults.id,
      label: sourceLabel || defaults.label,
      platform: "hermes",
      boundary: selectedSource.boundary,
    },
    timeZone,
    blog: { theme: blogPreferences.theme, language: blogPreferences.language },
    lifecycle: {
      manual: {
        reviewCommand: ["npm", "run", "review", "--", "manual"],
        worker: manualWorker,
      },
      scheduled: {
        reviewCommand: ["npm", "run", "review", "--", "collect"],
        worker,
      },
      worker,
    },
    schedules: {
      hermesCron: {
        name: JOB_NAME,
        cron: "15 0 * * *",
        timeZone,
        gatewayRequired: true,
        workingDirectory: cwd,
      },
      osScheduler: {
        timeZone,
        workingDirectory: cwd,
        workerCommand: worker,
        installAutomatically: false,
      },
    },
    scheduleSelection,
  };
}

export async function applyHermesInstallation(options) {
  if (options?.apply !== true) {
    throw new Error("Hermes installation requires explicit --apply authorization");
  }
  if (options.repositoryCredentialConfirmed !== true) {
    throw new Error("Hermes installation requires explicit --confirm-repo-scope confirmation");
  }
  const plan = await planHermesInstallation(options);
  const { files, binary = "hermes" } = options;
  const selectedSource = selectHermesSource(options);
  const config = {
    sourceId: plan.source.id,
    sourceLabel: plan.source.label,
    platform: "hermes",
    timeZone: plan.timeZone,
    privateTerms: options.privateTerms ?? [],
    baseBranch: options.baseBranch || "main",
    theme: plan.blog.theme,
    language: plan.blog.language,
    repositoryCredentialScopeConfirmed: true,
  };
  if (plan.source.boundary.type === "profile") config.hermesProfile = plan.source.boundary.value;
  else config.hermesHome = plan.source.boundary.value;
  if (binary !== "hermes") config.hermesBinary = binary;

  const privateDir = resolve(plan.repositoryDir, ".agent-blog");
  const configPath = resolve(privateDir, "config.json");
  await files.mkdir(privateDir, { recursive: true });
  await files.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await files.chmod(configPath, 0o600);

  const skill = await files.readFile(
    resolve(plan.repositoryDir, "skills/hermes-review/SKILL.md"),
    "utf8",
  );
  const skillDir = resolve(selectedSource.home, "skills/agent-blog-review");
  await files.mkdir(skillDir, { recursive: true });
  await files.writeFile(resolve(skillDir, "SKILL.md"), skill, { mode: 0o600 });

  let schedule = { type: "manual", applied: false };
  if (options.scheduler === "hermes") {
    const hermesOptions = { cwd: plan.repositoryDir, ...selectedSource.commandOptions };
    const cronList = await checkedCommand(
      options.command,
      binary,
      [...selectedSource.commandPrefix, "cron", "list", "--json"],
      hermesOptions,
      "Hermes cron list probe",
    );
    let payload;
    try {
      payload = JSON.parse(cronList);
    } catch {
      throw new Error("Hermes cron list returned malformed JSON");
    }
    const normalized = payload.result ?? payload;
    const jobs = Array.isArray(normalized) ? normalized : normalized.jobs ?? [];
    let job = jobs.find((candidate) => candidate.name === JOB_NAME);
    if (!job) {
      const created = await checkedCommand(
        options.command,
        binary,
        [
          ...selectedSource.commandPrefix,
          "cron",
          "create",
          "15 0 * * *",
          SCHEDULED_REVIEW_PROMPT,
          "--name",
          JOB_NAME,
          "--skill",
          "agent-blog-review",
          "--workdir",
          plan.repositoryDir,
          "--deliver",
          "local",
          "--json",
        ],
        hermesOptions,
        "Hermes cron creation",
      );
      try {
        const createdPayload = JSON.parse(created);
        job = createdPayload.result ?? createdPayload;
      } catch {
        throw new Error("Hermes cron creation returned malformed JSON");
      }
    }
    schedule = {
      type: "hermes-cron",
      applied: true,
      id: job.id ?? job.jobId,
      name: JOB_NAME,
    };
  } else if (options.scheduler === "os") {
    schedule = {
      type: "os-scheduler",
      applied: false,
      descriptor: plan.schedules.osScheduler,
    };
  }

  return { ...plan, status: "configured", schedule };
}
