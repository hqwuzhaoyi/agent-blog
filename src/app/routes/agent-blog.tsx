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
          <Link to="/agent-blog" className="text-lg font-semibold">
            {siteConfig.title}
          </Link>
          <nav
            aria-label={siteConfig.nav.label}
            className="flex flex-wrap items-center gap-5 text-sm"
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
              {siteConfig.nav.archive}
            </Link>
            <a href="/agent-blog/rss.xml">{siteConfig.nav.rss}</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-32">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl border-t border-border px-5 py-8 text-sm text-muted-foreground">
        <p>{siteConfig.footer.disclaimer}</p>
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
