import type { CollectionEntry } from "astro:content";
import { reviewPath } from "./paths";
import type { ReviewPresentation } from "../themes/shared/contracts";

export function presentReview(
  review: CollectionEntry<"reviews">,
  locale: string,
): ReviewPresentation {
  const dateTime = review.data.date.toISOString();
  const displayDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(review.data.date);
  const compactDate = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(review.data.date).toUpperCase();

  return {
    id: review.id,
    title: review.data.title,
    summary: review.data.summary,
    source: review.data.source,
    url: reviewPath(review.id),
    dateTime,
    displayDate,
    compactDate,
    shortYear: String(review.data.date.getUTCFullYear()).slice(-2),
    highlights: review.data.highlights,
    platforms: review.data.platforms.join(" + "),
  };
}
