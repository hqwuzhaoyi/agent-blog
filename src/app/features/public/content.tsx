import { Link } from "@tanstack/react-router";
import {
  Play,
  Pause,
  Headphones,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import type { PublishedEntry } from "../../../../cloudflare/content-models";
import { usePlayback, timestamp } from "./player/provider";
import { cn } from "./beui/lib/utils";
import { Button } from "./beui/button";
import { siteConfig } from "../../site";
import { text } from "./locale";
export function displayDate(date: Date) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
export function EpisodeCover({
  episode,
  compact = false,
  className,
}: {
  episode: PublishedEntry<"episodes">;
  compact?: boolean;
  className?: string;
}) {
  const date = episode.data.date;
  return (
    <div
      className={cn(
        "episode-cover relative isolate flex flex-col justify-between overflow-hidden bg-[#254d3d] text-[#f3eddc] after:absolute after:inset-0 after:-z-10 after:bg-[radial-gradient(#e9e4d1_.6px,transparent_.6px)] after:bg-size-[5px_5px] after:opacity-[.14] after:content-['']",
        compact
          ? "episode-cover-compact aspect-[1.8] rounded-[11px] p-5 mobile:aspect-[1.85] mobile:p-[19px]"
          : "aspect-[1.04] rounded-[22px] p-7 shadow-[0_16px_40px_-28px_#153d2a55]",
        className,
      )}
      aria-label={`${siteConfig.episodes.title} · ${displayDate(date)}`}
    >
      <div
        className={cn(
          "cover-top flex justify-between font-medium leading-[1.4] tracking-[.17em]",
          compact ? "text-[8px]" : "text-[11px]",
        )}
      >
        <span>
          MORNING
          <br />
          COFFEE
        </span>
        <span className="text-right font-mono tracking-[.04em]">
          {date.getUTCFullYear()}
          <br />
          {String(date.getUTCMonth() + 1).padStart(2, "0")}.
          {String(date.getUTCDate()).padStart(2, "0")}
        </span>
      </div>
      <div
        className={cn(
          "cover-orbit absolute -z-10 grid place-items-center",
          compact
            ? "inset-x-[26%] inset-y-[8%]"
            : "inset-x-[19%] top-[19%] bottom-[12%]",
        )}
        aria-hidden="true"
      >
        <svg className="h-full w-full overflow-visible" viewBox="0 0 220 220">
          <circle
            fill="none"
            stroke="#f1ecd533"
            strokeWidth="1"
            cx="110"
            cy="110"
            r="103"
          />
          <circle
            fill="none"
            stroke="#f1ecd533"
            strokeWidth="1"
            cx="110"
            cy="110"
            r="74"
          />
          <circle
            fill="none"
            stroke="#f1ecd533"
            strokeWidth="1"
            cx="110"
            cy="110"
            r="45"
          />
          <path
            fill="none"
            stroke="#f1ecd5"
            strokeWidth={compact ? 6 : 8}
            strokeLinecap="round"
            d="M94 90v40m16-52v64m16-52v40"
          />
        </svg>
        <span
          className={cn(
            "cover-sun absolute top-[18%] right-[6%] rounded-full bg-[#ce8864]",
            compact
              ? "size-3.5 shadow-[0_0_0_4px_#ce88641a]"
              : "size-6.5 shadow-[0_0_0_7px_#ce88641a]",
          )}
        />
      </div>
      <div
        className={cn(
          "cover-bottom flex items-center justify-between font-[450] leading-[1.15] tracking-[-.06em]",
          compact ? "text-[24px]" : "text-[clamp(28px,3vw,45px)]",
        )}
      >
        <span>{siteConfig.episodes.title}</span>
        <Headphones size={18} aria-hidden="true" />
      </div>
    </div>
  );
}
export function EpisodeCard({
  episode,
}: {
  episode: PublishedEntry<"episodes">;
}) {
  const { episodeId, playing, toggleEpisode } = usePlayback();
  const active = episodeId === episode.id && playing;
  return (
    <li className="episode-card">
      <Link
        to="/episodes/$id"
        params={{ id: episode.id }}
        className="episode-card-art"
      >
        <EpisodeCover episode={episode} compact />
      </Link>
      <div className="episode-card-body">
        <p className="content-meta">
          <time dateTime={episode.data.date.toISOString()}>
            {displayDate(episode.data.date)}
          </time>
          <span>{timestamp(episode.data.duration)}</span>
        </p>
        <Link
          to="/episodes/$id"
          params={{ id: episode.id }}
          className="episode-card-title"
        >
          {episode.data.title}
        </Link>
        <p className="episode-card-summary">{episode.data.summary}</p>
        <Button
          variant="outline"
          className="card-play"
          onClick={() => toggleEpisode(episode)}
          aria-pressed={active}
          aria-label={`${active ? siteConfig.player.pause : siteConfig.player.play} ${episode.data.title}`}
        >
          {active ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} fill="currentColor" aria-hidden="true" />
          )}
          {active ? siteConfig.player.pause : siteConfig.player.play}
        </Button>
      </div>
    </li>
  );
}
export function EpisodeRow({
  episode,
}: {
  episode: PublishedEntry<"episodes">;
}) {
  const { episodeId, playing, toggleEpisode } = usePlayback();
  const active = episodeId === episode.id && playing;
  return (
    <li className="archive-entry">
      <span className="entry-icon">
        <Headphones size={19} aria-hidden="true" />
      </span>
      <Link
        to="/episodes/$id"
        params={{ id: episode.id }}
        className="entry-copy"
      >
        <p className="content-meta">
          {siteConfig.episodes.title}
          <span>
            {displayDate(episode.data.date)} ·{" "}
            {timestamp(episode.data.duration)}
          </span>
        </p>
        <h3>{episode.data.title}</h3>
        <p className="entry-summary">{episode.data.summary}</p>
      </Link>
      <Button
        variant="outline"
        className="entry-play"
        onClick={() => toggleEpisode(episode)}
        aria-pressed={active}
        aria-label={`${active ? siteConfig.player.pause : siteConfig.player.play} ${episode.data.title}`}
      >
        {active ? (
          <Pause size={14} aria-hidden="true" />
        ) : (
          <Play size={14} fill="currentColor" aria-hidden="true" />
        )}
        <span>{active ? siteConfig.player.pause : siteConfig.player.play}</span>
      </Button>
    </li>
  );
}
export function ReviewRow({ review }: { review: PublishedEntry<"reviews"> }) {
  return (
    <li className="review-entry">
      <div className="review-date">
        <CalendarDays size={16} aria-hidden="true" />
        <time dateTime={review.data.date.toISOString()}>
          {displayDate(review.data.date)}
        </time>
      </div>
      <Link
        to="/reviews/$id"
        params={{ id: review.id }}
        className="review-copy"
      >
        <p className="content-meta">{review.data.source}</p>
        <h3>{review.data.title}</h3>
        <p className="entry-summary">{review.data.summary}</p>
        <span className="read-link">
          {siteConfig.review.read}
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>
          {title}
          {count !== undefined && (
            <span className="section-count">{count}</span>
          )}
        </h2>
      </div>
      {children}
    </div>
  );
}
export function EmptyContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-empty">
      <span className="entry-icon">
        <Headphones size={22} aria-hidden="true" />
      </span>
      <p>{children}</p>
    </div>
  );
}
