import stylesheet from "./theme.css?url";
import ReviewList from "./slots/ReviewList.astro";
import type { ThemeDefinition } from "../shared/contracts";

export const quietMinimalTheme = {
  stylesheet,
  themeColor: "#006cac",
  slots: { ReviewList },
} satisfies Omit<ThemeDefinition, "id" | "label">;
