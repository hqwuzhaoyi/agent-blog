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
    platforms: z.array(z.string()).min(1),
    highlights: z.number().int().positive(),
  }),
});

export const collections = { reviews };
