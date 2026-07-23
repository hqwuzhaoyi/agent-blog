---
name: pi-review
description: Use for scheduled or manual Agent Blog reviews from a configured local Pi Agent Source. Produces either a no-update result or a Publication-Safe Daily Review pull request.
compatibility: Run from the Publication Repository with Pi 0.81.x in ephemeral print mode.
---

# Pi Review

Use this skill only when the Agent Operator requests an Agent Blog review or the scheduled Agent Blog worker invokes it. The worker must run this skill through `pi -p --no-session`; never create or resume a persistent Pi session for a review.

Run every command from the Publication Repository. Use the existing Pi provider and model configuration. Do not change provider, model, extension, or global Pi settings.

## Workflow

1. Run `npm run review -- collect` for the scheduled preceding Review Day. For an explicit manual trigger, run `npm run review -- manual`; append `--day YYYY-MM-DD` only when the Agent Operator requested a specific Review Day.
2. Read `.agent-blog/review-window.json` as the only conversation input and read only the `language`, publication, and privacy settings required from `.agent-blog/config.json`. These files remain private local inputs. Never commit or quote the Review Window.
3. Consider only the normalized `messages` array. Do not discover or inspect Pi Conversation Sources, hidden reasoning, tools, command output, local changes, or intermediate-agent exchanges.
4. Select three to seven Work Highlights only when work materially changed a project or the Agent Source's overall state. Routine activity and intermediate attempts do not qualify.
5. Write every reader-facing field in the configured language, then write `.agent-blog/review-draft.json` using the repository's Review Draft schema.
6. Apply strict privacy screening before writing. Omit an entire Work Highlight when any detail may expose a secret, person, customer, private path, internal URL, private repository, session identifier, or uncertain information. Public evidence must be independently confirmed public.
7. Use a neutral Review Voice and describe results as Reported Outcomes, not independently verified facts.
8. If no Work Highlight qualifies, run `npm run review -- no-update` and finish without a pull request.
9. Otherwise run `npm run review -- submit`. Report only the pull-request URL and the count omitted by deterministic privacy validation.

Never bypass Git review, publish raw conversations, or merge the pull request automatically.
