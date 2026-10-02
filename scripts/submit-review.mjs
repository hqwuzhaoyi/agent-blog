import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { containsSensitiveContent } from "./lib/review-core.mjs";
import { submitContent } from "./lib/content-client.mjs";
export function parseMarkdown(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(markdown);
  if (!match) throw new Error("Expected Markdown with YAML frontmatter");
  return { data: parse(match[1]), body: match[2].trim() };
}
export async function submitReviewMarkdown(id, markdown) {
  const { data, body } = parseMarkdown(markdown);
  if (containsSensitiveContent({ data, body })) throw new Error("Review contains sensitive content; revise before submission");
  return submitContent("reviews", id, data, body);
}
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      id: { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  if (!values.file || !values.id)
    throw new Error(
      "Usage: npm run review:submit -- --file draft.md --id source-YYYY-MM-DD [--dry-run]",
    );
  const markdown = await readFile(values.file, "utf8");
  console.log(
    JSON.stringify(
      values["dry-run"]
        ? { status: "validated", ...parseMarkdown(markdown) }
        : await submitReviewMarkdown(values.id, markdown),
      null,
      2,
    ),
  );
}
