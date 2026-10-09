import { ExternalLink, Headphones, Newspaper, Play, FileText, History } from 'lucide-react';
import type { PublishedEntry, EpisodeMaterial, EpisodeTimelineItem } from '../../../../cloudflare/content-models';
import { Button } from './beui/button';
import { usePlayback, timestamp } from './player/provider';
import { siteConfig } from '../../site';
import { text } from './locale';

const platforms = { x: 'X', podcast: text('播客', 'Podcast'), article: text('文章', 'Article') };
const sourceLabel = (item: EpisodeMaterial) => item.linkKind === 'playlist' ? text('查看播放列表', 'Open playlist') : item.linkKind === 'channel' ? text('查看频道', 'Open channel') : text('查看原文', 'Open original');
function sourceDate(value: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(value));
}
function timelineDate(value: string) {
  return new Intl.DateTimeFormat(siteConfig.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

/** Public editorial selection. Source text and private production artifacts stay local. */
export function EpisodeMaterials({ episode }: { episode: PublishedEntry<'episodes'> }) {
  const { play } = usePlayback();
  const materials = episode.data.materials;
  if (!materials?.length) return null;
  return <section className="episode-materials" aria-labelledby="episode-materials-title">
    <header className="materials-heading">
      <h2 id="episode-materials-title"><Newspaper size={20} aria-hidden="true" />{text('本期素材', 'This episode’s sources')}<span className="section-count">{materials.length}</span></h2>
      <p>{text('编稿前选用的公开来源，以下为中文整理。', 'Public sources selected for this episode, with editorial summaries.')}</p>
    </header>
    <ol className="materials-feed">
      {materials.map(item => {
        const chapter = episode.data.chapters.find(chapter => chapter.start === item.chapterStart);
        return <li key={item.id} className="material-item"><article className="material-card">
          <div className="material-avatar" aria-hidden="true">{Array.from(item.author)[0]?.toUpperCase()}</div>
          <div className="material-content">
            <div className="material-author"><strong>{item.author}</strong>{item.handle && <span>@{item.handle.replace(/^@/, '')}</span>}</div>
            <div className="material-meta"><span className="material-platform">{item.kind === 'podcast' ? <Headphones size={12} aria-hidden="true" /> : item.kind === 'article' ? <FileText size={12} aria-hidden="true" /> : null}{platforms[item.kind]}</span>{item.publishedAt && <time dateTime={item.publishedAt} title={text("原始发表时间", "Originally published")}>{sourceDate(item.publishedAt)}</time>}<span className="material-selected">{text('入选本期', 'Selected')}</span></div>
            {item.title && <h3>{item.title}</h3>}
            <p className="material-summary">{item.summary}</p>
            <div className="material-actions">
              <a href={item.url} target="_blank" rel="noopener noreferrer">{sourceLabel(item)}<ExternalLink size={13} aria-hidden="true" /></a>
              {chapter && <Button variant="ghost" size="sm" className="material-listen" onClick={() => play(episode, chapter.start)} aria-label={`${text('播放对应章节', 'Play related chapter')}：${chapter.title}`}><Play size={12} aria-hidden="true" />{timestamp(chapter.start)}<span>{chapter.title}</span></Button>}
            </div>
          </div>
        </article></li>;
      })}
    </ol>
  </section>;
}

/** The day's full public feed as a Twitter-style timeline, appended after the show notes. */
export function EpisodeTimeline({ episode }: { episode: PublishedEntry<'episodes'> }) {
  const timeline = episode.data.timeline;
  if (!timeline?.length) return null;
  return <section className="episode-timeline" aria-labelledby="episode-timeline-title">
    <header className="materials-heading">
      <h2 id="episode-timeline-title"><History size={20} aria-hidden="true" />{text('短讯', 'The day’s feed')}<span className="section-count">{timeline.length}</span></h2>
      <p>{text('本期制作当天抓取到的全部公开推送，按原始发表时间排序；入选节目的话题标有「入选本期」。', 'Everything captured from public feeds on the day this episode was made, in original publish order. Sources used in the episode are marked as selected.')}</p>
    </header>
    <ol className="timeline-feed">
      {timeline.map((item: EpisodeTimelineItem) => <li key={item.id} className={`timeline-item${item.selected ? ' timeline-item-selected' : ''}`}>
        <article className="timeline-card">
          {item.kind === 'x' && item.handle
            ? <img className="material-avatar" src={`https://unavatar.io/x/${item.handle.replace(/^@/, '')}?fallback=false`} alt="" width="40" height="40" loading="lazy" referrerPolicy="no-referrer" />
            : <div className="material-avatar" aria-hidden="true">{Array.from(item.author)[0]?.toUpperCase()}</div>}
          <div className="material-content">
            <div className="material-author"><strong>{item.author}</strong>{item.handle && <span>@{item.handle.replace(/^@/, '')}</span>}{item.selected && <span className="material-selected">{text('入选本期', 'Selected')}</span>}</div>
            <div className="material-meta"><span className="material-platform">{item.kind === 'podcast' ? <Headphones size={12} aria-hidden="true" /> : item.kind === 'article' ? <FileText size={12} aria-hidden="true" /> : null}{platforms[item.kind]}</span>{item.publishedAt && <time dateTime={item.publishedAt} title={text('原始发表时间', 'Originally published')}>{timelineDate(item.publishedAt)}</time>}</div>
            {item.title && <h3>{item.title}</h3>}
            {item.summary && <p className="timeline-summary">{item.summary}</p>}
            {item.text && <p className="timeline-text">{item.text.length > 280 ? `${item.text.slice(0, 280)}…` : item.text}</p>}
            <div className="material-actions">
              <a href={item.url} target="_blank" rel="noopener noreferrer">{sourceLabel(item as EpisodeMaterial)}<ExternalLink size={13} aria-hidden="true" /></a>
            </div>
          </div>
        </article>
      </li>)}
    </ol>
  </section>;
}
