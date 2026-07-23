import { resolve } from "node:path";

export function parseCodexInstallerArguments(argv) {
  const values = { apply: false, repoScopedCredentialConfirmed: false };
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") values.apply = true;
    else if (argument === "--dry-run") dryRun = true;
    else if (argument === "--confirm-repo-scope") values.repoScopedCredentialConfirmed = true;
    else if (argument.startsWith("--")) {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`${argument} requires a value`);
      values[argument.slice(2)] = next;
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }
  if (values.apply && dryRun) throw new Error("Choose either --apply or --dry-run");
  return values;
}

async function checkedCommand(command, binary, args, options, label) {
  const result = await command(binary, args, options);
  if (result.code !== 0) throw new Error(`${label} failed`);
  return String(result.stdout ?? "");
}

function parseCliVersion(output) {
  const match = output.match(/codex-cli\s+(\d+\.\d+\.\d+)/);
  if (!match) throw new Error("Unable to determine Codex CLI version");
  return match[1];
}

export async function planCodexInstallation({
  repositoryDir,
  binary = "codex",
  command,
  files,
  timeZone,
  sourceId = "codex-local",
  sourceLabel = "Codex / Local",
  repoScopedCredentialConfirmed,
}) {
  if (!repositoryDir) throw new Error("repositoryDir is required");
  if (repoScopedCredentialConfirmed !== true) {
    throw new Error(
      "Codex setup requires the operator to confirm the GitHub credential is scoped only to the Publication Repository",
    );
  }
  const cwd = resolve(repositoryDir);
  const reviewPrompt = `Use the $codex-review skill to run the complete daily review for the Publication Repository at ${cwd}. Never merge the pull request.`;
  const blogPreferences = JSON.parse(
    await files.readFile(resolve(cwd, "src/blog.config.json"), "utf8"),
  );
  const reviewSkill = await files.readFile(
    resolve(cwd, ".agents/skills/codex-review/SKILL.md"),
    "utf8",
  );
  if (!reviewSkill.includes("CODEX_THREAD_ID") || !reviewSkill.includes("--exclude-thread-id")) {
    throw new Error("Codex Review Skill does not enforce current-thread self-exclusion");
  }

  const cliVersion = parseCliVersion(await checkedCommand(
    command,
    binary,
    ["--version"],
    { cwd },
    "Codex version probe",
  ));
  await checkedCommand(command, binary, ["login", "status"], { cwd }, "Codex authentication probe");
  const appServerHelp = await checkedCommand(
    command,
    binary,
    ["app-server", "--help"],
    { cwd },
    "Codex app-server capability probe",
  );
  if (!appServerHelp.includes("Run the app server") || !appServerHelp.includes("--listen")) {
    throw new Error("Codex app-server does not expose the required local protocol");
  }

  const dirty = await checkedCommand(
    command,
    "git",
    ["status", "--porcelain"],
    { cwd },
    "Git status probe",
  );
  if (dirty.trim()) throw new Error("Commit the selected blog configuration before installing Codex");
  await checkedCommand(
    command,
    "git",
    ["check-ignore", ".agent-blog"],
    { cwd },
    "Private Agent Blog state ignore probe",
  );
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
  await checkedCommand(command, "gh", ["auth", "status"], { cwd }, "GitHub authentication probe");
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
    throw new Error("GitHub repository permission could not be verified");
  }
  if (!new Set(["WRITE", "MAINTAIN", "ADMIN"]).has(viewerPermission)) {
    throw new Error("Publication Repository write permission is required");
  }

  return {
    status: "dry-run",
    repositoryDir: cwd,
    compatibility: { cliVersion, appServer: true },
    authentication: { codex: true },
    repositoryAccess: {
      git: true,
      github: true,
      privateStateIgnored: true,
      viewerPermission,
      repoScopedCredentialConfirmed: true,
    },
    source: { id: sourceId, label: sourceLabel, platform: "codex" },
    selfExclusion: {
      required: true,
      environmentVariable: "CODEX_THREAD_ID",
      collectOption: "--exclude-thread-id",
    },
    timeZone,
    blog: { theme: blogPreferences.theme, language: blogPreferences.language },
    scheduledTask: {
      schedule: `00:15 ${timeZone}`,
      mode: "local checkout",
      workingDirectory: cwd,
      prompt: reviewPrompt,
      installAutomatically: false,
    },
  };
}

export async function applyCodexInstallation(options) {
  if (options?.apply !== true) {
    throw new Error("Codex installation requires explicit --apply authorization");
  }
  const plan = await planCodexInstallation(options);
  const configPath = resolve(plan.repositoryDir, ".agent-blog/config.json");
  let existing = {};
  try {
    existing = JSON.parse(await options.files.readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("Existing Agent Blog config is not valid JSON");
  }
  const config = {
    ...existing,
    sourceId: plan.source.id,
    sourceLabel: plan.source.label,
    platform: "codex",
    timeZone: plan.timeZone,
    privateTerms: existing.privateTerms ?? options.privateTerms ?? [],
    baseBranch: existing.baseBranch ?? options.baseBranch ?? "main",
    theme: plan.blog.theme,
    language: plan.blog.language,
  };
  if (options.binary && options.binary !== "codex") config.codexBinary = options.binary;

  const privateDir = resolve(plan.repositoryDir, ".agent-blog");
  await options.files.mkdir(privateDir, { recursive: true });
  await options.files.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await options.files.chmod(configPath, 0o600);
  return { ...plan, status: "configured" };
}
