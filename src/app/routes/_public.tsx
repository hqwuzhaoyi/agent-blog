import { useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AudioLines, Rss, Search, Menu, ArrowUpRight } from "lucide-react";
import { PersistentPlayer } from "../features/public/player/provider";
import { BottomSheet } from "../features/public/beui/bottom-sheet";
import { Button } from "../features/public/beui/button";
import { siteConfig } from "../site";
import { text } from "../features/public/locale";
import { ContactIcon } from "../features/public/contact-icon";
import "../features/public/public.css";
export const Route = createFileRoute("/_public")({ component: PublicLayout });
function PublicLayout() {
  const [panel, setPanel] = useState<"menu" | "subscribe">("menu");
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = (next: "menu" | "subscribe") => {
    setPanel(next);
    setPanelOpen(true);
  };
  const navigation = (mobile = false) => (
    <>
      <Link
        to="/"
        activeOptions={{ exact: true }}
        className={
          mobile
            ? "rounded-xl px-[15px] py-3 text-[16px] mobile:text-[15px]"
            : "rounded-full px-3.5 py-[9px] text-[13px] whitespace-nowrap text-muted-foreground tablet:px-[9px] tablet:py-2 pointer-hover:hover:bg-primary/8 pointer-hover:hover:text-primary"
        }
        activeProps={{
          className: mobile
            ? "is-active bg-primary/8"
            : "is-active bg-primary/8 text-primary",
        }}
        onClick={() => setPanelOpen(false)}
      >
        {text("首页", "Home")}
      </Link>
      <Link
        to="/episodes"
        activeOptions={{ exact: false }}
        className={
          mobile
            ? "rounded-xl px-[15px] py-3 text-[16px] mobile:text-[15px]"
            : "rounded-full px-3.5 py-[9px] text-[13px] whitespace-nowrap text-muted-foreground tablet:px-[9px] tablet:py-2 pointer-hover:hover:bg-primary/8 pointer-hover:hover:text-primary"
        }
        activeProps={{
          className: mobile
            ? "is-active bg-primary/8"
            : "is-active bg-primary/8 text-primary",
        }}
        onClick={() => setPanelOpen(false)}
      >
        {siteConfig.nav.episodes}
      </Link>
      <Link
        to="/reviews"
        className={
          mobile
            ? "rounded-xl px-[15px] py-3 text-[16px] mobile:text-[15px]"
            : "rounded-full px-3.5 py-[9px] text-[13px] whitespace-nowrap text-muted-foreground tablet:px-[9px] tablet:py-2 pointer-hover:hover:bg-primary/8 pointer-hover:hover:text-primary"
        }
        activeProps={{
          className: mobile
            ? "is-active bg-primary/8"
            : "is-active bg-primary/8 text-primary",
        }}
        onClick={() => setPanelOpen(false)}
      >
        {siteConfig.nav.latest}
      </Link>
      <Link
        to="/archive"
        search={{ type: "all", q: "", month: "" }}
        activeOptions={{ includeSearch: false }}
        className={
          mobile
            ? "rounded-xl px-[15px] py-3 text-[16px] mobile:text-[15px]"
            : "rounded-full px-3.5 py-[9px] text-[13px] whitespace-nowrap text-muted-foreground tablet:px-[9px] tablet:py-2 pointer-hover:hover:bg-primary/8 pointer-hover:hover:text-primary"
        }
        activeProps={{
          className: mobile
            ? "is-active bg-primary/8"
            : "is-active bg-primary/8 text-primary",
        }}
        onClick={() => setPanelOpen(false)}
      >
        {siteConfig.nav.archive}
      </Link>
    </>
  );
  return (
    <div className="public-site has-[.persistent-player:not([hidden])]:pb-[calc(96px+env(safe-area-inset-bottom))]">
      <header className="public-header border-b border-border bg-background">
        <div className="public-header-inner flex items-center gap-7 justify-between max-w-[1280px] m-auto py-5.5 px-[var(--public-gutter)] tablet:gap-[15px] mobile:py-[17px] mobile:px-5 mobile:gap-3">
          <Link
            to="/"
            className="public-brand flex items-center gap-[11px] text-[17px] font-bold tracking-[-.035em] whitespace-nowrap text-foreground mobile:gap-[9px] mobile:text-[16px]"
          >
            <span className="brand-mark grid place-items-center bg-primary text-background w-10.5 h-10.5 rounded-[14px] mobile:w-8.5 mobile:h-8.5 mobile:rounded-[11px]">
              <AudioLines size={22} aria-hidden="true" />
            </span>
            <span>
              {siteConfig.title}
              <small className="mt-px block text-[10px] font-normal tracking-[.03em] text-muted-foreground tablet:hidden">
                {text(
                  "听见新想法，读懂新进展",
                  "New ideas. Meaningful progress.",
                )}
              </small>
            </span>
          </Link>
          <nav
            className="public-nav flex items-center gap-[5px] tablet:gap-0 mobile:hidden"
            aria-label={siteConfig.nav.label}
          >
            {navigation()}
          </nav>
          <div className="header-actions flex items-center gap-3 mobile:gap-[3px]">
            <Link
              to="/archive"
              search={{ type: "all", q: "", month: "" }}
              className="header-search grid size-9.5 place-items-center rounded-full text-muted-foreground transition-transform duration-[140ms] ease-[var(--ease-out)] active:not-focus-visible:scale-[.97] pointer-hover:hover:bg-card mobile:h-8.5 mobile:w-8 touch:min-h-11 touch:min-w-11 motion-reduce:transform-none motion-reduce:transition-none"
              aria-label={text("搜索公开内容", "Search published content")}
            >
              <Search size={19} aria-hidden="true" />
            </Link>
            <Button
              variant="outline"
              className="subscribe-button h-9.5 min-h-9.5 text-[12px] py-0 px-[17px] bg-card mobile:hidden"
              aria-expanded={panelOpen && panel === "subscribe"}
              aria-haspopup="dialog"
              onClick={() => openPanel("subscribe")}
            >
              <Rss size={15} aria-hidden="true" />
              {text("订阅", "Subscribe")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button hidden mobile:inline-flex mobile:size-8.5 touch:min-h-11 touch:min-w-11"
              aria-expanded={panelOpen && panel === "menu"}
              aria-haspopup="dialog"
              onClick={() => openPanel("menu")}
              aria-label={text("打开导航菜单", "Open navigation menu")}
            >
              <Menu size={22} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <main className="public-main max-w-[1280px] m-auto pt-0 px-[var(--public-gutter)] pb-12 mobile:pb-8">
        <Outlet />
      </main>
      <footer className="public-footer mx-auto grid max-w-[1280px] grid-cols-[1fr_auto_auto] items-center gap-x-6 border-t border-border px-[var(--public-gutter)] py-4 mobile:grid-cols-[1fr_auto] mobile:gap-x-3 mobile:py-3">
        <Link
          to="/"
          className="footer-brand inline-flex min-h-9 w-fit items-center text-[13px] font-semibold text-foreground touch:min-h-11"
        >
          {siteConfig.title}
        </Link>
        <nav
          className="flex flex-wrap items-center gap-x-5 mobile:col-span-2 mobile:row-start-2"
          aria-label={text("订阅", "Subscribe")}
        >
          <a
            className="inline-flex min-h-9 items-center text-[11px] text-muted-foreground transition-colors pointer-hover:hover:text-primary touch:min-h-11"
            href="/episodes/rss.xml"
          >
            {siteConfig.episodes.subscribe}
          </a>
          <a
            className="inline-flex min-h-9 items-center text-[11px] text-muted-foreground transition-colors pointer-hover:hover:text-primary touch:min-h-11"
            href="/rss.xml"
          >
            {text("订阅全部内容", "Subscribe to all content")}
          </a>
        </nav>
        <nav
          className="flex items-center gap-1 mobile:col-start-2 mobile:row-start-1"
          aria-label={text("联系方式", "Contact links")}
        >
          {siteConfig.contactLinks.map(({ kind, label, href }) => (
            <a
              key={href}
              href={href}
              aria-label={label}
              title={label}
              target={href.startsWith("mailto:") ? undefined : "_blank"}
              rel={
                href.startsWith("mailto:") ? undefined : "noopener noreferrer"
              }
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors pointer-hover:hover:bg-primary/8 pointer-hover:hover:text-primary touch:size-11"
            >
              <ContactIcon kind={kind} />
            </a>
          ))}
        </nav>
      </footer>
      <PersistentPlayer />
      <BottomSheet
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={
          panel === "subscribe"
            ? text("选择订阅", "Choose a feed")
            : siteConfig.nav.label
        }
        snapPoints={["auto"]}
        className="public-site public-navigation-sheet"
      >
        {panel === "menu" ? (
          <nav
            className="mobile-nav flex flex-col gap-[5px] pt-3.5 pb-[25px]"
            aria-label={siteConfig.nav.label}
          >
            {navigation(true)}
            <Button
              variant="outline"
              className="mobile-nav-subscribe mt-3 self-start text-[13px]"
              onClick={() => openPanel("subscribe")}
            >
              <Rss size={16} aria-hidden="true" />
              {text("订阅", "Subscribe")}
            </Button>
          </nav>
        ) : (
          <div className="subscription-options grid gap-3 pt-4 pb-6">
            <a
              className="group flex items-center gap-3.5 rounded-[14px] border border-border p-5 pointer-hover:hover:border-primary"
              href="/episodes/rss.xml"
            >
              <Rss size={21} />
              <span className="flex-1">
                <strong className="text-[14px] font-semibold">
                  {siteConfig.episodes.subscribe}
                </strong>
                <small className="mt-1.5 block text-[11px] text-muted-foreground">
                  {siteConfig.episodes.description}
                </small>
              </span>
              <ArrowUpRight
                size={18}
                className="transition-transform duration-[160ms] ease-[var(--ease-out)] pointer-hover:group-hover:translate-x-0.5 pointer-hover:group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              />
            </a>
            <a
              className="group flex items-center gap-3.5 rounded-[14px] border border-border p-5 pointer-hover:hover:border-primary"
              href="/rss.xml"
            >
              <Rss size={21} />
              <span className="flex-1">
                <strong className="text-[14px] font-semibold">
                  {text("订阅全部内容", "All published content")}
                </strong>
                <small className="mt-1.5 block text-[11px] text-muted-foreground">
                  {text(
                    "早咖啡与工作日志，一个 RSS 入口。",
                    "Morning Coffee and worklogs in one feed.",
                  )}
                </small>
              </span>
              <ArrowUpRight
                size={18}
                className="transition-transform duration-[160ms] ease-[var(--ease-out)] pointer-hover:group-hover:translate-x-0.5 pointer-hover:group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              />
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
