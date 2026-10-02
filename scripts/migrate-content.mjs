import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { parseMarkdown } from "./submit-review.mjs";
import { wrangler, bucket } from "./deploy-cloudflare.mjs";
const temporary = await mkdtemp(join(tmpdir(), "blog-content-migration-"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
try {
  const entries = [];
  for (const file of await readdir("src/data/reviews"))
    if (file.endsWith(".md"))
      entries.push({
        kind: "review",
        id: file.slice(0, -3),
        ...parseMarkdown(
          await readFile(join("src/data/reviews", file), "utf8"),
        ),
      });
  const catalog = join(temporary, "catalog.json");
  wrangler([
    "r2",
    "object",
    "get",
    `${bucket}/publication/catalog.json`,
    "--remote",
    "--file",
    catalog,
  ]);
  for (const id of JSON.parse(await readFile(catalog, "utf8"))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id))
      throw new Error("Invalid catalog date");
    const file = join(temporary, `${id}.md`);
    wrangler([
      "r2",
      "object",
      "get",
      `${bucket}/publication/episodes/${id}.md`,
      "--remote",
      "--file",
      file,
    ]);
    const content = parseMarkdown(await readFile(file, "utf8"));
    if (content.data.draft)
      throw new Error("Refusing to migrate unpublished draft");
    entries.push({ kind: "episode", id, ...content });
  }
  const sql = entries
    .map(({ kind, id, data, body }) => {
      if (data.date instanceof Date)
        data.date = data.date.toISOString().slice(0, 10);
      const text = JSON.stringify(data),
        revision = createHash("sha256")
          .update(text + "\n" + body)
          .digest("hex"),
        now = new Date().toISOString();
      return `INSERT OR IGNORE INTO content_revisions VALUES (${[kind, id, revision, text, body, randomBytes(32).toString("hex"), now].map(quote).join(",")});\nINSERT OR IGNORE INTO content_heads VALUES (${[kind, id, revision, revision, now].map(quote).join(",")});\nINSERT OR IGNORE INTO publication_audit VALUES (${[kind, id, revision, "legacy-approved-migration", now].map(quote).join(",")});`;
    })
    .join("\n");
  await mkdir(".agent-blog", { recursive: true });
  const file = ".agent-blog/content-migration.sql";
  await writeFile(file, sql, { mode: 0o600 });
  console.log(
    wrangler([
      "d1",
      "execute",
      "agent-blog-content",
      process.argv.includes("--remote") ? "--remote" : "--local",
      "--file",
      file,
    ]),
  );
  console.log(
    JSON.stringify({
      status: "migrated",
      reviews: entries.filter((e) => e.kind === "review").length,
      episodes: entries.filter((e) => e.kind === "episode").length,
    }),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
