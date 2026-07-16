import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, sessions: {}, reviews: {} };
    throw error;
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

function advanceCursors(state, candidateCursors = {}) {
  state.sessions = { ...state.sessions, ...candidateCursors };
}

export async function runPublicationWorkflow({ statePath, window, submission, publisher }) {
  const state = await readState(statePath);
  const reviewIdentity = `${window.sourceId}:${window.reviewDay}`;

  if (submission.status === "no-update") {
    advanceCursors(state, window.candidateCursors);
    await writeState(statePath, state);
    return { status: "no-update", reviewIdentity, reason: submission.reason };
  }

  if (submission.status !== "ready") {
    throw new Error(`Unsupported submission status: ${submission.status}`);
  }

  const proposal = {
    reviewIdentity,
    reviewDay: window.reviewDay,
    branch: `agent-review/${window.reviewDay}`,
    contentPath: `src/data/reviews/${window.reviewDay}.md`,
    markdown: submission.markdown,
  };
  const publication = await publisher(proposal);

  advanceCursors(state, window.candidateCursors);
  state.reviews[reviewIdentity] = {
    branch: proposal.branch,
    contentPath: proposal.contentPath,
    prUrl: publication.prUrl,
    publishedAt: new Date().toISOString(),
  };
  await writeState(statePath, state);

  return { status: "submitted", reviewIdentity, ...publication };
}
