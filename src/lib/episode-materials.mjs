import { z } from 'zod';

const privateText = /\/Users\/|\/home\/|MEDIA:|\blocalhost\b|\bsk-[\w-]{8,}/i;
const publicText = (max) => z.string().trim().min(1).max(max).refine(value => !privateText.test(value), 'Private production text is not a material');
export const materialUrl = z.url().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !privateText.test(value) &&
      ![...url.searchParams.keys()].some(key => /^(token|api[_-]?key|secret|password|authorization|x-amz-signature)$/i.test(key)) &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[|.*\.(local|internal)$)/i.test(url.hostname);
  } catch { return false; }
}, 'Material links must be public HTTP(S) sources');

export const materialPublishedAt = z.iso.datetime({ offset: true });
export const episodeMaterialSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  kind: z.enum(['x', 'podcast', 'article']),
  author: publicText(200),
  handle: publicText(100).optional(),
  title: publicText(400).optional(),
  summary: publicText(1200),
  url: materialUrl,
  publishedAt: materialPublishedAt.optional(),
  linkKind: z.enum(['item', 'playlist', 'channel']),
  chapterStart: z.number().nonnegative().optional(),
});
export const episodeMaterialsSchema = z.array(episodeMaterialSchema).max(24).refine(
  values => new Set(values.map(item => item.url)).size === values.length && new Set(values.map(item => item.id)).size === values.length,
  'Materials must have distinct sources',
);
