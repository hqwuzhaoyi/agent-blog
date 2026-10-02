import { createFileRoute } from "@tanstack/react-router";
import { getPublicContent } from "../server/public-data";
import { EpisodeRow } from "../features/public/content";
import { siteConfig } from "../site";
export const Route = createFileRoute("/agent-blog/episodes/")({
  loader: () => getPublicContent(),
  head: () => ({
    meta: [
      { title: `${siteConfig.episodes.title} · ${siteConfig.title}` },
      { name: "description", content: siteConfig.episodes.description },
    ],
  }),
  component: Episodes,
});
function Episodes() {
  const { episodes } = Route.useLoaderData();
  return (
    <section className="mx-auto max-w-3xl py-12">
      <h1 className="text-3xl font-semibold">{siteConfig.episodes.title}</h1>
      <p className="mt-3 text-muted-foreground">
        {siteConfig.episodes.description}
      </p>
      <ul className="mt-6">
        {episodes.map((episode) => (
          <EpisodeRow key={episode.id} episode={episode} />
        ))}
      </ul>
      {!episodes.length && <p className="mt-6">{siteConfig.episodes.empty}</p>}
    </section>
  );
}
