import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runPublicationWorkflow } from "../scripts/lib/publication-workflow.mjs";

const window = {
  sourceId: "openclaw-main",
  reviewDay: "2026-07-16",
  candidateCursors: {
    "agent:main:main": { timestamp: 1784217600000, messageId: "m-4" },
  },
};

const submission = {
  status: "ready",
  markdown: "---\ntitle: \"A review\"\n---\n\nA safe report.\n",
  omittedHighlights: 0,
};

describe("Publication Workflow seam", () => {
  test("retries use the same Review Identity and advance cursors only after a successful push", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-"));
    const statePath = join(root, "state.json");
    const publications = [];
    const publisher = async (proposal) => {
      publications.push(proposal);
      return { prUrl: "https://github.com/example/agent-blog/pull/1" };
    };

    const first = await runPublicationWorkflow({ statePath, window, submission, publisher });
    const second = await runPublicationWorkflow({ statePath, window, submission, publisher });
    const state = JSON.parse(await readFile(statePath, "utf8"));

    expect(first.reviewIdentity).toBe("openclaw-main:2026-07-16");
    expect(second.reviewIdentity).toBe(first.reviewIdentity);
    expect(publications[0].branch).toBe(publications[1].branch);
    expect(publications[0].contentPath).toBe(publications[1].contentPath);
    expect(state.sessions["agent:main:main"]).toEqual(window.candidateCursors["agent:main:main"]);
    expect(state.reviews[first.reviewIdentity].prUrl).toBe("https://github.com/example/agent-blog/pull/1");
  });

  test("a failed push leaves session cursors unchanged", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-"));
    const statePath = join(root, "state.json");

    await expect(
      runPublicationWorkflow({
        statePath,
        window,
        submission,
        publisher: async () => {
          throw new Error("push failed");
        },
      }),
    ).rejects.toThrow("push failed");

    await expect(readFile(statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("a no-update result advances cursors without invoking the publisher", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-blog-"));
    const statePath = join(root, "state.json");
    let published = false;

    const result = await runPublicationWorkflow({
      statePath,
      window,
      submission: { status: "no-update", reason: "no-important-work", omittedHighlights: 0 },
      publisher: async () => {
        published = true;
      },
    });
    const state = JSON.parse(await readFile(statePath, "utf8"));

    expect(result.status).toBe("no-update");
    expect(published).toBe(false);
    expect(state.sessions["agent:main:main"]).toEqual(window.candidateCursors["agent:main:main"]);
  });
});
