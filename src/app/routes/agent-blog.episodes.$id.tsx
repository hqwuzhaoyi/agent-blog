import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedEpisode } from "../server/public-data";
import {
  EpisodePlayer,
  Chapters,
  timestamp,
} from "../features/public/player/provider";
import { displayDate } from "../features/public/content";
import { siteConfig } from "../site";
export const Route = createFileRoute("/agent-blog/episodes/$id")({
  loader: async ({ params }) => {
    const episode = await getPublishedEpisode({ data: params.id });
    if (!episode) throw notFound();
    return episode;
  },
  head: ({ loaderData: episode }) =>
    episode
      ? {
          meta: [
            { title: `${episode.data.title} · ${siteConfig.title}` },
            { name: "description", content: episode.data.summary },
            { property: "og:title", content: episode.data.title },
            { property: "og:description", content: episode.data.summary },
            { property: "og:type", content: "article" },
          ],
          links: [
            {
              rel: "canonical",
              href: `https://blog.wuzhaoyi.xyz/agent-blog/episodes/${episode.id}/`,
            },
          ],
        }
      : {},
  component: Episode,
});
function Episode() {
  const episode = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-4xl py-12">
      <header>
        <p className="text-sm text-muted-foreground">
          {displayDate(episode.data.date)} · {timestamp(episode.data.duration)}
        </p>
        <h1 className="my-4 text-4xl font-semibold leading-tight">
          {episode.data.title}
        </h1>
        <p className="text-lg text-muted-foreground">{episode.data.summary}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {episode.data.disclosure}
        </p>
      </header>
      <EpisodePlayer episode={episode} />
      <div className="grid gap-10 md:grid-cols-[1fr_240px]">
        <section>
          <h2 className="mb-5 text-2xl font-semibold">
            {siteConfig.episodes.notes}
          </h2>
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: episode.html }}
          />
          <a href={episode.data.audio.url} className="mt-8 block">
            {siteConfig.episodes.download}
          </a>
        </section>
        <aside>
          <h2 className="mb-4 text-lg font-semibold">
            {siteConfig.episodes.chapters}
          </h2>
          <Chapters episode={episode} />
        </aside>
      </div>
    </article>
  );
}
