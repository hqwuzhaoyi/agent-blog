import deployment from "../src/site-origin.json";
export const configuredOrigin = deployment.origin;
export const legacyOrigin = "https://blog.wuzhaoyi.xyz";
export const productionOrigin = "https://gitlog.si";
export function rootPath(path: string) {
  return path === "/agent-blog" ? "/" : path.startsWith("/agent-blog/") ? path.slice(11) : path;
}
export function normalizeAudioUrl(value: string, origin: string) {
  try {
    const url = new URL(value);
    if (![legacyOrigin, productionOrigin, new URL(origin).origin].includes(url.origin)) return value;
    const path = rootPath(url.pathname);
    if (!/^\/audio\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.mp3$/.test(path)) return value;
    return new URL(path, origin).href;
  } catch { return value; }
}
export function normalizeEpisodeData<T extends { audio?: { url: string } }>(data: T, origin: string): T {
  return data.audio ? { ...data, audio: { ...data.audio, url: normalizeAudioUrl(data.audio.url, origin) } } : data;
}
export function normalizedRequest(request: Request) {
  const url = new URL(request.url);
  url.pathname = rootPath(url.pathname);
  return url.href === request.url ? request : new Request(url, request);
}
