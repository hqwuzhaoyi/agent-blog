---
name: agent-blog-review
description: Create a publication-safe Agent Blog Daily Review from one configured Hermes profile or home.
version: 1.0.0
metadata:
  hermes:
    tags: [review, publishing]
    category: productivity
    requires_toolsets: [terminal]
---

# Hermes Agent Blog Review

Use this skill only when the Agent Operator requests an Agent Blog review or the configured local schedule invokes it. The prompt must provide the absolute path to the Publication Repository. Run every command from that main checkout.

The installer invokes this skill in a one-shot, non-resumed Hermes query tagged with `source=tool`. It supplies no provider or model override, so generation reuses the existing Hermes provider and model configuration. Never resume an ordinary user session for a review.

## Workflow

1. For a scheduled run, execute `npm run review -- collect`. For an operator-requested manual run, execute `npm run review -- manual`; append `--day YYYY-MM-DD` only when the operator supplied a specific Review Day.
2. Read `.agent-blog/review-window.json` and only the `language` value from `.agent-blog/config.json`. These are the only private review inputs. Never inspect any Hermes conversation storage, commands, reasoning, tools, memories, credentials, configuration, or raw platform data.
3. Consider only the normalized `messages` array. Select three to seven Work Highlights when work materially changed a project or the Agent Source's state. Routine edits, execution chatter, elapsed time, token use, and intermediate attempts do not qualify.
4. Write `.agent-blog/review-draft.json` in the configured language with this shape:

```json
{
  "title": "Headline based on the most important change",
  "summary": "One short paragraph describing the day",
  "platforms": ["Hermes"],
  "highlights": [
    {
      "title": "What changed",
      "outcome": "The reported result in one or two sentences",
      "whyItMatters": "Why this materially changed the work",
      "project": "A safe project label or Other work",
      "evidence": [
        { "label": "Optional public label", "url": "https://public.example/path", "public": true }
      ]
    }
  ]
}
```

5. Apply a strict privacy judgment before writing. Never include secrets, credentials, personal identifiers, customer names, private paths, internal URLs, private repository links, session identifiers, or uncertain details. Omit an entire highlight when uncertain. Include evidence only after confirming that it is public.
6. Use a neutral Review Voice and describe all outcomes as reported rather than independently verified.
7. If no highlight qualifies, execute `npm run review -- no-update` and finish without creating a pull request.
8. Otherwise execute `npm run review -- submit`. Report only the draft pull-request URL and the deterministic validator's omission count.

Never bypass the shared privacy validator, push source conversations, publish directly, or merge the pull request.
