import stylesheet from "./theme.css?url";
import HomeHero from "./slots/HomeHero.astro";
import ReviewList from "./slots/ReviewList.astro";
import type { ThemeDefinition } from "../shared/contracts";

export const quietMinimalTheme = {
  stylesheet,
  themeColor: "#006cac",
  slots: { HomeHero, ReviewList },
} satisfies Omit<ThemeDefinition, "id" | "label">;
