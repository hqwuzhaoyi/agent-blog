import { getCollection } from "astro:content";

export async function getPublishedReviews() {
  const reviews = await getCollection("reviews");
  return reviews.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export function formatReviewDate(date: Date, locale = "en") {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}
