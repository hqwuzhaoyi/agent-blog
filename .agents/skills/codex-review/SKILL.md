---
name: codex-review
description: Use for scheduled or manual Agent Blog reviews from configured local Codex threads. Not for OpenClaw sources or general conversation summaries. Produces either a no-update result or a publication-safe Daily Review pull request.
---

# Codex Review

Use this skill only when the operator asks for an Agent Blog review or when the scheduled Agent Blog task invokes it.

The operator or scheduled-task prompt must provide the absolute path to the Publication Repository. Run every command from that directory.

## Workflow

1. Before collection, require the current Codex runtime to provide a non-empty `CODEX_THREAD_ID`. If it is missing, stop without collecting, writing a draft, or advancing any cursor. Never print or report its value. For the scheduled preceding Review Day, run `npm run review -- collect --exclude-thread-id "$CODEX_THREAD_ID"`. When the operator explicitly requests a manual trigger, run `npm run review:manual -- --exclude-thread-id "$CODEX_THREAD_ID"` instead. To review a particular date, also append `--day YYYY-MM-DD`.
2. Read `.agent-blog/review-window.json` and the `language` value in `.agent-blog/config.json`. These are private local inputs and must never be committed, quoted in the final response, or sent anywhere except the current Codex model turn.
3. Consider only the `messages` array already normalized by the collector. The collector excludes the current review task thread. Do not inspect Codex transcript files, reasoning, command output, file changes, tool calls, or subagent messages.
4. Select three to seven Work Highlights only when the work materially changed a project or the Agent Source's overall state. Completion of a meaningful deliverable, resolution of a key problem, removal of a blocker, an important decision, or discovery of a material risk can qualify. Time spent, token use, message count, routine edits, and intermediate attempts do not qualify.
5. Write every reader-facing field in the configured language (`en` or `zh-CN`), then write `.agent-blog/review-draft.json` with this shape:

```json
{
  "title": "Headline based on the most important change",
  "summary": "One short paragraph describing the day",
  "platforms": ["Codex"],
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

6. Apply a strict privacy judgment before writing the draft. Never include secrets, personal identifiers, customer names, private paths, internal URLs, private repository links, thread identifiers, or uncertain details. When uncertain, omit the entire Work Highlight. Mark evidence `public: true` only after confirming it is publicly accessible.
7. Use a neutral Review Voice. Do not invent a first-person agent persona and do not claim that a Reported Outcome was independently verified.
8. If no Work Highlight qualifies, run `npm run review -- no-update` and finish without creating a pull request.
9. Otherwise run `npm run review -- submit`. Report only the resulting pull-request URL and how many highlights were omitted by the deterministic privacy validator.

Never bypass the pull request, push raw conversations, or merge the Review Draft automatically.
