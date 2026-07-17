import Header from "./shared/slots/Header.astro";
import BlogIntro from "./shared/slots/BlogIntro.astro";
import ReviewList from "./shared/slots/ReviewList.astro";
import ReviewArticle from "./shared/slots/ReviewArticle.astro";
import ArchiveList from "./shared/slots/ArchiveList.astro";
import Footer from "./shared/slots/Footer.astro";
import { nightShiftTheme } from "./night-shift/theme";
import { quietMinimalTheme } from "./quiet-minimal/theme";
import { signalConsoleTheme } from "./signal-console/theme";
import { resolveThemeDefinition } from "./resolution";
import type { ThemeSlots } from "./shared/contracts";
import { themeCatalog } from "./catalog.mjs";

const sharedSlots = {
  Header,
  BlogIntro,
  ReviewList,
  ReviewArticle,
  ArchiveList,
  Footer,
} satisfies ThemeSlots;

const packages = {
  "night-shift": nightShiftTheme,
  "signal-console": signalConsoleTheme,
  "quiet-minimal": quietMinimalTheme,
};
const themes = themeCatalog.map((catalogTheme) => ({
  ...catalogTheme,
  ...packages[catalogTheme.id as keyof typeof packages],
}));

export function resolveTheme(id: string) {
  return resolveThemeDefinition(id, themes, sharedSlots);
}
