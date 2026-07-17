import stylesheet from "./theme.css?url";
import type { ThemeDefinition } from "../shared/contracts";

export const signalConsoleTheme = {
  stylesheet,
  themeColor: "#94ff65",
} satisfies Omit<ThemeDefinition, "id" | "label">;
