import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function command(cwd, binary, args, options = {}) {
  const result = await execFileAsync(binary, args, {
    cwd,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  return result.stdout.trim();
}

async function remoteBranchExists(cwd, branch) {
  try {
    await command(cwd, "git", ["ls-remote", "--exit-code", "--heads", "origin", branch]);
    return true;
  } catch {
    return false;
  }
}

async function hasStagedChanges(cwd) {
  try {
    await command(cwd, "git", ["diff", "--cached", "--quiet"]);
    return false;
  } catch (error) {
    if (error?.code === 1) return true;
    throw error;
  }
}

export function createGitPublisher({ repositoryDir, baseBranch = "main" }) {
  return async function publish(proposal) {
    const cwd = resolve(repositoryDir);
    const dirty = await command(cwd, "git", ["status", "--porcelain"]);
    if (dirty) {
      throw new Error("Publication Repository must be clean before creating a Review Draft");
    }

    const originalBranch = await command(cwd, "git", ["branch", "--show-current"]);
    let switched = false;

    try {
      await command(cwd, "git", ["fetch", "origin", baseBranch]);
      const exists = await remoteBranchExists(cwd, proposal.branch);
      if (exists) {
        await command(cwd, "git", [
          "fetch",
          "origin",
          `${proposal.branch}:refs/remotes/origin/${proposal.branch}`,
        ]);
      }
      await command(cwd, "git", [
        "switch",
        "-C",
        proposal.branch,
        exists ? `origin/${proposal.branch}` : `origin/${baseBranch}`,
      ]);
      switched = true;

      const contentFile = resolve(cwd, proposal.contentPath);
      await mkdir(dirname(contentFile), { recursive: true });
      await writeFile(contentFile, proposal.markdown);
      await command(cwd, "git", ["add", proposal.contentPath]);

      if (await hasStagedChanges(cwd)) {
        await command(cwd, "git", ["commit", "-m", `content: daily review ${proposal.reviewDay}`]);
      }

      await command(cwd, "git", ["push", "--set-upstream", "origin", proposal.branch]);

      let prUrl = await command(cwd, "gh", [
        "pr",
        "list",
        "--head",
        proposal.branch,
        "--base",
        baseBranch,
        "--state",
        "all",
        "--json",
        "url",
        "--jq",
        ".[0].url // empty",
      ]);

      if (!prUrl) {
        prUrl = await command(cwd, "gh", [
          "pr",
          "create",
          "--base",
          baseBranch,
          "--head",
          proposal.branch,
          "--title",
          `Daily review — ${proposal.reviewDay}`,
          "--body",
          "Generated locally from visible OpenClaw messages. Review privacy and accuracy before merging.",
        ]);
      }

      return { prUrl };
    } finally {
      if (switched && originalBranch) {
        await command(cwd, "git", ["switch", originalBranch]);
      }
    }
  };
}
