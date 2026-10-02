import type { ComponentType } from "react";
import { themeCatalog } from "../themes/catalog.mjs";
export const themeIds = themeCatalog.map((theme) => theme.id);
export type ThemeId = "night-shift" | "signal-console" | "quiet-minimal";
export interface ArticleProps {
  title: string;
  summary: string;
  html: string;
  date: string;
  source?: string;
  platforms?: string[];
  preview?: boolean;
}
export interface PreparedArticleProps extends ArticleProps {
  locale: string;
  labels: { daily: string; disclaimer: string; preview: string };
}
/** Slots receive prepared content/labels. They never load data, discover routes or approve publication. */
export interface ThemeSlots {
  ReviewArticle: ComponentType<PreparedArticleProps>;
}
export interface ThemeDefinition {
  id: string;
  label: string;
  slots?: Partial<ThemeSlots>;
}
export const themeDefinitions: ThemeDefinition[] = themeCatalog;
export function resolveTheme(id: string) {
  const theme = themeDefinitions.find((theme) => theme.id === id);
  if (!theme) throw new Error(`Unknown Theme "${id}"`);
  return { ...theme, id: theme.id as ThemeId };
}
export function resolveThemeDefinition(
  id: string,
  definitions: ThemeDefinition[],
  defaults: ThemeSlots,
) {
  const definition = definitions.find((theme) => theme.id === id);
  if (!definition) throw new Error(`Unknown Theme "${id}"`);
  return { ...definition, slots: resolveSlots(defaults, definition.slots) };
}
/** Every missing slot falls directly back to the shared default; Themes never inherit. */
export function resolveSlots(
  defaults: ThemeSlots,
  overrides: Partial<ThemeSlots> = {},
): ThemeSlots {
  return { ...defaults, ...overrides };
}
