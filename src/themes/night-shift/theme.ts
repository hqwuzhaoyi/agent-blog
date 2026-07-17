import stylesheet from "./theme.css?url";
import type { ThemeDefinition } from "../shared/contracts";

export const nightShiftTheme = {
  stylesheet,
  themeColor: "#f05a28",
} satisfies Omit<ThemeDefinition, "id" | "label">;
