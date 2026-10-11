import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { validateEpisodeBriefs } from "./episode-briefs.mjs";

const { values } = parseArgs({
  options: { directory: { type: "string" }, measured: { type: "boolean" } },
});
if (!values.directory)
  throw new Error(
    "Usage: node validate-briefs.mjs --directory <episode directory> [--measured]",
  );
const directory = resolve(values.directory);
const read = async (file) =>
  JSON.parse(await readFile(join(directory, file), "utf8"));
const result = validateEpisodeBriefs({
  source: await read("episode.json"),
  publication: await read("publication.json"),
  ...(values.measured
    ? { parts: await read("episode.parts/manifest.json") }
    : {}),
});
console.log(JSON.stringify({ status: "validated", ...result }));
