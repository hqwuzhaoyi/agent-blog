import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { parse } from "yaml";
const { values } = parseArgs({
  options: {
    config: { type: "string", default: "wrangler.react.jsonc" },
    origin: { type: "string", default: "http://localhost:3100" },
  },
});
const config = JSON.parse(await readFile(values.config, "utf8"));
if (
  config.routes?.length ||
  config.name === "agent-blog" ||
  config.d1_databases?.some(
    (x) => x.database_id === "d6aac9aa-6536-46c0-9767-835b49c0613e",
  )
)
  throw new Error(
    "Preview seeding requires an isolated local Worker configuration",
  );
const origin = new URL(values.origin).origin;
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Preview origin must be local");
await mkdir(".agent-blog", { recursive: true });
try {
  await readFile(".dev.vars.react-preview");
} catch (error) {
  if (error.code === "ENOENT")
    await writeFile(
      ".dev.vars.react-preview",
      await readFile(".dev.vars.react-preview.example"),
      { mode: 0o600 },
    );
  else throw error;
}
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const sql = [];
function record(kind, id, data, body, published) {
  const revision = createHash("sha256")
      .update(JSON.stringify(data) + "\n" + body)
      .digest("hex"),
    now = "2026-10-02T07:00:00.000Z";
  sql.push(
    `INSERT OR IGNORE INTO content_revisions VALUES (${[kind, id, revision, JSON.stringify(data), body, "preview-view-token", now].map(q).join(",")});`,
  );
  sql.push(
    `INSERT INTO content_heads VALUES (${[kind, id, revision].map(q).join(",")},${published ? q(revision) : "NULL"},${published ? q(now) : "NULL"})
    ON CONFLICT(kind,id) DO UPDATE SET draft_revision=excluded.draft_revision,published_revision=excluded.published_revision
    WHERE content_heads.kind='episode' AND content_heads.draft_revision=content_heads.published_revision
    AND EXISTS(SELECT 1 FROM publication_audit WHERE kind=content_heads.kind AND id=content_heads.id AND revision=content_heads.published_revision AND actor='preview-fixture');`,
  );
  if (published)
    sql.push(
      `INSERT OR IGNORE INTO publication_audit VALUES (${[kind, id, revision, "preview-fixture", now].map(q).join(",")});`,
    );
}
for (const file of await readdir("src/data/reviews")) {
  if (!file.endsWith(".md")) continue;
  const source = await readFile("src/data/reviews/" + file, "utf8");
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error("Invalid review fixture");
  record("review", file.slice(0, -3), parse(match[1]), match[2].trim(), true);
}
record(
  "review",
  "qa-draft",
  {
    title: "PRIVATE_DRAFT_MARKER",
    summary: "不得进入公开搜索或订阅",
    date: "2026-10-02",
    source: "Hermes / Preview",
    platforms: ["Hermes"],
    highlights: 1,
  },
  "## 完整草稿\n\n这段内容等待人工确认。<script>window.__unsafe=true</script>",
  false,
);
const audioFile = ".agent-blog/react-preview.mp3";
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=30",
  "-codec:a",
  "libmp3lame",
  "-b:a",
  "64k",
  audioFile,
]);
const audio = await readFile(audioFile),
  hash = createHash("sha256").update(audio).digest("hex"),
  key = `episodes/2026-10-02/${hash}.mp3`;
record(
  "episode",
  "2026-10-02",
  {
    title: "几分钟，听见新想法",
    summary: "可播放的隔离节目，用于验证章节、跨页播放与 RSS。",
    date: "2026-10-02",
    duration: 30,
    disclosure: "AI 配音 · 隔离测试样本",
    draft: false,
    audio: {
      url: `${origin}/audio/2026-10-02/${hash}.mp3`,
      length: audio.length,
      type: "audio/mpeg",
    },
    materials: [
      { id: "a".repeat(24), kind: "x", author: "示例构建者", handle: "example", summary: "这是一条公开来源的中文整理，用于验证素材卡片与章节播放。", url: "https://example.com/post", publishedAt: "2026-10-01T12:00:00Z", linkKind: "item", chapterStart: 5 },
      { id: "b".repeat(24), kind: "podcast", author: "示例播客", title: "关于 AI 工作方式的访谈", summary: "访谈素材保留节目出处，便于对照阅读和收听。", url: "https://www.youtube.com/playlist?list=example", linkKind: "playlist", chapterStart: 12 },
    ],
    chapters: [
      { title: "开场", start: 0 },
      { title: "主线", start: 5 },
      { title: "短讯", start: 12 },
      { title: "尾声", start: 22 },
    ],
  },
  "## 节目内容\n\n本地音频用来验证完整收听路径，不作为公开节目发布。\n\n## 来源\n\n[公开示例](https://example.com)",
  true,
);
await writeFile(".agent-blog/react-preview-fixtures.sql", sql.join("\n"), {
  mode: 0o600,
});
const run = (args) =>
  execFileSync(
    "node_modules/.bin/wrangler",
    [
      ...args,
      "--config",
      values.config,
      ...(config.env?.["react-preview"] ? ["--env", "react-preview"] : []),
    ],
    { encoding: "utf8" },
  );
run(["d1", "migrations", "apply", "CONTENT", "--local"]);
run([
  "d1",
  "execute",
  "CONTENT",
  "--local",
  "--file",
  ".agent-blog/react-preview-fixtures.sql",
]);
const bucket = config.r2_buckets.find((x) => x.binding === "AUDIO").bucket_name;
run([
  "r2",
  "object",
  "put",
  `${bucket}/${key}`,
  "--local",
  "--file",
  audioFile,
  "--content-type",
  "audio/mpeg",
]);
console.log(
  JSON.stringify({
    status: "seeded-local-preview",
    origin,
    review: "2026-07-16",
    episode: "2026-10-02",
    audioBytes: audio.length,
  }),
);
