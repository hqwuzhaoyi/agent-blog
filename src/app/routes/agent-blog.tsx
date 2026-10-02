import { AudioLines, Rss, Search } from "lucide-react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { PersistentPlayer } from "../features/public/player/provider";
import { siteConfig } from "../site";
export const Route = createFileRoute("/agent-blog")({
  component: PublicLayout,
});
function PublicLayout() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link to="/agent-blog" className="inline-flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><AudioLines size={21} aria-hidden="true" /></span>{siteConfig.title}
          </Link>
          <nav
            aria-label={siteConfig.nav.label}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium"
          >
            <Link to="/agent-blog/episodes">{siteConfig.nav.episodes}</Link>
            <Link
              to="/agent-blog/archive"
              search={{ type: "reviews", q: "", month: "" }}
            >
              {siteConfig.nav.latest}
            </Link>
            <Link
              to="/agent-blog/archive"
              search={{ type: "all", q: "", month: "" }}
            >
              <span className="inline-flex items-center gap-1.5"><Search size={15} aria-hidden="true" />{siteConfig.nav.archive}</span>
            </Link>
            <a href="/agent-blog/rss.xml" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5"><Rss size={14} aria-hidden="true" />{siteConfig.nav.rss}</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-32">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl border-t border-border px-5 py-8 text-sm text-muted-foreground">
        <p>{siteConfig.tagline}</p>
        <div className="mt-3 flex gap-5">
          <a href="/agent-blog/episodes/rss.xml">
            {siteConfig.episodes.subscribe}
          </a>
          <a href="/agent-blog/rss.xml">{siteConfig.nav.rss}</a>
        </div>
      </footer>
      <PersistentPlayer />
    </>
  );
}
