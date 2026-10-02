import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { publishedEntries, publishedEntry } from "../../lib/content-store";
import { renderMarkdown } from "../../lib/markdown";
export const getPublicContent = createServerFn({ method: "GET" }).handler(
  async () => {
    const [reviews, episodes] = await Promise.all([
      publishedEntries<"reviews">(env.CONTENT, "review"),
      publishedEntries<"episodes">(env.CONTENT, "episode"),
    ]);
    return { reviews, episodes };
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
      ? { ...episode, html: renderMarkdown(episode.body ?? "") }
      : null;
  });
