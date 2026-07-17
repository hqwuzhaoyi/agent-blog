#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const THEMES = ["night-shift", "signal-console"];
const LANGUAGES = ["en", "zh-CN"];

function optionsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    if (argv[index + 1] && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return options;
}

const options = optionsFrom(process.argv.slice(2));
const theme = options.theme || "night-shift";
const language = options.language || "en";

if (!THEMES.includes(theme)) {
  console.error(`Unsupported theme: ${theme}. Choose ${THEMES.join(" or ")}.`);
  process.exit(1);
}

if (!LANGUAGES.includes(language)) {
  console.error(`Unsupported language: ${language}. Choose ${LANGUAGES.join(" or ")}.`);
  process.exit(1);
}

const result = { status: options["dry-run"] ? "dry-run" : "configured", theme, language };

if (!options["dry-run"]) {
  const configPath = fileURLToPath(new URL("../src/blog.config.json", import.meta.url));
  await writeFile(configPath, `${JSON.stringify({ theme, language }, null, 2)}\n`);
}

console.log(JSON.stringify(result, null, 2));
