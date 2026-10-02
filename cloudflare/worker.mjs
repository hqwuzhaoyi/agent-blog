export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = /^\/(?:agent-blog\/)?audio\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]{64})\.mp3$/.exec(url.pathname);
    if (!match) return env.ASSETS.fetch(request);
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const key = `episodes/${match[1]}/${match[2]}.mp3`;
    const metadata = await env.AUDIO.head(key);
    if (!metadata) return new Response("Audio not found", { status: 404 });
    const headers = new Headers();
    metadata.writeHttpMetadata(headers);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("ETag", metadata.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (request.headers.get("If-None-Match") === metadata.httpEtag) return new Response(null, { status: 304, headers });
    let range;
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader && (!request.headers.has("If-Range") || request.headers.get("If-Range") === metadata.httpEtag)) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (parsed && (parsed[1] || parsed[2])) {
        let start = parsed[1] ? Number(parsed[1]) : Math.max(0, metadata.size - Number(parsed[2]));
        let end = parsed[1] && parsed[2] ? Math.min(Number(parsed[2]), metadata.size - 1) : metadata.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= metadata.size) {
          headers.set("Content-Range", `bytes */${metadata.size}`);
          return new Response(null, { status: 416, headers });
        }
        range = { offset: start, length: end - start + 1 };
        headers.set("Content-Range", `bytes ${start}-${end}/${metadata.size}`);
      }
    }
    headers.set("Content-Length", String(range?.length ?? metadata.size));
    if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
    const object = await env.AUDIO.get(key, range ? { range } : undefined);
    if (!object) return new Response("Audio not found", { status: 404 });
    return new Response(object.body, { status: range ? 206 : 200, headers });
  },
};
