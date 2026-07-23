import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { selectPlatformCollection } from "../scripts/lib/platform-registry.mjs";
import { runPublicationWorkflow } from "../scripts/lib/publication-workflow.mjs";
import { createReviewSubmission } from "../scripts/lib/review-core.mjs";

const REVIEW_DAY = "2026-07-21";
const TIME_ZONE = "Asia/Taipei";
const MESSAGE_TIMESTAMP = 1784599200000;

const platforms = [
  {
    id: "openclaw",
    label: "OpenClaw",
    sourceId: "matrix-openclaw",
    sourceLabel: "OpenClaw / Matrix",
    fixtureFile: "openclaw.json",
    messageId: "openclaw-message-1",
    sessionKey: "matrix-openclaw-session",
    text: "Summarize the synthetic OpenClaw work.",
    cursor: { timestamp: MESSAGE_TIMESTAMP, messageId: "openclaw-message-1" },
    agentId: "matrix-primary",
  },
  {
    id: "codex",
    label: "Codex",
    sourceId: "matrix-codex",
    sourceLabel: "Codex / Matrix",
    fixtureFile: "codex.json",
    messageId: "codex-message-1",
    sessionKey: "matrix-codex-thread",
    text: "Summarize the synthetic Codex work.",
    cursor: { timestamp: MESSAGE_TIMESTAMP, messageId: "codex-message-1" },
  },
  {
    id: "hermes",
    label: "Hermes",
    sourceId: "matrix-hermes",
    sourceLabel: "Hermes / Matrix",
    fixtureFile: "hermes.json",
    messageId: "1",
    sessionKey: "matrix-hermes-session",
    text: "Summarize the synthetic Hermes work.",
    cursor: { timestamp: MESSAGE_TIMESTAMP, messageId: "1" },
  },
  {
    id: "pi",
    label: "Pi",
    sourceId: "matrix-pi",
    sourceLabel: "Pi / Matrix",
    fixtureFile: "pi.json",
    messageId: "pi-message-1",
    sessionKey: "matrix-pi-session",
    text: "Summarize the synthetic Pi work.",
    cursor: { timestamp: MESSAGE_TIMESTAMP, messageId: "pi-message-1" },
  },
  {
    id: "claude-code",
    label: "Claude Code",
    sourceId: "matrix-claude-code",
    sourceLabel: "Claude Code / Matrix",
    fixtureFile: "claude-code.json",
    messageId: "claude-code-event-1",
    sessionKey: "matrix-claude-code-session",
    text: "Summarize the synthetic Claude Code work.",
    cursor: {
      sequence: 1,
      timestamp: MESSAGE_TIMESTAMP,
      messageId: "claude-code-event-1",
    },
  },
];

async function loadFixture(fixtureFile) {
  const contents = await readFile(
    new URL(`./fixtures/platform-matrix/${fixtureFile}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(contents);
}

function configFor(platform) {
  return {
    platform: platform.id,
    sourceId: platform.sourceId,
    sourceLabel: platform.sourceLabel,
    timeZone: TIME_ZONE,
    privateTerms: ["Synthetic Confidential"],
  };
}

async function collectFixtureWindow(platform, state = { sessions: {} }) {
  const config = configFor(platform);
  const fixture = await loadFixture(platform.fixtureFile);
  const selection = selectPlatformCollection({ config, fixture });
  return selection.collect({
    config,
    fixture,
    sourceId: config.sourceId,
    reviewDay: REVIEW_DAY,
    timeZone: config.timeZone,
    state,
  });
}

function createSafeSubmission(platform) {
  return createReviewSubmission({
    config: configFor(platform),
    reviewDay: REVIEW_DAY,
    draft: {
      title: `${platform.label} Daily Review`,
      summary: `Selected synthetic ${platform.label} work.`,
      highlights: [
        {
          title: `${platform.label} matrix accepted`,
          outcome: "The synthetic platform path produced a publication-safe Review Submission.",
          project: "Agent Blog",
        },
        {
          title: "Synthetic private detail",
          outcome: "Synthetic Confidential used api_key=not-a-real-credential.",
          project: "Private work",
        },
      ],
    },
  });
}

function expectedMessage(platform) {
  return {
    id: platform.messageId,
    sessionKey: platform.sessionKey,
    ...(platform.agentId ? { agentId: platform.agentId } : {}),
    role: "user",
    timestamp: MESSAGE_TIMESTAMP,
    text: platform.text,
  };
}

describe.each(platforms)("$label platform matrix", (platform) => {
  test("collects a standard Review Window and creates accurately attributed publication-safe Markdown", async () => {
    const window = await collectFixtureWindow(platform);
    const submission = createSafeSubmission(platform);

    expect(window).toEqual({
      sourceId: platform.sourceId,
      reviewDay: REVIEW_DAY,
      timeZone: TIME_ZONE,
      messages: [expectedMessage(platform)],
      candidateCursors: { [platform.sessionKey]: platform.cursor },
    });
    expect(submission).toMatchObject({
      status: "ready",
      omittedHighlights: 1,
      highlights: 1,
    });
    expect(submission.markdown).toContain(`source: ${JSON.stringify(platform.sourceLabel)}`);
    expect(submission.markdown).toContain(`platforms: [${JSON.stringify(platform.label)}]`);
    expect(submission.markdown).toContain(`${platform.label} matrix accepted`);
    expect(submission.markdown).not.toContain("Synthetic private detail");
    expect(submission.markdown).not.toContain("not-a-real-credential");
  });

  test("keeps one same-day Review Identity and proposal target across retries", async () => {
    const root = await mkdtemp(join(tmpdir(), `agent-blog-matrix-${platform.id}-`));
    const statePath = join(root, "state.json");
    const window = await collectFixtureWindow(platform);
    const submission = createSafeSubmission(platform);
    const proposals = [];
    const publisher = async (proposal) => {
      proposals.push(proposal);
      return { prUrl: `https://example.test/reviews/${platform.id}` };
    };

    try {
      const first = await runPublicationWorkflow({ statePath, window, submission, publisher });
      const second = await runPublicationWorkflow({ statePath, window, submission, publisher });
      const state = JSON.parse(await readFile(statePath, "utf8"));

      expect(first.reviewIdentity).toBe(`${platform.sourceId}:${REVIEW_DAY}`);
      expect(second.reviewIdentity).toBe(first.reviewIdentity);
      expect(proposals).toHaveLength(2);
      expect(proposals[1]).toEqual(proposals[0]);
      expect(state.sessions[platform.sessionKey]).toEqual(platform.cursor);
      expect(state.reviews[first.reviewIdentity]).toMatchObject({
        branch: `agent-review/${REVIEW_DAY}`,
        contentPath: `src/data/reviews/${REVIEW_DAY}.md`,
        prUrl: `https://example.test/reviews/${platform.id}`,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("advances candidate cursors after no-update without publishing", async () => {
    const root = await mkdtemp(join(tmpdir(), `agent-blog-matrix-${platform.id}-`));
    const statePath = join(root, "state.json");
    const window = await collectFixtureWindow(platform);
    let publisherCalled = false;

    try {
      const result = await runPublicationWorkflow({
        statePath,
        window,
        submission: { status: "no-update", reason: "no-important-work" },
        publisher: async () => {
          publisherCalled = true;
        },
      });
      const state = JSON.parse(await readFile(statePath, "utf8"));

      expect(result).toEqual({
        status: "no-update",
        reviewIdentity: `${platform.sourceId}:${REVIEW_DAY}`,
        reason: "no-important-work",
      });
      expect(publisherCalled).toBe(false);
      expect(state.sessions[platform.sessionKey]).toEqual(platform.cursor);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("does not advance candidate cursors when publication fails", async () => {
    const root = await mkdtemp(join(tmpdir(), `agent-blog-matrix-${platform.id}-`));
    const statePath = join(root, "state.json");
    const window = await collectFixtureWindow(platform);

    try {
      await expect(runPublicationWorkflow({
        statePath,
        window,
        submission: createSafeSubmission(platform),
        publisher: async () => {
          throw new Error("synthetic publication failed");
        },
      })).rejects.toThrow("synthetic publication failed");
      await expect(readFile(statePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test("an unknown Agent Platform fails closed before fixture collection", () => {
  expect(() => selectPlatformCollection({
    config: {
      platform: "synthetic-unknown",
      sourceId: "matrix-unknown",
      timeZone: TIME_ZONE,
    },
    fixture: {},
  })).toThrow("Unsupported Agent Platform: synthetic-unknown");
});
