import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { normalizeEpisodeData, productionOrigin } from "../../../cloudflare/site-urls";
import { env } from "cloudflare:workers";
import { publishedEntries, publishedEntry } from "../../lib/content-store";
import { renderMarkdown } from "../../lib/markdown";
function audioPresentationOrigin() {
  const requestUrl = new URL(getRequest().url);
  return ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname)
    ? requestUrl.origin
    : env.PUBLIC_ORIGIN || productionOrigin;
}
export const getPublicReviews = createServerFn({ method: "GET" }).handler(
  () => publishedEntries<"reviews">(env.CONTENT, "review"),
);
export const getPublicContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const [reviews, episodes] = await Promise.all([
      publishedEntries<"reviews">(env.CONTENT, "review"),
      publishedEntries<"episodes">(env.CONTENT, "episode"),
    ]);
    const origin = audioPresentationOrigin();
    return { reviews, episodes: episodes.map(episode => ({ ...episode, data: normalizeEpisodeData(episode.data, origin) })) };
  },
);
export const getPublishedReview = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const review = await publishedEntry<"reviews">(env.CONTENT, "review", id);
    return review
      ? { ...review, html: renderMarkdown(review.body ?? "") }
      : null;
  });
export const getPublishedEpisode = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const episode = await publishedEntry<"episodes">(
      env.CONTENT,
      "episode",
      id,
    );
    return episode
      ? { ...episode, data: normalizeEpisodeData(episode.data, audioPresentationOrigin()), html: renderMarkdown(episode.body ?? "") }
      : null;
  });
