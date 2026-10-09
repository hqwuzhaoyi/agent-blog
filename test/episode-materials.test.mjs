import { expect, test } from 'vitest';
import { prepareMaterials, prepareTimeline } from '../scripts/lib/episode-materials.mjs';
import { episodeMaterialsSchema } from '../src/lib/episode-materials.mjs';
import { prepareEpisode } from '../scripts/lib/episode-publication.mjs';
const url = 'https://x.com/builder/status/123';
const input = () => ({
  sources: [{url, topic: '公开的整理摘要'}],
  notes: [{url, summary: '作者分享了实际工作流程，节目据此讨论适用范围。', chapterSection: 2}],
  feed: { config: {token: 'private-config'}, x: [{name: 'A Builder', handle: 'builder', tweets: [{url, text: 'Full unselected source text', createdAt: '2026-10-01T12:00:00Z'}, {url: 'https://x.com/other/status/2', text: 'UNSELECTED'}]}] },
  chapters: [{title: '主线', start: 12.375}], sectionStarts: new Map([[2, 12.3746]]),
});

test('exports only selected public fields with measured chapter and stable source identity', () => {
  const result = prepareMaterials(input());
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({kind:'x',author:'A Builder',handle:'builder',publishedAt:'2026-10-01T12:00:00.000Z',chapterStart:12.375,linkKind:'item'});
  expect(JSON.stringify(result)).not.toMatch(/private-config|UNSELECTED|Full unselected source text/);
  expect(prepareMaterials(input())[0].id).toBe(result[0].id);
});
test('retains unknown dates as absent and identifies collection links honestly', () => {
  const url='https://www.youtube.com/playlist?list=example';
  for(const publishedAt of [null,'2026-10-01','2026-10-01T12:00:00']) {
  const [result]=prepareMaterials({sources:[{url,topic:'访谈整理'}],feed:{podcasts:[{url,name:'A Podcast',title:'Interview',publishedAt,transcript:'PRIVATE TRANSCRIPT'}]}});
  expect(result).toMatchObject({kind:'podcast',author:'A Podcast',title:'Interview',linkKind:'playlist'});
  expect(result).not.toHaveProperty('publishedAt');
  expect(result).not.toHaveProperty('chapterStart');
  expect(JSON.stringify(result)).not.toContain('PRIVATE TRANSCRIPT');
  }
});
test('rejects unsafe links, private notes, unrelated selections and invented chapter links', () => {
  for (const bad of ['not-a-url','https://example.com/?token=secret','javascript:alert(1)','file:///Users/a/notes','http://127.0.0.1/a','https://name:secret@example.com/a'])
    expect(()=>prepareMaterials({sources:[{url:bad,topic:'source'}]})).toThrow();
  expect(episodeMaterialsSchema.safeParse([{...prepareMaterials(input())[0],url:'not-a-url'}]).success).toBe(false);
  expect(()=>prepareMaterials({...input(),notes:[{url,summary:'MEDIA:/Users/private/audio.mp3'}]})).toThrow();
  expect(()=>prepareMaterials({...input(),notes:[{url:'https://example.com/not-selected',summary:'Other'}]})).toThrow('episode source');
  expect(()=>prepareMaterials({...input(),notes:[{url,summary:'摘要',chapterSection:99}]})).toThrow('measured');
});
test('deduplicates selected URLs and rejects duplicate structured API materials', () => {
  const result=prepareMaterials({...input(),sources:[...input().sources,...input().sources]});
  expect(result).toHaveLength(1);
  expect(()=>episodeMaterialsSchema.parse([result[0],result[0]])).toThrow('distinct sources');
});
test('older producers without selected sources remain compatible', () => {
  expect(prepareMaterials()).toEqual([]);
});
test('timeline exports every feed entry in publish order with text only for posts', () => {
  const feed = input().feed;
  const result = prepareTimeline({ feed, selectedUrls: [url] });
  expect(result).toHaveLength(2);
  expect(result.map(item => item.url)).toEqual([url, 'https://x.com/other/status/2']);
  expect(result[0]).toMatchObject({ kind: 'x', author: 'A Builder', handle: 'builder', selected: true });
  expect(result[0].text).toBe('Full unselected source text');
  expect(result[1].selected).toBe(false);
  expect(result[1].text).toBe('UNSELECTED');
  expect(JSON.stringify(result)).not.toMatch(/private-config/);
});
test('timeline orders by original publish time and keeps unselected entries honest', () => {
  const feed = { x: [{ name: 'A', handle: 'a', tweets: [{ url: 'https://x.com/a/status/1', text: 'late', createdAt: '2026-10-01T12:00:00Z' }, { url: 'https://x.com/a/status/2', text: 'early', createdAt: '2026-10-01T06:00:00Z' }] }] };
  const result = prepareTimeline({ feed });
  expect(result.map(item => item.text)).toEqual(['early', 'late']);
  expect(result.every(item => item.selected === false)).toBe(true);
});
test('timeline notes attach Chinese summaries without forcing selection', () => {
  const result = prepareTimeline({ feed: input().feed, notes: [{ url: 'https://x.com/other/status/2', summary: '未入选推文的中文一句整理。' }] });
  expect(result[1].summary).toBe('未入选推文的中文一句整理。');
  expect(result[1].selected).toBe(false);
  expect(() => prepareTimeline({ feed: input().feed, notes: [{ url: 'MEDIA:/Users/private/a.mp3', summary: 'x' }] })).toThrow();
});
test('publishing preparation includes timeline without exporting feed config', () => {
  const episode = prepareEpisode({ day: '2026-10-02', source: { title: '节目', disclosure: 'AI配音', sources: input().sources }, publication: { summary: '节目摘要', chapters: [0, 1, 2, 3].map(section => ({ title: String(section), section })), materials: [{ url, summary: '制作前整理的公开摘要', chapterSection: 2 }] }, parts: [0, 1, 2, 3].map(section => ({ section, seconds: 4, pause_ms: 500 })), duration: 24, audio: Buffer.from('audio'), shownotes: 'Public notes', feed: input().feed });
  expect(episode.data.timeline).toHaveLength(2);
  expect(episode.data.timeline[0].selected).toBe(true);
  expect(episode.data.timeline[1].text).toBe('UNSELECTED');
  expect(JSON.stringify(episode.data)).not.toContain('private-config');
});
test('publishing preparation includes selected materials without exporting the feed', () => {
  const episode=prepareEpisode({day:'2026-10-02',source:{title:'节目',disclosure:'AI配音',sources:input().sources},publication:{summary:'节目摘要',chapters:[0,1,2,3].map(section=>({title:String(section),section})),materials:[{url,summary:'制作前整理的公开摘要',chapterSection:2}]},parts:[0,1,2,3].map(section=>({section,seconds:4,pause_ms:500})),duration:24,audio:Buffer.from('audio'),shownotes:'Public notes',feed:input().feed});
  expect(episode.data.materials[0].chapterStart).toBe(12);
  expect(JSON.stringify(episode.data)).not.toContain('private-config');
});
