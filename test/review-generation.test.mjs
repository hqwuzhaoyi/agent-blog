import { describe, expect, test } from "vitest";
import { createReviewSubmission } from "../scripts/lib/review-core.mjs";

const baseConfig = {
  platform: "openclaw",
  sourceId: "openclaw-main",
  sourceLabel: "OpenClaw / Gateway 01",
  privateTerms: ["Acme Private"],
};

describe("Review Generation seam", () => {
  test("uses Codex attribution when a Codex draft omits platform metadata", () => {
    const result = createReviewSubmission({
      config: { ...baseConfig, platform: "codex", sourceLabel: "Codex / Local" },
      reviewDay: "2026-07-16",
      draft: {
        title: "Codex support",
        summary: "Codex became an Agent Source.",
        highlights: [{
          title: "Added Codex collection",
          outcome: "Visible Codex messages can now enter a Review Window.",
          project: "Agent Blog",
        }],
      },
    });

    expect(result.markdown).toContain('source: "Codex / Local"');
    expect(result.markdown).toContain('platforms: ["Codex"]');
  });

  test("ignores model-provided platform attribution", () => {
    const result = createReviewSubmission({
      config: { ...baseConfig, platform: "codex", sourceLabel: "Codex / Local" },
      reviewDay: "2026-07-16",
      draft: {
        title: "Untrusted attribution",
        summary: "The model attempted to choose its platform metadata.",
        platforms: ["OpenClaw", "Forged Agent"],
        highlights: [{
          title: "Kept registry attribution",
          outcome: "The selected registry remains the attribution authority.",
        }],
      },
    });

    expect(result.markdown).toContain('platforms: ["Codex"]');
    expect(result.markdown).not.toContain("OpenClaw");
    expect(result.markdown).not.toContain("Forged Agent");
  });

  test("carries the selected publication language into the Review Submission", () => {
    const result = createReviewSubmission({
      config: { ...baseConfig, language: "zh-CN" },
      reviewDay: "2026-07-16",
      draft: {
        title: "发布流程已完成",
        summary: "博客已经可以通过审核后的变更发布。",
        platforms: ["OpenClaw"],
        highlights: [
          {
            title: "静态发布已验证",
            outcome: "首页、文章、归档和 RSS 均已生成。",
            whyItMatters: "博客可以稳定上线。",
          },
        ],
      },
    });

    expect(result.status).toBe("ready");
    expect(result.markdown).toContain('language: "zh-CN"');
    expect(result.markdown).toContain("**重要性。** 博客可以稳定上线。");
    expect(result.markdown).not.toContain("**Why it matters.**");
  });

  test("produces publication-safe Markdown and omits an unsafe highlight as a whole", () => {
    const result = createReviewSubmission({
      config: { ...baseConfig, sourceLabel: "owner@example.com" },
      reviewDay: "2026-07-16",
      draft: {
        title: "A release cleared review",
        summary: "The release workflow reached a stable, reviewable state.",
        platforms: ["OpenClaw"],
        highlights: [
          {
            title: "Release workflow completed",
            outcome: "The static site now builds and publishes through a reviewed change.",
            whyItMatters: "Publication has a clear human gate.",
            project: "Agent Blog",
            evidence: [
              { label: "Public repository", url: "https://github.com/example/public-repo?token=remove-me", public: true },
            ],
          },
          {
            title: "Customer migration prepared",
            outcome: "Acme Private can review it at owner@example.com from /Users/alice/private-work.",
            whyItMatters: "The customer is ready.",
            project: "Customer work",
          },
        ],
      },
    });

    expect(result.status).toBe("ready");
    expect(result.omittedHighlights).toBe(1);
    expect(result.markdown).toContain("Release workflow completed");
    expect(result.markdown).toContain("https://github.com/example/public-repo");
    expect(result.markdown).not.toContain("remove-me");
    expect(result.markdown).not.toContain("Acme Private");
    expect(result.markdown).not.toContain("owner@example.com");
    expect(result.markdown).not.toContain("/Users/alice");
    expect(result.markdown).toContain('source: "OpenClaw / Gateway 01"');
  });

  test("returns no-update when every proposed highlight is unsafe", () => {
    const result = createReviewSubmission({
      config: baseConfig,
      reviewDay: "2026-07-16",
      draft: {
        title: "Internal work",
        summary: "An internal task finished.",
        platforms: ["OpenClaw"],
        highlights: [
          {
            title: "Rotated a credential",
            outcome: "The api_key=not-a-real-credential was replaced.",
            whyItMatters: "Access works again.",
          },
        ],
      },
    });

    expect(result).toEqual({ status: "no-update", reason: "no-publication-safe-highlights", omittedHighlights: 1 });
  });
});
