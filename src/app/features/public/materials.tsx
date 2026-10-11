import {
  ExternalLink,
  Headphones,
  Newspaper,
  Play,
  FileText,
} from "lucide-react";
import type {
  PublishedEntry,
  EpisodeMaterial,
} from "../../../../cloudflare/content-models";
import { Button } from "./beui/button";
import { cn } from "./beui/lib/utils";
import { usePlayback, timestamp } from "./player/provider";
import { siteConfig } from "../../site";
import { text } from "./locale";
import { mergeEpisodeSources, type EpisodeSource } from "./episode-sources";

const platforms = {
  x: "X",
  podcast: text("播客", "Podcast"),
  article: text("文章", "Article"),
};
const avatarClass =
  "material-avatar grid h-9 basis-9 shrink-0 grow-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_9%,var(--background))] object-cover text-[15px] font-semibold text-primary transition-transform duration-150 ease-[var(--ease-out-quint)] mobile:h-7.5 mobile:basis-7.5 mobile:text-[13px]";
const summaryClass =
  "whitespace-pre-line text-[14px] leading-[1.85] wrap-anywhere mobile:text-[13px]";
const selectedClass = "rounded bg-primary/7 px-[5px] py-px text-primary";
const sourceLabel = (item: Pick<EpisodeMaterial, "linkKind">) =>
  item.linkKind === "playlist"
    ? text("查看播放列表", "Open playlist")
    : item.linkKind === "channel"
      ? text("查看频道", "Open channel")
      : text("查看原文", "Open original");
function sourceDate(value: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
function SourceByline({ item }: { item: EpisodeSource }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2 text-[13px] leading-[1.5]">
        <strong className="min-w-0 font-[650] wrap-anywhere">
          {item.author}
        </strong>
        {item.handle && (
          <span className="text-[11px] text-muted-foreground wrap-anywhere">
            @{item.handle.replace(/^@/, "")}
          </span>
        )}
        {item.selected && (
          <span className={cn(selectedClass, "text-[11px]")}>
            {text("入选本期", "Selected")}
          </span>
        )}
      </div>
      <div className="material-meta mt-[5px] flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground mobile:gap-x-[9px] mobile:gap-y-1.5">
        <span className="inline-flex items-center gap-1">
          {item.kind === "podcast" ? (
            <Headphones size={12} aria-hidden="true" />
          ) : item.kind === "article" ? (
            <FileText size={12} aria-hidden="true" />
          ) : null}
          {platforms[item.kind]}
        </span>
        {item.publishedAt && (
          <time
            dateTime={item.publishedAt}
            title={text("原始发表时间", "Originally published")}
          >
            {sourceDate(item.publishedAt)}
          </time>
        )}
      </div>
    </>
  );
}
function SourceLink({
  item,
  muted = false,
}: {
  item: EpisodeSource;
  muted?: boolean;
}) {
  return (
    <a
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 text-[11px] transition-colors duration-150 ease-[var(--ease-out-quint)] mobile:min-h-11",
        muted && "text-muted-foreground",
      )}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {sourceLabel(item)}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

/** Selected sources and the captured feed share one URL-deduplicated reading list. */
export function EpisodeSources({
  episode,
}: {
  episode: PublishedEntry<"episodes">;
}) {
  const { play } = usePlayback();
  const sources = mergeEpisodeSources(
    episode.data.materials,
    episode.data.timeline,
  );
  if (!sources.length) return null;
  return (
    <section className="mb-11 pt-11" aria-labelledby="episode-materials-title">
      <header className="mb-5.5">
        {/* Preserve links shared before the two source lists were combined. */}
        <span
          id="episode-timeline-title"
          className="block scroll-mt-8"
          aria-hidden="true"
        />
        <h2
          id="episode-materials-title"
          className="m-0 flex scroll-mt-8 items-center gap-2.5 text-[21px] font-semibold"
        >
          <Newspaper size={20} aria-hidden="true" />
          {text("咖啡豆", "Coffee beans")}
          <span className="section-count">{sources.length}</span>
        </h2>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          {text(
            "每天几颗 AI 新鲜事，随咖啡一起读。",
            "A few fresh AI stories to read with your coffee.",
          )}
        </p>
      </header>
      <ol className="divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-card">
        {sources.map((item) => {
          const chapter = episode.data.chapters.find(
            (chapter) => chapter.start === item.chapterStart,
          );
          return (
            <li
              key={item.url}
              className={cn(
                "border-l-2",
                item.selected ? "border-l-primary" : "border-l-transparent",
              )}
            >
              <article className="material-card flex gap-3.5 py-4.5 pr-6 pl-5.5 mobile:gap-2.5 mobile:py-3.5 mobile:pr-3.5 mobile:pl-3">
                {item.kind === "x" && item.handle ? (
                  <img
                    className={avatarClass}
                    src={`https://unavatar.io/x/${item.handle.replace(/^@/, "")}?fallback=false`}
                    alt=""
                    width="36"
                    height="36"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={avatarClass} aria-hidden="true">
                    {Array.from(item.author)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <SourceByline item={item} />
                  {item.title && (
                    <h3 className="mt-2.5 text-[14px] font-semibold leading-[1.6] wrap-anywhere">
                      {item.title}
                    </h3>
                  )}
                  {item.summary && (
                    <p className={cn("mt-2.5", summaryClass)}>{item.summary}</p>
                  )}
                  {item.text &&
                    (item.summary ? (
                      <details className="mt-2 text-[12px] text-muted-foreground">
                        <summary className="cursor-pointer py-1 pointer-hover:hover:text-primary touch:min-h-11 touch:py-3">
                          {text("展开原文", "Original post")}
                        </summary>
                        <p className="mt-2 text-[13px] leading-[1.8] whitespace-pre-line wrap-anywhere">
                          {item.text}
                        </p>
                      </details>
                    ) : (
                      <p className="mt-2 text-[13px] leading-[1.8] whitespace-pre-line text-muted-foreground wrap-anywhere">
                        {item.text}
                      </p>
                    ))}
                  <div className="material-actions mt-[9px] flex flex-wrap items-center gap-x-4 gap-y-1">
                    <SourceLink item={item} muted={!item.selected} />
                    {chapter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-9 max-w-full justify-start px-2.5 py-[7px] text-left text-[11px] leading-[1.6] whitespace-normal mobile:min-h-11"
                        onClick={() => play(episode, chapter.start)}
                        aria-label={`${text("播放对应章节", "Play related chapter")}：${chapter.title}`}
                      >
                        <Play size={12} aria-hidden="true" />
                        {timestamp(chapter.start)}
                        <span className="min-w-0 wrap-anywhere">
                          {chapter.title}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
