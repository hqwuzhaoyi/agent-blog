import type { ContentDatabase, PublishedEntry } from "../../cloudflare/content-models";
export type { ContentDatabase } from "../../cloudflare/content-models";
interface ContentRow {
  id: string;
  data: string;
  body: string;
}

export async function publishedEntries<C extends "reviews" | "episodes">(
  db: ContentDatabase,
  kind: string,
): Promise<PublishedEntry<C>[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id,r.data,r.body FROM content_heads h
    JOIN content_revisions r ON r.kind=h.kind AND r.id=h.id AND r.revision=h.published_revision
    WHERE h.kind=? ORDER BY json_extract(r.data,'$.date') DESC`,
    )
    .bind(kind)
    .all<ContentRow>();
  return results.map((row) => ({
    id: row.id,
    body: row.body,
    collection: kind === "review" ? "reviews" : "episodes",
    data: {
      ...JSON.parse(row.data),
      date: new Date(JSON.parse(row.data).date),
    },
  })) as PublishedEntry<C>[];
}
export async function publishedEntry<C extends "reviews" | "episodes">(
  db: ContentDatabase,
  kind: string,
  id: string,
) {
  const row = await db
    .prepare(
      `SELECT r.id,r.data,r.body FROM content_heads h
    JOIN content_revisions r ON r.kind=h.kind AND r.id=h.id AND r.revision=h.published_revision
    WHERE h.kind=? AND h.id=?`,
    )
    .bind(kind, id)
    .first<ContentRow>();
  return row
    ? ({
        id: row.id,
        body: row.body,
        collection: kind === "review" ? "reviews" : "episodes",
        data: {
          ...JSON.parse(row.data),
          date: new Date(JSON.parse(row.data).date),
        },
      } as PublishedEntry<C>)
    : undefined;
}
