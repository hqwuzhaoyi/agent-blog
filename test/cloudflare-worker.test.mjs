import { describe, expect, test, vi } from "vitest";
import worker from "../cloudflare/worker.mjs";
const hash = "a".repeat(64);
const url = `https://blog.wuzhaoyi.xyz/agent-blog/audio/2026-10-01/${hash}.mp3`;
function bindings() {
  return {
    ASSETS: { fetch: vi.fn(() => new Response("site")) },
    AUDIO: {
      head: vi.fn(async () => ({ size: 100, httpEtag: '"test"', writeHttpMetadata: () => {} })),
      get: vi.fn(async (_key, options) => ({ body: new Uint8Array(options?.range?.length ?? 100) })),
    },
  };
}
describe("Cloudflare audio delivery", () => {
  test("serves requested bytes for podcast seeking", async () => {
    const env = bindings();
    const response = await worker.fetch(new Request(url, { headers: { Range: "bytes=20-39" } }), env);
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 20-39/100");
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect((await response.arrayBuffer()).byteLength).toBe(20);
    expect(env.AUDIO.get).toHaveBeenCalledWith(`episodes/2026-10-01/${hash}.mp3`, { range: { offset: 20, length: 20 } });
  });
  test("supports suffix ranges and rejects ranges outside the audio", async () => {
    const env = bindings();
    const suffix = await worker.fetch(new Request(url, { headers: { Range: "bytes=-10" } }), env);
    expect(suffix.headers.get("Content-Range")).toBe("bytes 90-99/100");
    const invalid = await worker.fetch(new Request(url, { headers: { Range: "bytes=100-" } }), env);
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("Content-Range")).toBe("bytes */100");
  });
  test("HEAD and conditional requests avoid reading the audio body", async () => {
    const env = bindings();
    const head = await worker.fetch(new Request(url, { method: "HEAD" }), env);
    expect(head.headers.get("Content-Length")).toBe("100");
    const cached = await worker.fetch(new Request(url, { headers: { "If-None-Match": '"test"' } }), env);
    expect(cached.status).toBe(304);
    expect(env.AUDIO.get).not.toHaveBeenCalled();
  });
  test("serves static pages and redirects the domain root to the existing blog path", async () => {
    const env = bindings();
    const root = await worker.fetch(new Request("https://blog.wuzhaoyi.xyz/"), env);
    expect(root.headers.get("Location")).toBe("https://blog.wuzhaoyi.xyz/agent-blog/");
    expect(await (await worker.fetch(new Request("https://blog.wuzhaoyi.xyz/agent-blog/"), env)).text()).toBe("site");
  });
  test("missing audio and unsupported methods have explicit responses", async () => {
    const env = bindings(); env.AUDIO.head.mockResolvedValue(null);
    expect((await worker.fetch(new Request(url), env)).status).toBe(404);
    expect((await worker.fetch(new Request(url, { method: "POST" }), env)).status).toBe(405);
  });
});
