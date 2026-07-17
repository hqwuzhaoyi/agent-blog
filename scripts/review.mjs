#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createReviewSubmission } from "./lib/review-core.mjs";
import {
  buildReviewWindowFromSessions,
  collectGatewayWindow,
  currentReviewDay,
  previousReviewDay,
} from "./lib/openclaw-gateway.mjs";
import { createGitPublisher } from "./lib/git-publisher.mjs";
import { runPublicationWorkflow } from "./lib/publication-workflow.mjs";

function parseArguments(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    if (rest[index + 1] && !rest[index + 1].startsWith("--")) options[key] = rest[++index];
    else options[key] = true;
  }
  return { command, options };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}

async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function pathsFor(root, options) {
  const local = resolve(root, ".agent-blog");
  return {
    config: resolve(options.config || `${local}/config.json`),
    state: resolve(options.state || `${local}/state.json`),
    window: resolve(options.window || `${local}/review-window.json`),
    draft: resolve(options.draft || `${local}/review-draft.json`),
  };
}

function validateConfig(config) {
  for (const key of ["sourceId", "sourceLabel", "timeZone"]) {
    if (!config[key]) throw new Error(`Missing required config field: ${key}`);
  }
  return config;
}

async function collect({ options, paths, config }) {
  const state = await readJson(paths.state, { version: 1, sessions: {}, reviews: {} });
  const reviewDay = options.day || (options.manual
    ? currentReviewDay(Date.now(), config.timeZone)
    : previousReviewDay(Date.now(), config.timeZone));
  let window;

  if (options.fixture) {
    const fixture = await readJson(resolve(options.fixture));
    window = buildReviewWindowFromSessions({
      sessions: fixture.sessions ?? [],
      sourceId: config.sourceId,
      reviewDay,
      timeZone: config.timeZone,
      state,
    });
  } else {
    window = await collectGatewayWindow({
      sourceId: config.sourceId,
      reviewDay,
      timeZone: config.timeZone,
      state,
      binary: config.openclawBinary || "openclaw",
    });
  }

  await writePrivateJson(paths.window, window);
  console.log(JSON.stringify({
    status: "collected",
    mode: options.manual ? "manual" : "scheduled",
    reviewDay,
    visibleMessages: window.messages.length,
    output: paths.window,
  }));
  return window;
}

async function submit({ root, options, paths, config }) {
  const window = await readJson(paths.window);
  const draft = await readJson(paths.draft);
  const submission = createReviewSubmission({ config, reviewDay: window.reviewDay, draft });

  if (options["dry-run"]) {
    if (submission.status === "ready") process.stdout.write(submission.markdown);
    else console.log(JSON.stringify(submission));
    return submission;
  }

  const publisher = createGitPublisher({
    repositoryDir: root,
    baseBranch: config.baseBranch || "main",
  });
  const result = await runPublicationWorkflow({
    statePath: paths.state,
    window,
    submission,
    publisher,
  });
  console.log(JSON.stringify(result));
  return result;
}

async function noUpdate({ paths }) {
  const window = await readJson(paths.window);
  const result = await runPublicationWorkflow({
    statePath: paths.state,
    window,
    submission: { status: "no-update", reason: "no-important-work", omittedHighlights: 0 },
    publisher: async () => {
      throw new Error("Publisher must not run for no-update");
    },
  });
  console.log(JSON.stringify(result));
}

async function fixture({ root, options, paths, config }) {
  const fixturePath = options.fixture || "test/fixtures/gateway-day.json";
  const draftPath = options.draft || "test/fixtures/review-draft.json";
  await collect({ options: { ...options, fixture: fixturePath, day: options.day || "2026-07-16" }, paths, config });
  const draft = await readJson(resolve(draftPath));
  await writePrivateJson(paths.draft, draft);
  return submit({ root, options: { ...options, "dry-run": true }, paths, config });
}

async function manual({ options, paths, config }) {
  return collect({ options: { ...options, manual: true }, paths, config });
}

function help() {
  console.log(`Agent Blog review workflow

Commands:
  collect   Read the Review Window from the OpenClaw Gateway
  manual    Read the current local Review Day without submitting a pull request
  submit    Validate the local draft, create/update a branch and pull request
  no-update Advance cursors without publishing
  fixture   Exercise collection and rendering with contract fixtures

Options:
  --config <path>  Config file (default .agent-blog/config.json)
  --day <date>     Review Day override in YYYY-MM-DD (manual defaults to today)
  --dry-run        Render without Git or state changes
`);
}

const { command, options } = parseArguments(process.argv.slice(2));
const root = process.cwd();
const paths = pathsFor(root, options);
const config = validateConfig(
  await readJson(paths.config, {
    sourceId: "openclaw-main",
    sourceLabel: "OpenClaw / Gateway 01",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    privateTerms: [],
    baseBranch: "main",
    theme: "night-shift",
    language: "en",
  }),
);

if (command === "collect") await collect({ options, paths, config });
else if (command === "manual") await manual({ options, paths, config });
else if (command === "submit") await submit({ root, options, paths, config });
else if (command === "no-update") await noUpdate({ paths });
else if (command === "fixture") await fixture({ root, options, paths, config });
else help();
