import type { ResolvedTheme, ThemeDefinition, ThemeSlots } from "./shared/contracts";

export function resolveThemeDefinition(
  id: string,
  definitions: ThemeDefinition[],
  sharedSlots: ThemeSlots,
): ResolvedTheme {
  const definition = definitions.find((theme) => theme.id === id);
  if (!definition) throw new Error(`Unknown Theme "${id}"`);

  return {
    ...definition,
    slots: { ...sharedSlots, ...definition.slots },
  };
}
