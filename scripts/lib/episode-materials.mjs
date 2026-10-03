import { createHash } from 'node:crypto';
import { episodeMaterialsSchema, materialUrl, materialPublishedAt } from '../../src/lib/episode-materials.mjs';

const canonical = value => { const url = new URL(materialUrl.parse(value)); url.hash = ''; return url.href; };
const sourceKind = url => /(^|\.)((x|twitter)\.com)$/.test(new URL(url).hostname) ? 'x' : /(^|\.)(youtube\.com|youtu\.be)$/.test(new URL(url).hostname) ? 'podcast' : 'article';
const linkKind = url => { const u = new URL(url); return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/playlist' ? 'playlist' : /(^|\.)youtube\.com$/.test(u.hostname) && /\/(?:@|channel\/|c\/)/.test(u.pathname) ? 'channel' : 'item'; };
const timestamp = value => materialPublishedAt.safeParse(value).success ? new Date(value).toISOString() : undefined;

/** Select only episode.sources; never export raw transcripts, tweet text or feed config. */
export function prepareMaterials({ sources = [], notes = [], feed = {}, chapters = [], sectionStarts = new Map() } = {}) {
  const index = new Map();
  const put = (url, value) => { try { index.set(canonical(url), value); } catch { /* Unselected malformed feed entries do not block an episode. */ } };
  for (const account of feed.x ?? []) for (const tweet of account.tweets ?? [])
    put(tweet.url, { kind: 'x', author: account.name || account.handle, handle: account.handle, publishedAt: timestamp(tweet.createdAt) });
  for (const item of feed.podcasts ?? [])
    put(item.url, { kind: 'podcast', author: item.name, title: item.title, publishedAt: timestamp(item.publishedAt) });
  for (const item of feed.blogs ?? [])
    put(item.url, { kind: 'article', author: item.author || item.name, title: item.title, publishedAt: timestamp(item.publishedAt) });
  const selected = new Map(sources.map(source => [canonical(source.url), source]));
  const editorial = new Map();
  for (const note of notes) {
    const url = canonical(note.url);
    if (!selected.has(url)) throw new Error('Material notes must reference an episode source');
    if (editorial.has(url)) throw new Error('Duplicate material notes');
    editorial.set(url, note);
  }
  return episodeMaterialsSchema.parse([...selected].map(([url, source]) => {
    const note = editorial.get(url) ?? {};
    const facts = index.get(url) ?? {};
    const section = note.chapterSection ?? source.chapterSection;
    let chapterStart;
    if (section !== undefined) {
      chapterStart = sectionStarts.get(section);
      if (chapterStart === undefined || !chapters.some(chapter => chapter.start === Math.round(chapterStart * 1000) / 1000))
        throw new Error('Material chapter must reference a measured publication chapter section');
      chapterStart = Math.round(chapterStart * 1000) / 1000;
    }
    return {
      id: createHash('sha256').update(url).digest('hex').slice(0, 24),
      kind: facts.kind ?? sourceKind(url),
      author: note.author ?? facts.author ?? new URL(url).hostname,
      ...(facts.handle ? { handle: facts.handle } : {}),
      ...(facts.title ? { title: facts.title } : {}),
      summary: note.summary ?? source.summary ?? source.topic,
      url,
      ...(facts.publishedAt ? { publishedAt: facts.publishedAt } : {}),
      linkKind: linkKind(url),
      ...(chapterStart === undefined ? {} : { chapterStart }),
    };
  }));
}
