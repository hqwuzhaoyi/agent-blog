# Agent Blog MVP

Status: ready-for-agent

## Problem Statement

An Agent Operator can leave OpenClaw running across many sessions and agents, but reviewing what it accomplished requires manually opening conversations, reconstructing work across sessions, and separating meaningful progress from routine chatter. Existing transcripts contain too much operational detail, can expose private information, and are not suitable for public sharing.

The Agent Operator needs a low-maintenance way to turn one OpenClaw Gateway's daily Visible Messages into a short, Publication-Safe account of the work that materially changed a project or the Agent Source's overall state. The result must remain editable and private until explicitly approved, while publishing should require no separate content management system.

## Solution

Provide a self-hosted Astro Agent Blog and an OpenClaw Review Skill. The Agent Operator forks and deploys one Publication Repository, then sends an onboarding instruction to OpenClaw. OpenClaw verifies its Gateway and repository-scoped GitHub access, configures the Agent Blog time zone, installs a scheduled review, and performs a preview check.

At 00:15 in the configured time zone, the Review Skill reads the preceding Review Day through upstream-supported OpenClaw Gateway interfaces. It considers Visible Messages across all agents and sessions in that Gateway, excludes hidden reasoning, tool-call streams, and intermediate-agent exchanges, and uses OpenClaw's existing model configuration to select a small number of Work Highlights. It applies local privacy filtering before any content reaches Git.

When the Review Window contains material progress, OpenClaw produces one Publication-Safe Review Submission for the Agent Source. The submission uses a neutral Review Voice, may organize Work Highlights into inferred Project Groups, and is pushed as Astro-compatible Markdown on a branch with a pull request. The Agent Operator edits and approves the Review Draft by merging the pull request, after which GitHub Actions publishes the Astro site to GitHub Pages. When there are no Work Highlights, the run advances its cursors and reports that there was no important update without creating an article or pull request.

## User Stories

1. As an Agent Operator, I want to fork one repository, so that I can own and self-host my Agent Blog.
2. As an Agent Operator, I want the first version to work without a hosted SaaS account, so that my review data stays under my control.
3. As an Agent Operator, I want to send one onboarding instruction to OpenClaw, so that setup feels native to the agent environment.
4. As an Agent Operator, I want onboarding to verify that the OpenClaw Gateway is available, so that scheduling does not succeed against an unusable source.
5. As an Agent Operator, I want onboarding to verify repository-scoped GitHub access, so that publication failures are discovered before the first scheduled run.
6. As an Agent Operator, I want onboarding to configure my time zone, so that each Daily Review matches my local calendar day.
7. As an Agent Operator, I want onboarding to install the Review Skill and daily schedule, so that I do not need to assemble the workflow manually.
8. As an Agent Operator, I want onboarding to run a preview, so that I can verify the configuration without publishing content.
9. As an Agent Operator, I want one OpenClaw Gateway configuration to cover all of its agents and sessions, so that I do not configure each agent separately.
10. As an Agent Operator, I want the Review Skill to use upstream-supported Gateway interfaces, so that it does not depend on OpenClaw's internal transcript format.
11. As an Agent Operator, I want review generation to run on the Gateway host, so that it reads the authoritative session state.
12. As an Agent Operator, I want only human and primary-agent Visible Messages considered, so that reviews remain understandable and token-efficient.
13. As an Agent Operator, I want hidden reasoning excluded, so that private model internals are never treated as publishable content.
14. As an Agent Operator, I want tool-call streams excluded, so that routine execution noise does not dominate the review.
15. As an Agent Operator, I want intermediate-agent exchanges excluded, so that implementation chatter is not mistaken for an outcome.
16. As an Agent Operator, I want the first run limited to the previous 24 hours, so that connecting an existing Gateway does not summarize its entire history.
17. As an Agent Operator, I want each session to maintain an incremental cursor, so that later runs consider only new messages.
18. As an Agent Operator, I want one Daily Review for the entire Agent Source, so that one OpenClaw installation does not produce fragmented agent-specific posts.
19. As a reader, I want related Work Highlights organized into Project Groups when they can be identified safely, so that a multi-project day remains readable.
20. As a reader, I want unclassified Work Highlights grouped as other work, so that uncertain project classification does not block the review.
21. As an Agent Operator, I want importance determined by whether work materially changed project state, so that verbosity, time spent, or token usage do not create false importance.
22. As a reader, I want only a small set of important Work Highlights, so that I can understand the day quickly.
23. As a reader, I want a headline based on the most important development, so that the archive communicates more than dates alone.
24. As a reader, I want a short overall summary, so that I can understand the shape of the day before reading individual highlights.
25. As a reader, I want each Work Highlight to say what changed, what resulted, and why it mattered, so that the article remains useful without execution detail.
26. As a reader, I want material blockers or decisions called out when present, so that the review does not present progress without relevant constraints.
27. As a reader, I want a neutral Review Voice, so that the article does not pretend multiple tools share a fictional personality.
28. As a reader, I want contributing Agent Platforms attributed separately, so that I know which systems contributed without splitting the narrative.
29. As an Agent Operator, I want Public Evidence to be optional, so that private work can still be summarized without exposing internal artifacts.
30. As a reader, I want Public Evidence limited to confirmed-public links, so that I am not sent to inaccessible or private resources.
31. As an Agent Operator, I want secrets removed locally, so that credentials never enter Git history.
32. As an Agent Operator, I want personal identifiers, private paths, internal links, and customer-identifying information removed locally, so that public reviews do not leak sensitive context.
33. As an Agent Operator, I want uncertain content omitted entirely, so that privacy defaults toward non-disclosure.
34. As an Agent Operator, I want raw conversations to remain on the OpenClaw host, so that the Publication Repository receives only compressed review content.
35. As an Agent Operator, I want the Review Skill to reuse OpenClaw's configured model, so that the Agent Blog manages no model API keys.
36. As an Agent Operator, I want a day with no Work Highlights to create no article or pull request, so that the public site is not filled with empty updates.
37. As an Agent Operator, I want a no-update run to advance successfully read session cursors, so that minor work is not reconsidered forever.
38. As an Agent Operator, I want each Review Draft to remain private until I approve it, so that I retain editorial and privacy control.
39. As an Agent Operator, I want each Review Draft submitted as Markdown in a pull request, so that I can review and edit it with familiar Git tools.
40. As an Agent Operator, I want merging the pull request to publish the review, so that Git is the only editorial workflow required.
41. As an Agent Operator, I want retries for the same Agent Source and Review Day to update the existing Review Draft, so that failures do not create duplicate articles or pull requests.
42. As an Agent Operator, I want session cursors advanced only after a successful push, so that failed publication does not lose messages.
43. As an Agent Operator, I want the Review Skill's Git authority limited to the Publication Repository, so that a compromised scheduled job cannot modify unrelated repositories.
44. As an Agent Operator, I want the Review Skill never to inspect credential values, so that setup and scheduled runs do not expose authentication material.
45. As a reader, I want a home page showing recent Published Reviews, so that I can quickly see current activity.
46. As a reader, I want a dedicated page for each Published Review, so that a daily account has a stable shareable URL.
47. As a reader, I want a chronological archive, so that I can follow the Agent Source's work over time.
48. As a reader, I want an RSS feed, so that I can subscribe without repeatedly visiting the site.
49. As an Agent Operator, I want the site generated as static output, so that it is inexpensive and simple to host.
50. As an Agent Operator, I want merges to the publication branch deployed automatically to GitHub Pages, so that publication requires no second manual deployment step.

## Implementation Decisions

- The first release is a single-operator, self-hosted Agent Blog rather than a multi-tenant service.
- Astro provides the static site and content collection for Published Reviews.
- GitHub Pages is the default hosting target, with GitHub Actions building and deploying the static site after publication-branch merges.
- The public site contains a recent-review home page, individual review pages, a chronological archive, and RSS.
- Search, comments, reactions, accounts, and an editorial administration interface are not part of the first release.
- OpenClaw is the only Agent Platform adapter in the first release. Hermes is the next intended adapter but is not implemented by this spec.
- One OpenClaw Gateway is one Agent Source. All of its agents and sessions are considered together for one Daily Review.
- The OpenClaw adapter runs on the Gateway host and reads session data only through upstream-supported Gateway interfaces.
- The adapter does not parse OpenClaw transcript JSONL files. Default directories may be used only to detect an installation or configuration.
- Only Visible Messages are eligible input. Hidden reasoning, tool-call streams, and intermediate-agent exchanges are excluded before summarization.
- The Review Skill runs locally and uses OpenClaw's existing model and provider credentials. The Publication Repository owns no model secrets.
- The first Review Window covers the previous 24 hours. Later windows begin at saved per-session cursors.
- Review Days use a configured time zone, defaulting to the Gateway host time zone. The scheduled run starts at 00:15 and summarizes the preceding local calendar day.
- A Daily Review belongs to the Agent Source. Project Groups are optional inferred presentation groupings, not ingestion or authorization boundaries.
- Work Highlights are selected editorially. A task qualifies when it materially changes project or Agent Source state, such as completing a meaningful deliverable, resolving a key problem, removing a blocker, making an important decision, or discovering a material risk.
- Time spent, message volume, and token usage are not importance signals on their own.
- A typical review contains a generated headline, a short overall summary, three to seven Work Highlights, optional material blockers or decisions, the Review Day, and Agent Platform attribution.
- Minor tasks, intermediate attempts, detailed timelines, token statistics, message counts, and tool execution details are omitted or briefly grouped.
- The Review Voice is neutral and report-like. It does not invent an independent agent persona.
- Public Evidence is optional and limited to links that can be confidently identified as public. Local paths, session identifiers, private repository links, and uncertain URLs are excluded.
- Privacy filtering happens locally before any Git commit. Secrets, personal identifiers, private locations and links, and customer-identifying information are removed. If safety is uncertain, the entire affected Work Highlight is omitted.
- The Publication Repository receives a Publication-Safe Review Submission, never source conversations.
- A Review Window with no Work Highlights creates no Markdown and no pull request. The scheduled result reports no important update and advances cursors for successfully processed messages.
- A Review Submission is Astro-compatible Markdown committed on a branch and proposed through a pull request.
- The pull request is the preview, editing, approval, and audit surface. Merging it creates the Published Review.
- Review Identity is the combination of Agent Source and Review Day. Retries update the existing Markdown and pull request for that identity.
- Per-session cursors advance only after the Review Submission has been pushed successfully. A failed run remains retryable without message loss.
- Git and GitHub CLI authentication are reused from the Gateway host and must be limited to the Publication Repository. The Review Skill verifies access without reading or persisting credentials.
- README onboarding is agent-native: the Agent Operator sends one setup instruction to OpenClaw, which installs the Review Skill, validates dependencies and access, writes configuration, creates the scheduled job, and runs a non-publishing preview.
- The implementation must preserve the vocabulary and current decisions in the root domain glossary and accepted ADRs. Superseded ADRs are historical only.

## Testing Decisions

- Tests verify externally observable behavior through the highest practical seams and do not assert private functions, prompt assembly details, internal call order, or implementation-specific module structure.
- The Review Generation seam accepts a bounded set of Visible Messages and produces either a Publication-Safe Review Submission or a no-update result. Tests cover material versus minor work, exclusion of non-visible message types, Project Group fallback, article structure, optional Public Evidence, and whole-highlight omission when privacy is uncertain.
- The Publication Workflow seam starts from an Agent Source, Review Day, per-session cursors, and generated Review Draft. Tests cover stable Review Identity, same-day retry updating instead of duplicating, no-update cursor advancement, failed-push cursor retention, and successful-push cursor advancement.
- The Static Site seam builds from representative Published Reviews. Tests verify that recent reviews, individual pages, chronological archive entries, and RSS items are produced with stable URLs and publication-safe metadata.
- OpenClaw Gateway, model execution, GitHub, and wall-clock time are external system boundaries and may be replaced with controlled test doubles. Internal project modules are not mocked.
- Privacy expectations use fixed adversarial fixtures containing API keys, emails, usernames in absolute paths, internal URLs, customer names, private repository links, and mixed safe/unsafe highlights. Assertions use known safe output literals rather than reproducing the sanitizer algorithm.
- Idempotency expectations use a fixed Agent Source and Review Day and assert externally that only one review and one publication proposal exist after repeated runs.
- Site tests operate on representative content fixtures and built output rather than snapshots of component internals.
- The repository is currently greenfield and contains no prior application-test conventions. The implementation should establish these three seams rather than create fine-grained unit-test coverage for every helper.
- A final smoke verification must build the Astro site, generate a Review Draft from fixture Gateway data, confirm that sensitive values are absent from the entire proposed Git diff, repeat the run without creating a duplicate, and exercise the no-update path.

## Out of Scope

- Multi-tenant hosting, user accounts, organizations, billing, or centralized permissions
- A hosted ingestion API, database, or web-based editorial administration interface
- Agent Platform adapters other than OpenClaw, including Hermes, Codex, and Claude Code
- Reading a remote OpenClaw Gateway from another host
- Direct parsing of OpenClaw session stores or transcript JSONL files
- Reading or publishing hidden reasoning, chain-of-thought content, tool-call streams, or intermediate-agent conversations
- Historical backfill beyond the initial 24-hour Review Window
- Complete activity logs, audit-grade execution proof, or independent verification of Reported Outcomes
- Mandatory evidence links or access to private source repositories
- Automatic publication without pull-request approval
- One Daily Review per OpenClaw agent, session, workspace, or project
- Manual per-session or per-project source configuration
- Configurable behavior for days without Work Highlights
- Search, comments, likes, social networking, and project detail pages
- Custom model-provider setup or model API-key management
- A fictional agent persona or platform-specific first-person narrative

## Further Notes

- The design intentionally favors a concise, selective narrative over completeness. A Daily Review is not an audit log, and a Work Highlight contains a Reported Outcome rather than an independently verified fact.
- Local privacy filtering is a hard boundary because removing content in a later commit does not reliably remove it from Git history.
- The OpenClaw upstream documentation identifies the Gateway as the session-state authority and recommends bounded history access rather than unbounded transcript materialization.
- OpenClaw is not installed in the current development environment, so the first implementation must use contract fixtures and controlled Gateway boundaries before live validation on an OpenClaw host.
- Completion requires all three agreed test seams to pass, the GitHub Pages production build to succeed, and the onboarding documentation to describe the exact permissions and privacy boundary without overstating verification guarantees.
