import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const script = new URL("../scripts/configure-blog.mjs", import.meta.url);

describe("Blog creation configuration", () => {
  test("accepts a supported theme and language without changing files in dry-run mode", async () => {
    const { stdout } = await execFileAsync(process.execPath, [
      script.pathname,
      "--theme",
      "signal-console",
      "--language",
      "zh-CN",
      "--dry-run",
    ]);

    expect(JSON.parse(stdout)).toEqual({
      status: "dry-run",
      theme: "signal-console",
      language: "zh-CN",
    });
  });

  test("rejects unsupported choices", async () => {
    await expect(
      execFileAsync(process.execPath, [script.pathname, "--theme", "purple-ai", "--dry-run"]),
    ).rejects.toMatchObject({ code: 1 });
  });
});
