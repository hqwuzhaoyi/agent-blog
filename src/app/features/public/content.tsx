import { Link } from '@tanstack/react-router';
import { Play, Headphones, ArrowRight, CalendarDays } from 'lucide-react';
import type { PublishedEntry } from '../../../../cloudflare/content-models';
import { usePlayerActions, timestamp } from './player/provider';
import { Button } from './beui/button';
import { siteConfig } from '../../site';
import { text } from './locale';
export function displayDate(date: Date) { return new Intl.DateTimeFormat(siteConfig.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date); }
export function EpisodeCover({ episode, compact = false }: { episode: PublishedEntry<'episodes'>; compact?: boolean }) {
  const date = episode.data.date;
  return <div className={`episode-cover ${compact ? 'episode-cover-compact' : ''}`} aria-label={`${siteConfig.episodes.title} · ${displayDate(date)}`}>
    <div className="cover-top"><span>MORNING<br />COFFEE</span><span>{date.getUTCFullYear()}<br />{String(date.getUTCMonth() + 1).padStart(2, '0')}.{String(date.getUTCDate()).padStart(2, '0')}</span></div>
    <div className="cover-orbit" aria-hidden="true"><svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="103" /><circle cx="110" cy="110" r="74" /><circle cx="110" cy="110" r="45" /><path d="M94 90v40m16-52v64m16-52v40" /></svg><span className="cover-sun" /></div>
    <div className="cover-bottom"><span>{siteConfig.episodes.title}</span><Headphones size={18} aria-hidden="true" /></div>
  </div>;
}
export function EpisodeCard({ episode }: { episode: PublishedEntry<'episodes'> }) {
  const { play } = usePlayerActions();
  return <li className="episode-card"><Link to="/agent-blog/episodes/$id" params={{ id: episode.id }} className="episode-card-art"><EpisodeCover episode={episode} compact /></Link><div className="episode-card-body"><p className="content-meta"><time dateTime={episode.data.date.toISOString()}>{displayDate(episode.data.date)}</time><span>{timestamp(episode.data.duration)}</span></p><Link to="/agent-blog/episodes/$id" params={{ id: episode.id }} className="episode-card-title">{episode.data.title}</Link><p className="episode-card-summary">{episode.data.summary}</p><Button variant="outline" className="card-play" onClick={() => play(episode)} aria-label={`${siteConfig.player.play} ${episode.data.title}`}><Play size={14} fill="currentColor" aria-hidden="true" />{siteConfig.player.play}</Button></div></li>;
}
export function EpisodeRow({ episode }: { episode: PublishedEntry<'episodes'> }) {
  const { play } = usePlayerActions();
  return <li className="archive-entry"><span className="entry-icon"><Headphones size={19} aria-hidden="true" /></span><Link to="/agent-blog/episodes/$id" params={{ id: episode.id }} className="entry-copy"><p className="content-meta">{siteConfig.episodes.title}<span>{displayDate(episode.data.date)} · {timestamp(episode.data.duration)}</span></p><h3>{episode.data.title}</h3><p className="entry-summary">{episode.data.summary}</p></Link><Button variant="outline" className="entry-play" onClick={() => play(episode)} aria-label={`${siteConfig.player.play} ${episode.data.title}`}><Play size={14} fill="currentColor" aria-hidden="true" /><span>{siteConfig.player.play}</span></Button></li>;
}
export function ReviewRow({ review }: { review: PublishedEntry<'reviews'> }) {
  return <li className="review-entry"><div className="review-date"><CalendarDays size={16} aria-hidden="true" /><time dateTime={review.data.date.toISOString()}>{displayDate(review.data.date)}</time></div><Link to="/agent-blog/reviews/$id" params={{ id: review.id }} className="review-copy"><p className="content-meta">{review.data.source}</p><h3>{review.data.title}</h3><p className="entry-summary">{review.data.summary}</p><span className="read-link">{siteConfig.review.read}<ArrowRight size={15} aria-hidden="true" /></span></Link></li>;
}
export function SectionHeading({ eyebrow, title, count, children }: { eyebrow: string; title: string; count?: number; children?: React.ReactNode }) { return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}{count !== undefined && <span className="section-count">{count}</span>}</h2></div>{children}</div>; }
export function EmptyContent({ children }: { children: React.ReactNode }) { return <div className="public-empty"><span className="entry-icon"><Headphones size={22} aria-hidden="true" /></span><p>{children}</p></div>; }
