#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { themeCatalog, themeIds } from "../src/themes/catalog.mjs";

const LANGUAGES = ["en", "zh-CN"];

function optionsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    if (argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return options;
}

const options = optionsFrom(process.argv.slice(2));
const configPath = fileURLToPath(new URL("../src/blog.config.json", import.meta.url));
const current = JSON.parse(await readFile(configPath, "utf8"));

if (options["list-themes"]) {
  console.log(JSON.stringify({ themes: themeCatalog }, null, 2));
  process.exit(0);
}

const theme = options.theme || current.theme || "night-shift";
const language = options.language || current.language || "en";
const defaults = language === "zh-CN"
  ? {
      title: "Agent 工作日志",
      tagline: "记录持续推进的项目中，由人与 Agent 共同完成的重要工作。",
    }
  : {
      title: "Agent Worklog",
      tagline: "Notes on important work completed by people and agents across ongoing projects.",
    };
const title = typeof options.title === "string" ? options.title.trim() : current.title || defaults.title;
const tagline = typeof options.tagline === "string" ? options.tagline.trim() : current.tagline || defaults.tagline;

if (!themeIds.includes(theme)) {
  console.error(`Unsupported theme: ${theme}. Choose ${themeIds.join(" or ")}.`);
  process.exit(1);
}

if (!LANGUAGES.includes(language)) {
  console.error(`Unsupported language: ${language}. Choose ${LANGUAGES.join(" or ")}.`);
  process.exit(1);
}

if (!title) {
  console.error("Blog title cannot be empty.");
  process.exit(1);
}

const result = {
  status: options["dry-run"] ? "dry-run" : "configured",
  theme,
  language,
  title,
  tagline,
};

if (!options["dry-run"]) {
  await writeFile(configPath, `${JSON.stringify({ theme, language, title, tagline }, null, 2)}\n`);
}

console.log(JSON.stringify(result, null, 2));
