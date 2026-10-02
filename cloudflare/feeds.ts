import { normalizedRequest, normalizeAudioUrl, legacyOrigin, productionOrigin } from "./site-urls";
import preferences from "../src/blog.config.json";
import { publishedEntries } from "../src/lib/content-store";
import type { ContentDatabase, PublishedEntry } from "./content-models";

export interface FeedConfig {
  title: string;
  description: string;
  language: string;
  episodes: { title: string; description: string; disclosure: string };
}
const chinese = preferences.language === "zh-CN";
const defaultConfig: FeedConfig = {
  title: preferences.title || (chinese ? "早咖啡" : "Morning Coffee"),
  description:
    preferences.tagline ||
    (chinese
      ? "记录持续推进的项目中已经完成的重要工作。"
      : "Daily notes on important work completed across ongoing projects."),
  language: chinese ? "zh-CN" : "en",
  episodes: chinese
    ? {
        title: "早咖啡",
        description: "用几分钟，听听 AI 构建者的新想法，以及它们与你的关系。",
        disclosure: "AI 配音，独立编稿。来源与编辑观点见下文。",
      }
    : {
        title: "Morning Coffee",
        description:
          "A few minutes of AI builder stories, sources, and editorial perspective.",
        disclosure:
          "AI-narrated, independently written. Sources and commentary are identified below.",
      },
};
const xml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );

function item(
  entry: PublishedEntry<"reviews"> | PublishedEntry<"episodes">,
  origin: string,
  config: FeedConfig,
) {
  const link = `${origin}/${entry.collection}/${encodeURIComponent(entry.id)}/`;
  const guid = [productionOrigin, legacyOrigin].includes(origin) ? `${legacyOrigin}/agent-blog/${entry.collection}/${encodeURIComponent(entry.id)}/` : link;
  const episode =
    entry.collection === "episodes"
      ? (entry as PublishedEntry<"episodes">)
      : undefined;
  const description = episode
    ? `${entry.data.summary}\n\n${config.episodes.disclosure}`
    : entry.data.summary;
  const categories = episode
    ? ["早咖啡"]
    : (entry as PublishedEntry<"reviews">).data.platforms;
  return `<item><title>${xml(entry.data.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(guid)}</guid><description>${xml(description)}</description><pubDate>${entry.data.date.toUTCString()}</pubDate>${episode ? `<itunes:duration>${Math.round(episode.data.duration)}</itunes:duration>` : ""}${categories.map((category) => `<category>${xml(category)}</category>`).join("")}${episode ? `<enclosure url="${xml(normalizeAudioUrl(episode.data.audio.url, origin))}" length="${episode.data.audio.length}" type="${episode.data.audio.type}"/>` : ""}</item>`;
}

/** Feeds query the published pointer per request, independently of page rendering. */
export async function handleFeeds(
  request: Request,
  env: { CONTENT?: ContentDatabase; PUBLIC_ORIGIN?: string },
  config: FeedConfig = defaultConfig,
): Promise<Response | undefined> {
  request = normalizedRequest(request);
  const url = new URL(request.url);
  const podcast = url.pathname === "/episodes/rss.xml";
  if (!podcast && url.pathname !== "/rss.xml") return undefined;
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  if (!env.CONTENT)
    return new Response("Content database unavailable", { status: 503 });
  const episodes = await publishedEntries<"episodes">(env.CONTENT, "episode");
  const entries: (PublishedEntry<"reviews"> | PublishedEntry<"episodes">)[] =
    podcast
      ? episodes
      : [
          ...(await publishedEntries<"reviews">(env.CONTENT, "review")),
          ...episodes,
        ];
  entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const origin = new URL(env.PUBLIC_ORIGIN || request.url).origin;
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>${xml(podcast ? config.episodes.title : config.title)}</title><description>${xml(podcast ? config.episodes.description : config.description)}</description><link>${xml(origin)}/</link><language>${xml(config.language)}</language>${podcast ? "<itunes:explicit>false</itunes:explicit>" : ""}${entries.map((entry) => item(entry, origin, config)).join("")}</channel></rss>`;
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": "application/xml;charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
