import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function contentClient() {
  let config = {};
  try {
    config = JSON.parse(
      await readFile(resolve(".agent-blog/publication-client.json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const url =
    process.env.BLOG_PUBLICATION_URL ??
    config.url ??
    "https://blog.wuzhaoyi.xyz";
  const token = process.env.BLOG_SUBMIT_TOKEN ?? config.token;
  if (!token)
    throw new Error(
      "Configure BLOG_SUBMIT_TOKEN or private .agent-blog/publication-client.json",
    );
  return async (path, options = {}) => {
    const response = await fetch(new URL("/agent-blog/api/" + path, url), {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(`Publication API ${response.status}: ${result.error}`);
    return result;
  };
}
export async function submitContent(kind, id, data, body) {
  const api = await contentClient();
  const current = await api(`${kind}/${id}`);
  return api(`${kind}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      body,
      expectedRevision: current.draft_revision,
    }),
  });
}
