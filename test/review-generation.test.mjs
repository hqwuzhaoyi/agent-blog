import { describe, expect, test } from "vitest";
import { createReviewSubmission } from "../scripts/lib/review-core.mjs";

const baseConfig = {
  sourceId: "openclaw-main",
  sourceLabel: "OpenClaw / Gateway 01",
  privateTerms: ["Acme Private"],
};

describe("Review Generation seam", () => {
  test("produces publication-safe Markdown and omits an unsafe highlight as a whole", () => {
    const result = createReviewSubmission({
      config: baseConfig,
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
