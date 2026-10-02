import { Link } from "@tanstack/react-router";
import type { PublishedEntry } from "../../../../cloudflare/content-models";
import { usePlayerActions, timestamp } from "./player/provider";
import { Button } from "./beui/button";
import { siteConfig } from "../../site";
export function displayDate(date: Date) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
export function EpisodeRow({
  episode,
}: {
  episode: PublishedEntry<"episodes">;
}) {
  const { play } = usePlayerActions();
  return (
    <li className="flex items-center gap-4 border-b border-border py-5">
      <Link
        to="/agent-blog/episodes/$id"
        params={{ id: episode.id }}
        className="min-w-0 flex-1"
      >
        <p className="text-sm text-muted-foreground">
          {displayDate(episode.data.date)} · {timestamp(episode.data.duration)}
        </p>
        <span className="text-lg font-semibold">{episode.data.title}</span>
        <p className="mt-1 text-sm text-muted-foreground">
          {episode.data.summary}
        </p>
      </Link>
      <Button
        variant="outline"
        onClick={() => play(episode)}
        aria-label={`${siteConfig.player.play} ${episode.data.title}`}
      >
        {siteConfig.player.play}
      </Button>
    </li>
  );
}
export function ReviewRow({ review }: { review: PublishedEntry<"reviews"> }) {
  return (
    <li className="border-b border-border py-5">
      <p className="text-sm text-muted-foreground">
        {displayDate(review.data.date)} · {review.data.source}
      </p>
      <Link
        to="/agent-blog/reviews/$id"
        params={{ id: review.id }}
        className="text-lg font-semibold"
      >
        {review.data.title}
      </Link>
      <p className="mt-1 text-muted-foreground">{review.data.summary}</p>
    </li>
  );
}
