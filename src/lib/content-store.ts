import type { CollectionEntry } from "astro:content";
export interface ContentDatabase {
  prepare(sql: string): {
    bind(...values: unknown[]): any;
    all<T>(): Promise<{ results: T[] }>;
  };
}
export async function publishedEntries<C extends "reviews" | "episodes">(
  db: ContentDatabase,
  kind: string,
): Promise<CollectionEntry<C>[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id,r.data,r.body FROM content_heads h
    JOIN content_revisions r ON r.kind=h.kind AND r.id=h.id AND r.revision=h.published_revision
    WHERE h.kind=? ORDER BY json_extract(r.data,'$.date') DESC`,
    )
    .bind(kind)
    .all();
  return results.map((row: any) => ({
    id: row.id,
    body: row.body,
    collection: kind === "review" ? "reviews" : "episodes",
    data: {
      ...JSON.parse(row.data),
      date: new Date(JSON.parse(row.data).date),
    },
  })) as CollectionEntry<C>[];
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
    .first();
  return row
    ? ({
        id: row.id,
        body: row.body,
        collection: kind === "review" ? "reviews" : "episodes",
        data: {
          ...JSON.parse(row.data),
          date: new Date(JSON.parse(row.data).date),
        },
      } as CollectionEntry<C>)
    : undefined;
}
