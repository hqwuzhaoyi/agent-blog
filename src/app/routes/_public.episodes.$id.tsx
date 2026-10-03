import { ArrowLeft, Download, Info, ListMusic, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedEpisode } from "../server/public-data";
import {
  EpisodePlayer,
  Chapters,
  timestamp,
} from "../features/public/player/provider";
import { displayDate, EpisodeCover } from "../features/public/content";
import { EpisodeMaterials } from "../features/public/materials";
import { BouncyAccordion } from "../features/public/beui/bouncy-accordion";
import { siteConfig, siteOrigin } from "../site";
export const Route = createFileRoute("/_public/episodes/$id")({
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
              href: `${siteOrigin}/episodes/${episode.id}/`,
            },
          ],
        }
      : {},
  component: Episode,
});
function Episode() {
  const episode = Route.useLoaderData();
  return <article className="public-detail"><Link to="/episodes" className="detail-back"><ArrowLeft size={14} aria-hidden="true" />{siteConfig.episodes.back}</Link><header className="episode-detail-hero"><div><p className="eyebrow">MORNING COFFEE / {siteConfig.episodes.title}</p><div className="hero-meta"><time dateTime={episode.data.date.toISOString()}>{displayDate(episode.data.date)}</time><span>·</span><span>{timestamp(episode.data.duration)}</span></div><h1>{episode.data.title}</h1><p className="episode-detail-summary">{episode.data.summary}</p><EpisodePlayer episode={episode} /><p className="episode-disclosure"><Info size={13} aria-hidden="true" />{episode.data.disclosure}</p></div><EpisodeCover episode={episode} /></header><div className="detail-body-layout"><div className="episode-reading-column"><EpisodeMaterials episode={episode} /><section className="show-notes"><h2 className="notes-heading"><BookOpen size={20} aria-hidden="true" />{siteConfig.episodes.notes}</h2><div className="article-body" dangerouslySetInnerHTML={{ __html: episode.html }} /><a href={episode.data.audio.url} className="download-link"><Download size={14} aria-hidden="true" />{siteConfig.episodes.download}</a></section></div><aside className="detail-chapters" aria-label={siteConfig.episodes.chapters}><BouncyAccordion defaultValue="chapters" className="chapter-accordion" classNames={{ trigger: "chapter-accordion-trigger", description: "chapter-accordion-content" }} items={[{ id: "chapters", title: <span className="chapter-accordion-title">{siteConfig.episodes.chapters}<span>{episode.data.chapters.length}</span></span>, icon: <ListMusic size={19} aria-hidden="true" />, description: <Chapters episode={episode} /> }]} /></aside></div></article>;
}
