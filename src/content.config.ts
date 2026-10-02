import { env } from "node:process";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const reviews = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/reviews" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    source: z.string(),
    language: z.enum(["en", "zh-CN"]).optional(),
    platforms: z.array(z.string()).min(1),
    highlights: z.number().int().positive(),
  }),
});

const episodes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: env.EPISODE_CONTENT_DIR ?? "./src/data/episodes" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    duration: z.number().positive(),
    disclosure: z.string().min(1),
    draft: z.boolean().default(false),
    audio: z.object({
      url: z.string().min(1),
      length: z.number().int().positive(),
      type: z.literal("audio/mpeg").default("audio/mpeg"),
    }),
    chapters: z.array(z.object({
      title: z.string().min(1),
      start: z.number().nonnegative(),
    })).min(1),
  }).superRefine((episode, context) => {
    if (!episode.draft && !/^https:\/\//.test(episode.audio.url)) {
      context.addIssue({ code: "custom", path: ["audio", "url"], message: "Published audio requires an HTTPS URL" });
    }
    episode.chapters.forEach((chapter, index) => {
      if (chapter.start >= episode.duration || (index > 0 && chapter.start <= episode.chapters[index - 1].start)) {
        context.addIssue({ code: "custom", path: ["chapters", index, "start"], message: "Chapters must increase and stay within the measured duration" });
      }
    });
  }),
});

export const collections = { reviews, episodes };
