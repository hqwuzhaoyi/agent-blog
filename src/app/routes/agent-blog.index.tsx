import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicContent } from "../server/public-data";
import { siteConfig } from "../site";
import {
  EpisodePlayer,
  Chapters,
  timestamp,
} from "../features/public/player/provider";
import { EpisodeRow, ReviewRow, displayDate } from "../features/public/content";
export const Route = createFileRoute("/agent-blog/")({
  loader: () => getPublicContent(),
  head: () => ({
    meta: [
      { title: siteConfig.title },
      { name: "description", content: siteConfig.description },
    ],
  }),
  component: Home,
});
function Home() {
  const { episodes, reviews } = Route.useLoaderData();
  const latest = episodes[0];
  return (
    <>
      <section className="grid gap-10 border-b border-border py-12 md:grid-cols-[1.4fr_1fr]">
        {latest ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">
                {siteConfig.episodes.latest} · {displayDate(latest.data.date)} ·{" "}
                {timestamp(latest.data.duration)}
              </p>
              <h1 className="my-4 text-4xl font-semibold leading-tight">
                {latest.data.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {latest.data.summary}
              </p>
              <EpisodePlayer episode={latest} />
              <Link to="/agent-blog/episodes/$id" params={{ id: latest.id }}>
                {siteConfig.episodes.notes} →
              </Link>
            </div>
            <aside className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm uppercase tracking-widest text-muted-foreground">
                Morning Coffee
              </p>
              <h2 className="my-4 text-2xl font-semibold">
                {siteConfig.episodes.chapters}
              </h2>
              <Chapters episode={latest} />
            </aside>
          </>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold">
              {siteConfig.episodes.title}
            </h1>
            <p className="mt-4">{siteConfig.episodes.empty}</p>
          </div>
        )}
      </section>
      <div className="grid gap-12 py-10 md:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {siteConfig.episodes.archive}
            </h2>
            <Link to="/agent-blog/episodes">{siteConfig.episodes.back} →</Link>
          </div>
          <ul>
            {episodes.slice(0, 5).map((episode) => (
              <EpisodeRow key={episode.id} episode={episode} />
            ))}
          </ul>
          {!episodes.length && <p>{siteConfig.episodes.empty}</p>}
        </section>
        <section>
          <h2 className="text-2xl font-semibold">{siteConfig.home.latest}</h2>
          <ul>
            {reviews.slice(0, 5).map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </ul>
          {!reviews.length && <p>{siteConfig.home.empty}</p>}
        </section>
      </div>
    </>
  );
}
