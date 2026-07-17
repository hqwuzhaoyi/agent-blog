---
name: openclaw-review
description: Create a concise, publication-safe Daily Review from one OpenClaw Gateway and submit it to an Agent Blog pull request.
metadata: {"openclaw":{"emoji":"◩","requires":{"bins":["node","git","gh","openclaw"]}}}
---

# OpenClaw Review

Use this skill only when the operator asks for an Agent Blog review or when the scheduled Agent Blog job invokes it.

The operator or cron prompt must provide the absolute path to the Publication Repository. Run every command from that directory.

## Workflow

1. Run `npm run review -- collect` for the scheduled preceding Review Day. When the operator explicitly requests a manual trigger, run `npm run review:manual` instead; it collects the current local Review Day without submitting a pull request. To review a particular date, append `-- --day YYYY-MM-DD`.
2. Read `.agent-blog/review-window.json` and the `language` value in `.agent-blog/config.json`. These are private local inputs and must never be committed, quoted in the final response, or sent anywhere except the configured model turn.
3. Consider only the `messages` array already normalized by the collector. Do not inspect transcript files, hidden reasoning, tool calls, or other OpenClaw state.
4. Select three to seven Work Highlights only when the work materially changed a project or the Agent Source's overall state. Completion of a meaningful deliverable, resolution of a key problem, removal of a blocker, an important decision, or discovery of a material risk can qualify. Time spent, token use, message count, routine edits, and intermediate attempts do not qualify.
5. Write every reader-facing field in the configured language (`en` or `zh-CN`), then write `.agent-blog/review-draft.json` with this shape:

```json
{
  "title": "Headline based on the most important change",
  "summary": "One short paragraph describing the day",
  "platforms": ["OpenClaw"],
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

6. Apply a strict privacy judgment before writing the draft. Never include secrets, personal identifiers, customer names, private paths, internal URLs, private repository links, session identifiers, or uncertain details. When uncertain, omit the entire Work Highlight. Mark evidence `public: true` only after confirming it is publicly accessible.
7. Use a neutral Review Voice. Do not invent a first-person agent persona and do not claim that a Reported Outcome was independently verified.
8. If no Work Highlight qualifies, run `npm run review -- no-update` and finish with `NO_REPLY`.
9. Otherwise run `npm run review -- submit`. Report only the resulting pull-request URL and how many highlights were omitted by the deterministic privacy validator.

Never bypass the pull request, push raw conversations, or merge the Review Draft automatically.
