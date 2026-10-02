import { ArrowLeft, Download, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedEpisode } from "../server/public-data";
import {
  EpisodePlayer,
  Chapters,
  timestamp,
} from "../features/public/player/provider";
import { displayDate, EpisodeCover } from "../features/public/content";
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
  return <article className="public-detail"><Link to="/agent-blog/episodes" className="detail-back"><ArrowLeft size={14} aria-hidden="true" />{siteConfig.episodes.back}</Link><header className="episode-detail-hero"><div><p className="eyebrow">MORNING COFFEE / {siteConfig.episodes.title}</p><div className="hero-meta"><time dateTime={episode.data.date.toISOString()}>{displayDate(episode.data.date)}</time><span>·</span><span>{timestamp(episode.data.duration)}</span></div><h1>{episode.data.title}</h1><p className="episode-detail-summary">{episode.data.summary}</p><EpisodePlayer episode={episode} /><p className="episode-disclosure"><Info size={13} aria-hidden="true" />{episode.data.disclosure}</p></div><EpisodeCover episode={episode} /></header><div className="detail-body-layout"><section className="show-notes"><p className="eyebrow">THE STORY & SOURCES</p><h2>{siteConfig.episodes.notes}</h2><div className="article-body" dangerouslySetInnerHTML={{ __html: episode.html }} /><a href={episode.data.audio.url} className="download-link"><Download size={14} aria-hidden="true" />{siteConfig.episodes.download}</a></section><aside className="detail-chapters"><p className="eyebrow">CHAPTERS</p><h2>{siteConfig.episodes.chapters}</h2><Chapters episode={episode} /></aside></div></article>;
}
