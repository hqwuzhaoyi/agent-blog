import { describe, expect, test } from "vitest";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { resolveThemeDefinition } from "../src/themes/resolution";

const component = (name: string) => Symbol(name) as unknown as AstroComponentFactory;
const sharedSlots = {
  Header: component("Header"),
  BlogIntro: component("BlogIntro"),
  ReviewList: component("ReviewList"),
  ReviewArticle: component("ReviewArticle"),
  ArchiveList: component("ArchiveList"),
  Footer: component("Footer"),
};

const themes = [
  {
    id: "quiet-minimal",
    label: "Quiet Minimal",
    stylesheet: "quiet.css",
    themeColor: "#006cac",
    slots: { ReviewList: component("MinimalReviewList") },
  },
];

describe("Theme registry seam", () => {
  test("fills missing Theme Slots from the shared defaults", () => {
    const theme = resolveThemeDefinition("quiet-minimal", themes, sharedSlots);

    expect(theme.id).toBe("quiet-minimal");
    expect(Object.keys(theme.slots).sort()).toEqual([
      "ArchiveList",
      "BlogIntro",
      "Footer",
      "Header",
      "ReviewArticle",
      "ReviewList",
    ]);
    expect(theme.slots.ArchiveList).toBe(sharedSlots.ArchiveList);
    expect(theme.slots.ReviewList).not.toBe(sharedSlots.ReviewList);
  });

  test("rejects an unknown configured Theme", () => {
    expect(() => resolveThemeDefinition("purple-ai", themes, sharedSlots)).toThrow(
      'Unknown Theme "purple-ai"',
    );
  });
});
