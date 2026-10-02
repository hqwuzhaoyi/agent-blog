import { getCollection } from "astro:content";
import { siteConfig } from "@/site.config";

import { publishedEntries, type ContentDatabase } from "./content-store";
export async function getPublishedReviews(db?: ContentDatabase) {
  if (db) return publishedEntries<"reviews">(db, "review");
  const reviews = await getCollection("reviews");
  return reviews.sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export function formatReviewDate(date: Date, locale = siteConfig.locale) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}
