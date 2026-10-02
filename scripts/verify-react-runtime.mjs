import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { origin: { type: "string", default: "http://localhost:3100" } },
});
const origin = new URL(values.origin).origin;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) {
  throw new Error(
    "Runtime acceptance writes require an isolated localhost Worker",
  );
}
const submit = "isolated-preview-ingest-key";
const reviewer = "isolated-preview-password";
const checks = [];
const request = (path, options) => fetch(origin + path, options);
const expectStatus = async (response, status) => {
  assert.equal(
    response.status,
    status,
    `${response.url}: ${await response.clone().text()}`,
  );
  return response;
};
const json = (method, body, headers = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const ingest = (path, body) =>
  request(
    "/api/" + path,
    json("PUT", body, { Authorization: `Bearer ${submit}` }),
  );
const rss = async (path) =>
  (await expectStatus(await request("/" + path), 200)).text();

const privacyMarker =
  "PRIVATE_RUNTIME_SENTINEL_" + randomBytes(6).toString("hex");
const privacySummary =
  "Unpublished sentinel summary " + randomBytes(6).toString("hex");
await expectStatus(
  await ingest("reviews/privacy-" + randomBytes(6).toString("hex"), {
    data: {
      title: privacyMarker,
      summary: privacySummary,
      date: "1997-01-01",
      source: "Runtime fixture",
      platforms: ["Hermes"],
      highlights: 1,
    },
    body: "Private sentinel body",
  }),
  200,
);
for (const path of [
  "/",
  "/reviews/2026-07-16/",
  "/archive/",
  "/archive/?q=" + privacyMarker,
]) {
  const response = await expectStatus(await request(path), 200);
  const html = await response.text();
  assert.match(html, /<html/);
  assert(!html.includes(privacySummary), `${path} leaked private fixture`);
  if (!path.includes("?"))
    assert(!html.includes(privacyMarker), `${path} leaked private fixture`);
  assert(!html.includes(submit) && !html.includes(reviewer));
  if (path.includes("/reviews/")) {
    assert.match(html, /<article/);
    assert.match(html, /rel="canonical"/);
  }
}
checks.push("public SSR, canonical metadata and draft isolation");
const podcast = await rss("episodes/rss.xml");
const combined = await rss("rss.xml");
await expectStatus(
  await request("/episodes/rss.xml", {
    headers: { "User-Agent": "Python-urllib/3.13" },
  }),
  200,
);
assert(!podcast.includes(privacyMarker) && !combined.includes(privacyMarker));
const enclosure =
  /<enclosure url="([^"]+)" length="(\d+)" type="audio\/mpeg"\s*\/>/.exec(
    podcast,
  );
assert(enclosure, "Seeded podcast enclosure missing");
const audioURL = new URL(enclosure[1].replaceAll("&amp;", "&"));
assert.equal(
  audioURL.origin,
  origin,
  "Audio protocol tests must remain localhost",
);
const audioPath = audioURL.pathname;
const head = await expectStatus(
  await request(audioPath, { method: "HEAD" }),
  200,
);
assert.equal(Number(head.headers.get("Content-Length")), Number(enclosure[2]));
assert.equal(head.headers.get("Content-Type"), "audio/mpeg");
assert.match(head.headers.get("Cache-Control"), /immutable/);
const etag = head.headers.get("ETag");
assert(etag);
await expectStatus(
  await request(audioPath, { headers: { "If-None-Match": etag } }),
  304,
);
for (const [range, expected, bytes] of [
  ["bytes=0-127", `bytes 0-127/${enclosure[2]}`, 128],
  [
    "bytes=-10",
    `bytes ${Number(enclosure[2]) - 10}-${Number(enclosure[2]) - 1}/${enclosure[2]}`,
    10,
  ],
]) {
  const response = await expectStatus(
    await request(audioPath, { headers: { Range: range } }),
    206,
  );
  assert.equal(response.headers.get("Content-Range"), expected);
  assert.equal((await response.arrayBuffer()).byteLength, bytes);
}
const invalid = await expectStatus(
  await request(audioPath, { headers: { Range: `bytes=${enclosure[2]}-` } }),
  416,
);
assert.equal(invalid.headers.get("Content-Range"), `bytes */${enclosure[2]}`);
await expectStatus(await request(audioPath, { method: "POST" }), 405);
checks.push(
  "audio HEAD, ETag, ranges, suffix ranges, invalid ranges and immutable caching",
);

const suffix = randomBytes(6).toString("hex");
const id = "runtime-" + suffix;
const privateMarker = "PRIVATE_RUNTIME_" + suffix;
const title = "Runtime approved " + suffix;
const data = {
  title,
  summary: "Isolated acceptance fixture",
  date: "1998-01-01",
  source: "Runtime fixture",
  platforms: ["Hermes"],
  highlights: 1,
};
const saved = await (
  await expectStatus(
    await ingest("reviews/" + id, {
      data,
      body: "## Complete article\n\nPublic fixture body. <script>window.runtimeUnsafe=true</script>",
    }),
    200,
  )
).json();
assert.equal(saved.status, "draft");
assert(saved.previewUrl.includes("/admin/reviews/" + id));
assert.equal(
  new URL(saved.previewUrl).origin,
  origin,
  "Preview verification must remain local",
);
const preview = await expectStatus(await fetch(saved.previewUrl), 200);
assert.match(preview.headers.get("Cache-Control"), /no-store/);
assert.match(preview.headers.get("X-Robots-Tag"), /noindex/);
const previewHtml = await preview.text();
assert(previewHtml.includes("Public fixture body"));
assert(!previewHtml.includes("<script>window.runtimeUnsafe=true</script>"));
assert(!(await rss("rss.xml")).includes(title));
await expectStatus(
  await request(
    `/admin/api/reviews/${id}/publish`,
    json(
      "POST",
      { revision: saved.revision },
      { Origin: origin, Authorization: `Bearer ${submit}` },
    ),
  ),
  401,
);
const login = await expectStatus(
  await request(
    "/admin/api/login",
    json("POST", { key: reviewer }, { Origin: origin }),
  ),
  200,
);
const setCookie = login.headers.get("Set-Cookie");
assert.match(
  setCookie,
  /HttpOnly; Secure; SameSite=Strict; Path=\/admin\//,
);
const cookie = setCookie?.split(";")[0];
assert(cookie);
await expectStatus(
  await request(
    `/admin/api/reviews/${id}/publish`,
    json(
      "POST",
      { revision: saved.revision },
      { Origin: "https://invalid.example", Cookie: cookie },
    ),
  ),
  403,
);
await expectStatus(
  await request("/admin/api/session", {
    headers: { Cookie: "blog_review=expired.invalid" },
  }),
  401,
);
await expectStatus(
  await request(
    `/admin/api/reviews/${id}/publish?token=${new URL(saved.previewUrl).searchParams.get("token")}`,
    json("POST", { revision: saved.revision }, { Origin: origin }),
  ),
  401,
);
const admin = (path, method, body) =>
  request(
    "/admin/api/" + path,
    json(method, body, { Origin: origin, Cookie: cookie }),
  );
const approval = await (
  await expectStatus(
    await admin(`reviews/${id}/publish`, "POST", { revision: saved.revision }),
    200,
  )
).json();
assert.equal(approval.revision, saved.revision);
assert.equal(approval.status, "published");
assert(!Number.isNaN(Date.parse(approval.publishedAt)));
assert((await rss("rss.xml")).includes(title));
assert(
  (
    await (await expectStatus(await request(approval.url), 200)).text()
  ).includes("Public fixture body"),
);
const edited = await (
  await expectStatus(
    await admin(`reviews/${id}`, "PUT", {
      data: { ...data, title: privateMarker },
      body: "Private updated body",
      expectedRevision: saved.revision,
    }),
    200,
  )
).json();
assert.notEqual(edited.revision, saved.revision);
await expectStatus(
  await admin(`reviews/${id}/publish`, "POST", { revision: saved.revision }),
  409,
);
await expectStatus(
  await admin(`reviews/${id}`, "PUT", {
    data: { ...data, title: "Conflicting write" },
    body: "Conflicting body",
    expectedRevision: saved.revision,
  }),
  409,
);
const unchangedFeed = await rss("rss.xml");
assert(unchangedFeed.includes(title) && !unchangedFeed.includes(privateMarker));
const unchangedPage = await (await request(approval.url)).text();
assert(unchangedPage.includes(title) && !unchangedPage.includes(privateMarker));
const audit = await (
  await expectStatus(
    await request(`/admin/api/reviews/${id}/audit`, {
      headers: { Cookie: cookie },
    }),
    200,
  )
).json();
assert(
  audit.items.some(
    (item) => item.revision === saved.revision && item.actor === "operator",
  ),
);
checks.push(
  "producer draft, safe capability preview, reviewer approval, audit, private edits and stale 409 conflicts",
);

// Dates before baseline content keep the shared preview home fixture stable.
const episodeDate = `1999-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
const bytes = new Uint8Array(
  await (await expectStatus(await request(audioPath), 200)).arrayBuffer(),
);
const hash = createHash("sha256").update(bytes).digest("hex");
const episodePath = `/audio/${episodeDate}/${hash}.mp3`;
const episodeData = {
  title: "Runtime episode " + suffix,
  summary: "Local protocol verification",
  date: episodeDate,
  duration: 30,
  disclosure: "AI fixture voice",
  chapters: [
    { title: "Opening", start: 0 },
    { title: "Next", start: 5 },
  ],
  audio: {
    url: origin + episodePath,
    length: bytes.length,
    type: "audio/mpeg",
  },
};
const current = await (
  await expectStatus(
    await request(`/api/episodes/${episodeDate}`, {
      headers: { Authorization: `Bearer ${submit}` },
    }),
    200,
  )
).json();
const payload = {
  data: episodeData,
  body: "## Runtime local episode",
  expectedRevision: current.draft_revision,
};
await expectStatus(
  await ingest("episodes/" + episodeDate, {
    ...payload,
    data: {
      ...episodeData,
      audio: { ...episodeData.audio, length: bytes.length + 1 },
    },
  }),
  422,
);
await expectStatus(
  await request(`/api/audio/${episodeDate}/${hash}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${submit}`,
      "Content-Type": "audio/mpeg",
      "Content-Length": String(bytes.length),
    },
    body: bytes,
  }),
  200,
);
const published = await (
  await expectStatus(await ingest("episodes/" + episodeDate, payload), 200)
).json();
assert.equal(published.status, "published");
const repeated = await (
  await expectStatus(await ingest("episodes/" + episodeDate, payload), 200)
).json();
assert.equal(repeated.revision, published.revision);
const updatedPodcast = await rss("episodes/rss.xml");
assert(
  updatedPodcast.includes(
    `<guid isPermaLink="true">${origin}/episodes/${episodeDate}/</guid>`,
  ),
);
assert(
  updatedPodcast.includes(
    `url="${origin + episodePath}" length="${bytes.length}" type="audio/mpeg"`,
  ),
);
assert(updatedPodcast.includes("<itunes:duration>30</itunes:duration>"));
assert.equal(
  updatedPodcast.split(
    `<guid isPermaLink="true">${origin}/episodes/${episodeDate}/</guid>`,
  ).length - 1,
  1,
);
assert((await rss("rss.xml")).includes(episodeData.title));
checks.push(
  "existing audio upload and automatic episode publication contract, retry identity and live RSS refresh",
);
console.log(
  JSON.stringify(
    {
      status: "passed",
      origin,
      checks,
      isolatedReview: id,
      isolatedEpisode: episodeDate,
    },
    null,
    2,
  ),
);
