import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveThemeDefinition,
  themeDefinitions,
  type PreparedArticleProps,
} from "../src/app/themes";
import { DefaultReviewArticle } from "../src/app/components/Article";
const prepared: PreparedArticleProps = {
  title: "Approved work",
  summary: "Selected highlights",
  html: "<h2>Complete body</h2><p>Reviewed content</p>",
  date: "2026-07-16T00:00:00Z",
  source: "Codex / Local",
  platforms: ["Codex"],
  locale: "en",
  labels: {
    daily: "Daily review",
    disclaimer: "Human reviewed",
    preview: "Draft preview",
  },
};
describe("React Theme presentation boundary", () => {
  test("each supported Theme renders complete prepared article content through shared defaults", () => {
    for (const definition of themeDefinitions) {
      const theme = resolveThemeDefinition(definition.id, themeDefinitions, {
        ReviewArticle: DefaultReviewArticle,
      });
      const html = renderToStaticMarkup(
        createElement(theme.slots.ReviewArticle, prepared),
      );
      expect(html).toContain("Approved work");
      expect(html).toContain("<h2>Complete body</h2>");
      expect(html).toContain("Codex / Local");
      expect(html).toContain("Human reviewed");
    }
  });
  test("a Theme override receives prepared props without inheriting another Theme", () => {
    const override = (props: PreparedArticleProps) =>
      createElement("section", {}, props.title);
    const definitions = [
      { id: "custom", label: "Custom", slots: { ReviewArticle: override } },
      { id: "default", label: "Default" },
    ];
    const defaults = { ReviewArticle: DefaultReviewArticle };
    expect(
      resolveThemeDefinition("custom", definitions, defaults).slots
        .ReviewArticle,
    ).toBe(override);
    expect(
      resolveThemeDefinition("default", definitions, defaults).slots
        .ReviewArticle,
    ).toBe(DefaultReviewArticle);
  });
  test("rejects an unknown configured Theme", () => {
    expect(() =>
      resolveThemeDefinition("purple-ai", themeDefinitions, {
        ReviewArticle: DefaultReviewArticle,
      }),
    ).toThrow('Unknown Theme "purple-ai"');
  });
});
