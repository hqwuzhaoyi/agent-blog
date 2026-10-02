import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { prepareEpisode } from "./lib/episode-publication.mjs";
import { command, deploy } from "./deploy-cloudflare.mjs";

const { values } = parseArgs({ options: { directory: { type: "string" }, day: { type: "string" }, "dry-run": { type: "boolean" } } });
if (!values.directory || !values.day) throw new Error("Usage: npm run episode:publish -- --directory <render directory> --day YYYY-MM-DD [--dry-run]");
const directory = resolve(values.directory);
const audioFile = join(directory, "episode.mp3");
const json = async (file) => JSON.parse(await readFile(join(directory, file), "utf8"));
const [source, publication, parts, audio, shownotes] = await Promise.all([
  json("episode.json"), json("publication.json"), json("episode.parts/manifest.json"), readFile(audioFile), readFile(join(directory, "shownotes.md"), "utf8"),
]);
const probe = JSON.parse(command("ffprobe", ["-v", "error", "-show_format", "-of", "json", audioFile]));
command("ffmpeg", ["-v", "error", "-i", audioFile, "-f", "null", "-"]);
const episode = prepareEpisode({ day: values.day, source, publication, parts, duration: Number(probe.format.duration), audio, shownotes });
const result = await deploy({ episode, audioFile, audioKey: episode.audioKey, dryRun: values["dry-run"] });
await writeFile(join(directory, "publication-result.json"), JSON.stringify({ ...result, url: `https://blog.wuzhaoyi.xyz/agent-blog/episodes/${values.day}/`, audio: episode.data.audio.url }, null, 2));
console.log(JSON.stringify(result));
