import { createFileRoute } from '@tanstack/react-router';
import { Headphones } from 'lucide-react';
import { getPublicContent } from '../server/public-data';
import { EpisodeCard, EmptyContent } from '../features/public/content';
import { siteConfig } from '../site';
import { text } from '../features/public/locale';
export const Route = createFileRoute('/_public/episodes/')({ loader: () => getPublicContent(), head: () => ({ meta: [{ title: `${siteConfig.episodes.title} · ${siteConfig.title}` }, { name: 'description', content: siteConfig.episodes.description }] }), component: Episodes });
function Episodes() { const { episodes } = Route.useLoaderData(); return <section className="public-list-page"><header className="public-page-heading"><p className="eyebrow">THE LISTENING ROOM</p><h1>{siteConfig.episodes.title}</h1><p>{siteConfig.episodes.description}</p><span className="page-total"><Headphones size={16} aria-hidden="true" />{episodes.length} {text('期公开节目', 'published episodes')}</span></header>{episodes.length ? <ul className="episode-grid">{episodes.map(episode => <EpisodeCard key={episode.id} episode={episode} />)}</ul> : <EmptyContent>{siteConfig.episodes.empty}</EmptyContent>}</section>; }
