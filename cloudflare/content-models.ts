import type { z } from "zod";
import { episodeMaterialSchema } from "../src/lib/episode-materials.mjs";
export type EpisodeMaterial = z.infer<typeof episodeMaterialSchema>;

/** Public content shapes shared by server queries and presentation layers. */
export interface ReviewData {
  title: string;
  summary: string;
  date: Date;
  source: string;
  language?: "en" | "zh-CN";
  platforms: string[];
  highlights: number;
}

export interface EpisodeData {
  title: string;
  summary: string;
  date: Date;
  duration: number;
  disclosure: string;
  draft: boolean;
  audio: { url: string; length: number; type: "audio/mpeg" };
  chapters: { title: string; start: number }[];
  materials?: EpisodeMaterial[];
}

export type ContentCollection = "reviews" | "episodes";
export interface PublishedEntry<C extends ContentCollection> {
  id: string;
  collection: C;
  body: string;
  data: C extends "reviews" ? ReviewData : EpisodeData;
}

export interface ContentStatement {
  bind(...values: unknown[]): ContentStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface ContentDatabase {
  prepare(sql: string): ContentStatement;
}
