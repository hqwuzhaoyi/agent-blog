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
import { EpisodeSources } from "../features/public/materials";
import { BouncyAccordion } from "../features/public/beui/bouncy-accordion";
import { siteConfig, siteOrigin } from "../site";
import { text } from "../features/public/locale";
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
  const sections = [
    { id: "shownotes", label: siteConfig.episodes.notes },
    ...(episode.data.materials?.length || episode.data.timeline?.length
      ? [{ id: "episode-materials-title", label: text("咖啡豆", "Coffee beans") }]
      : []),
  ];
  return (
    <article className="public-detail pt-[45px] mobile:pt-7">
      <Link
        to="/episodes"
        className="detail-back group mb-7 inline-flex items-center gap-2 text-[11px] text-muted-foreground mobile:mb-[23px] mobile:text-[10px]"
      >
        <ArrowLeft
          className="transition-transform duration-[160ms] ease-[var(--ease-out)] pointer-hover:group-hover:-translate-x-[3px] motion-reduce:transform-none motion-reduce:transition-none"
          size={14}
          aria-hidden="true"
        />
        {siteConfig.episodes.back}
      </Link>
      <header className="episode-detail-hero grid grid-cols-[1.5fr_.65fr] items-center gap-[65px] pt-[5px] pb-10 tablet:gap-10 mobile:grid-cols-1 mobile:gap-0 mobile:pb-6">
        <div>
          <p className="eyebrow">
            MORNING COFFEE / {siteConfig.episodes.title}
          </p>
          <div className="hero-meta">
            <time dateTime={episode.data.date.toISOString()}>
              {displayDate(episode.data.date)}
            </time>
            <span>·</span>
            <span>{timestamp(episode.data.duration)}</span>
          </div>
          <h1 className="my-[17px] text-[clamp(32px,4vw,52px)] font-[650] leading-[1.3] tracking-[-.05em] mobile:text-[36px] mobile:leading-[1.35]">
            {episode.data.title}
          </h1>
          <p className="episode-detail-summary text-[17px] text-muted-foreground leading-[1.8] mobile:text-[14px]">
            {episode.data.summary}
          </p>
          <EpisodePlayer episode={episode} />
          <p className="episode-disclosure mt-5 flex max-w-[620px] items-start gap-[7px] text-[11px] text-muted-foreground mobile:text-[10px] mobile:leading-[1.8]">
            <Info className="mt-[3px]" size={13} aria-hidden="true" />
            {episode.data.disclosure}
          </p>
        </div>
        <EpisodeCover episode={episode} className="mobile:hidden" />
      </header>
      <div className="detail-body-layout grid grid-cols-[minmax(0,720px)_265px] gap-[65px] items-start border-t border-border pt-9.5 tablet:gap-[35px] tablet:grid-cols-[minmax(0,1fr)_240px] mobile:grid-cols-[1fr] mobile:gap-7.5 mobile:pt-[25px]">
        <div className="episode-reading-column min-w-0">
          <section className="show-notes">
            <h2
              id="shownotes"
              className="notes-heading mb-6.5 flex scroll-mt-8 items-center gap-2.5 text-[21px] font-semibold mobile:text-[20px]"
            >
              <BookOpen size={20} aria-hidden="true" />
              {siteConfig.episodes.notes}
            </h2>
            <div
              className="article-body leading-[1.95]"
              dangerouslySetInnerHTML={{ __html: episode.html }}
            />
            <a
              href={episode.data.audio.url}
              className="download-link inline-flex items-center gap-2 py-3 px-[19px] border border-border rounded-[999px] text-[12px] mt-7"
            >
              <Download size={14} aria-hidden="true" />
              {siteConfig.episodes.download}
            </a>
          </section>
          <EpisodeSources episode={episode} />
        </div>
        <aside
          className="detail-chapters sticky top-6 max-h-[calc(100dvh-48px)] min-w-0 overflow-y-auto mobile:static mobile:row-start-1 mobile:max-h-none mobile:overflow-visible"
          aria-label={text("节目目录与章节", "Episode contents and chapters")}
        >
          <nav
            aria-label={text("本期导航", "Episode navigation")}
            className="mb-5"
          >
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              {text("本页", "On this page")}
            </p>
            <div className="flex flex-col border-l border-border mobile:flex-row mobile:flex-wrap mobile:gap-x-4 mobile:border-0">
              {sections.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="-ml-px inline-flex min-h-7 items-center border-l border-transparent px-3 text-[12px] text-muted-foreground transition-colors pointer-hover:hover:border-primary pointer-hover:hover:text-primary focus-visible:text-primary touch:min-h-11 mobile:ml-0 mobile:border-0 mobile:px-0"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
          <div
            id="chapters"
            className="scroll-mt-8 border-t border-border pt-2"
          >
            <BouncyAccordion
              defaultValue="chapters"
              className="chapter-accordion"
              classNames={{
                item: "bg-transparent",
                trigger: "chapter-accordion-trigger min-h-11 gap-2 px-0 py-0",
                title: "text-[12px] font-medium",
                icon: "size-4",
                chevron: "size-4",
                content: "[&>div]:px-0 [&>div]:pb-0",
                description: "chapter-accordion-content",
              }}
              items={[
                {
                  id: "chapters",
                  title: (
                    <span className="chapter-accordion-title flex items-center gap-2.5">
                      {siteConfig.episodes.chapters}
                      <span className="font-mono text-[11px] font-normal text-muted-foreground">
                        {episode.data.chapters.length}
                      </span>
                    </span>
                  ),
                  icon: <ListMusic size={15} aria-hidden="true" />,
                  description: <Chapters episode={episode} variant="detail" />,
                },
              ]}
            />
          </div>
        </aside>
      </div>
    </article>
  );
}
