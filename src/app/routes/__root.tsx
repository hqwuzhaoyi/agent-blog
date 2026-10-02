import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { siteConfig } from "../site";
import stylesheet from "../styles.css?url";
import { PublicPlayerProvider } from "../features/public/player/provider";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
    links: [{ rel: "stylesheet", href: stylesheet }],
  }),
  component: () => (
    <PublicPlayerProvider>
      <Outlet />
    </PublicPlayerProvider>
  ),
  shellComponent: ({ children }) => (
    <html lang={siteConfig.language} data-theme={siteConfig.theme}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <main>
      <h1>{siteConfig.language === "zh-CN" ? "内容不存在" : "Not found"}</h1>
      <a href="/agent-blog/">{siteConfig.nav.latest}</a>
    </main>
  ),
});
