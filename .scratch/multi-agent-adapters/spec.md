# Hermes, Pi, and Claude Code Agent Platform adapters

Status: ready-for-agent

## Problem Statement

An Agent Operator can currently create Daily Reviews from OpenClaw and Codex, but work performed in Hermes, Pi, and Claude Code cannot enter the same Agent Blog workflow. The operator must either leave those Agent Platforms out of the review, manually rewrite their work, or route it through another platform. Those workarounds fragment the Daily Review and can encourage unsafe access to raw transcripts.

The new Agent Platforms expose different supported integration surfaces. Hermes can export sessions through a documented local CLI. Pi publishes a typed session SDK, but loading old sessions can migrate their files. Claude Code publishes a history SDK, but its historical message contract does not include enough timestamp and provenance data to reconstruct an exact Review Day safely. A single generic transcript parser would therefore be inaccurate and would violate the existing local privacy boundary.

The operator needs platform-specific local adapters that all produce the existing bounded Review Window, retain only Visible Messages, reuse each Agent Platform's configured model and authentication, and leave the current Git review and publication workflow unchanged.

## Solution

Add explicit Agent Platform support for Hermes, Pi, and Claude Code behind the existing Review Window contract.

Hermes collection will use the documented session export command and normalize its output in memory. Pi collection will use the published session SDK against private snapshots so authoritative session files are never migrated or rewritten. Claude Code will begin prospective coverage when project hooks are installed: direct user prompts and assistant text actually displayed to the operator will be written to a private normalized event journal, while the official Agent SDK will be used only for session inventory and coverage reconciliation.

All three adapters will apply an allowlist before writing the Review Window, retain only human and primary-agent text, filter the configured Review Day, maintain independent per-conversation cursors, exclude the review run itself, and fail closed on unknown or incomplete source data. Platform-local Review Skills will turn the private Review Window into the existing Publication-Safe Review Submission. The existing idempotent branch, pull-request approval, human merge, and static publication flow will remain shared.

Implementation will proceed in this order: explicit platform routing, Hermes, Pi, then Claude Code. This order delivers the lowest-risk supported collectors first while keeping Claude Code's prospective-only limitation visible.

## User Stories

1. As an Agent Operator, I want Hermes to be a supported Agent Platform, so that meaningful Hermes work can appear in my Daily Review.
2. As an Agent Operator, I want Pi to be a supported Agent Platform, so that meaningful Pi coding work can appear in my Daily Review.
3. As an Agent Operator, I want Claude Code to be a supported Agent Platform, so that meaningful Claude Code work can appear in my Daily Review.
4. As an Agent Operator, I want each configured platform instance to have an explicit Agent Source identity, so that reviews and retries cannot be attributed to the wrong platform.
5. As an Agent Operator, I want unknown platform identifiers to fail clearly, so that content never silently falls back to an OpenClaw label or collector.
6. As an Agent Operator, I want setup to detect the local platform binary and version without reading credential values, so that unsupported installations fail before collection.
7. As an Agent Operator, I want setup to verify the platform capabilities the adapter depends on, so that version numbers alone do not create false compatibility.
8. As an Agent Operator, I want all source conversations to remain on my machine, so that the Publication Repository never receives raw sessions.
9. As an Agent Operator, I want only Visible Messages written to the Review Window, so that hidden reasoning and execution traces never become review input.
10. As an Agent Operator, I want user and primary-agent text retained even when a platform stores it beside structured tool data, so that meaningful outcomes are not lost.
11. As an Agent Operator, I want system prompts, reasoning, thinking blocks, tool calls, tool results, shell output, file changes, images, generated summaries, and unknown content types excluded, so that the input remains understandable and privacy-bounded.
12. As an Agent Operator, I want intermediate-agent and background-agent activity excluded when the platform exposes sufficient provenance, so that implementation chatter is not presented as a Reported Outcome.
13. As an Agent Operator, I want an adapter to fail closed when intermediate-agent provenance cannot be established, so that uncertain content is not treated as publishable work.
14. As an Agent Operator, I want each adapter to honor my configured time zone, so that its messages are assigned to the correct Review Day.
15. As an Agent Operator, I want messages ordered deterministically, so that retries produce stable Review Windows and drafts.
16. As an Agent Operator, I want independent cursors for each Conversation Source, so that successful work is not reconsidered and failed work is not skipped.
17. As an Agent Operator, I want cursor advancement to remain transactional with successful submission or an explicit no-update result, so that collection failures cannot lose work.
18. As an Agent Operator, I want the current review conversation excluded from collection, so that a review does not recursively summarize itself.
19. As an Agent Operator, I want one configured Agent Source reviewed as a whole, so that platform sessions do not create fragmented daily articles.
20. As an Agent Operator, I want platform labels and source labels selected explicitly, so that a Hermes, Pi, or Claude Code review is never presented as OpenClaw or Codex.
21. As an Agent Operator, I want Hermes collection to use its documented session exporter, so that Agent Blog does not depend on Hermes SQLite or legacy transcript layouts.
22. As an Agent Operator, I want Hermes exports normalized as a stream, so that full history does not have to be retained in memory or written to disk.
23. As an Agent Operator, I want Hermes tool-source and cron sessions excluded, so that integrations and scheduled review activity do not become Daily Review input.
24. As an Agent Operator, I want Hermes live-parent delegated and background sessions excluded, so that intermediate-agent exchanges stay private.
25. As an Agent Operator, I want valid Hermes branches and compression continuations handled consistently, so that visible conversation continuity is not lost.
26. As an Agent Operator, I want Hermes reasoning and leaked reasoning or tool markup removed before the Review Window is written, so that provider internals cannot enter later stages.
27. As an Agent Operator, I want Hermes rewrite and compaction behavior detected, so that retries, undo, compression, or version changes do not silently duplicate or omit work.
28. As an Agent Operator, I want one Hermes profile or home treated as one Agent Source, so that isolated Hermes identities are not merged accidentally.
29. As an Agent Operator, I want to run the Hermes review manually, so that I can validate collection before enabling a schedule.
30. As an Agent Operator, I want to schedule Hermes through its supported cron facility or an OS scheduler, so that a Gateway-dependent schedule is optional.
31. As an Agent Operator, I want Pi collection to use the published Session Manager SDK, so that Agent Blog does not own Pi's session migration or parsing rules.
32. As an Agent Operator, I want Pi candidate sessions copied to restrictive private snapshots before loading, so that collection cannot rewrite authoritative session files.
33. As an Agent Operator, I want concurrent Pi appends detected during snapshotting, so that an incomplete session is deferred rather than partially reviewed.
34. As an Agent Operator, I want Pi user and assistant text selected by typed message and content-block allowlists, so that thinking, tools, shell execution, images, custom messages, and summaries are excluded.
35. As an Agent Operator, I want stable Pi session and entry identifiers used for cursors without exposing paths publicly, so that incremental collection remains reliable and private.
36. As an Agent Operator, I want Pi branch handling defined and deterministic, so that branch switches do not create accidental duplicate highlights.
37. As an Agent Operator, I want the Pi CLI and SDK versions checked as a tested pair, so that independently changing packages do not silently corrupt collection.
38. As an Agent Operator, I want custom Pi session directories supported explicitly, so that sessions are not missed when I override the default location.
39. As an Agent Operator, I want persistent third-party Pi subagents explicitly excluded or rejected when they cannot be identified, so that the adapter does not overstate its privacy guarantees.
40. As an Agent Operator, I want Pi review generation to run without creating a persisted Pi session, so that the review worker cannot collect itself later.
41. As an Agent Operator, I want Claude Code coverage to begin predictably when capture hooks are installed, so that I know exactly which Review Days are complete.
42. As an Agent Operator, I want direct Claude Code user prompts captured through a supported hook, so that synthetic user-role transcript entries are not mistaken for human input.
43. As an Agent Operator, I want Claude Code assistant text captured from the display hook, so that only text shown to me is treated as a Visible Message.
44. As an Agent Operator, I want partial Claude Code display batches assembled once and in order, so that streaming output does not produce duplicate or truncated messages.
45. As an Agent Operator, I want Claude Code hook retries deduplicated, so that repeated delivery cannot duplicate a Work Highlight.
46. As an Agent Operator, I want Claude Code hook capture separated from daily scheduling, so that ordinary session completion does not launch concurrent review jobs.
47. As an Agent Operator, I want the Claude Agent SDK used for inventory and coverage reconciliation, so that missed hooks are detected without inventing undocumented historical timestamps.
48. As an Agent Operator, I want pre-install Claude Code history excluded from exact Daily Reviews, so that incomplete historical data is not presented as complete coverage.
49. As an Agent Operator, I want existing Claude Code settings and hooks preserved during installation, so that Agent Blog does not break my current workflow.
50. As an Agent Operator, I want a Claude Code project Review Skill for manual and scheduled runs, so that review generation reuses my existing Claude model and authentication.
51. As an Agent Operator, I want a local Desktop task or OS scheduler to run Claude Code reviews, so that cloud-only jobs never need access to local conversations.
52. As an Agent Operator, I want private runtime files created with restrictive permissions, so that normalized messages and cursor state are not readable more broadly than necessary.
53. As an Agent Operator, I want malformed, oversized, partial, or unsupported source data to stop collection without advancing cursors, so that failure remains safe and retryable.
54. As an Agent Operator, I want installers to offer a non-mutating dry run, so that I can inspect planned platform, skill, hook, schedule, and private-state changes before applying them.
55. As an Agent Operator, I want installation to verify repository-scoped Git access without printing credentials, so that the scheduled Review Skill cannot modify unrelated repositories.
56. As an Agent Operator, I want each platform Review Skill to reuse its platform's model and provider configuration, so that Agent Blog stores no model API key.
57. As an Agent Operator, I want the deterministic privacy validator to run before Git for every platform, so that secrets and private identifiers cannot enter repository history.
58. As an Agent Operator, I want unsafe Work Highlights omitted as a whole, so that partial redaction does not leave sensitive context behind.
59. As an Agent Operator, I want no-update runs to advance successfully processed cursors without creating content or a pull request, so that minor work is not reconsidered forever.
60. As an Agent Operator, I want same-day retries to update the same Review Draft and pull request, so that adapter failures do not create duplicate proposals.
61. As an Agent Operator, I want publication to continue requiring human merge approval, so that adding platforms does not weaken editorial control.
62. As an Agent Operator, I want setup documentation to state each platform's collection and scheduling limitations, so that I can choose an adapter with informed expectations.
63. As an Agent Blog maintainer, I want each platform integration to have an accepted decision record, so that its supported upstream boundary and exclusions remain reviewable.
64. As an Agent Blog maintainer, I want platform fixtures to contain only synthetic data, so that automated tests never inspect a developer's real sessions.
65. As an Agent Blog maintainer, I want existing OpenClaw and Codex behavior to remain unchanged, so that adding new adapters does not regress current Agent Sources.
66. As a reader, I want Daily Reviews to retain the same Review Voice and article structure across platforms, so that the site remains coherent.
67. As a reader, I want contributing Agent Platforms attributed accurately, so that I can understand where Reported Outcomes originated without seeing private source details.

## Implementation Decisions

- The feature adds three Agent Platform adapters while preserving one platform-independent Review Window, Review Submission, publication workflow, and static site.
- Implementation order is explicit platform routing first, followed by Hermes, Pi, and Claude Code. Each phase must be independently releasable and leave existing Agent Platforms green.
- Platform selection uses an explicit registry of supported platform identifiers. Each entry supplies its collector and fallback attribution. Missing or unknown entries fail closed; there is no implicit OpenClaw fallback.
- The existing Review Window is the primary adapter contract. Each collector returns the Agent Source identity, Review Day, configured time zone, normalized Visible Messages, and candidate per-conversation cursors.
- Normalized messages contain only an opaque message identifier, opaque Conversation Source identifier, user or assistant role, timestamp, and visible text. Platform paths, titles, summaries, model metadata, raw payloads, and tool metadata are not part of the contract.
- All platform normalizers use allowlists. Unknown roles, content blocks, event types, and schemas are rejected rather than coerced into text.
- Review Day filtering happens locally after a platform supplies trustworthy message timestamps. Messages are globally ordered deterministically with stable identifiers as tie-breakers.
- Cursor advancement continues to use the existing transactional publication behavior. Collection or normalization errors never update state.
- Each review worker must provide its current Conversation Source identifier when the platform exposes one. Platform-specific automation sources are also excluded where necessary to prevent recursive reviews.
- One Hermes profile or configured home is one Agent Source. Internal Hermes source tags remain Conversation Source metadata rather than separate publication identities.
- Hermes collection uses the documented session exporter through direct process arguments. Raw export output is streamed, bounded, normalized immediately, and never persisted or logged.
- Hermes collection excludes system and tool roles, tool-source and cron sessions, live-parent delegated/background sessions, structured reasoning/tool fields, and upstream-recognized hidden markup. Valid user-created branches and compression continuations remain eligible.
- Hermes compatibility is capability-gated and tested against explicit releases rather than expressed as an unbounded minimum version. Compaction, inactive-message behavior, and transcript rewrite behavior must pass synthetic contract tests before a release is supported.
- Hermes Dashboard REST remains an optional future transport and is not required for the first adapter. The MCP conversation tools do not provide complete Daily Review coverage and are not used as the collector.
- Pi refers to the current `earendil-works/pi` coding agent and package scope, not Inflection's consumer assistant or the deprecated package scope.
- Pi collection uses the published Session Manager SDK for discovery, migration, and entry interpretation. Agent Blog does not implement a parallel JSONL parser.
- Pi session candidates are copied to private temporary snapshots before the SDK opens them. The collector verifies that the source did not change across the copy, retries or defers concurrent writers, and removes snapshots after normalization.
- Pi CLI and SDK versions form one tested compatibility matrix. Setup fails with an actionable message when package identity, feature availability, or versions fall outside that matrix.
- Pi normalization accepts explicit message entries with user or assistant text only. Thinking, tool calls, tool results, shell execution, images, custom messages, branch summaries, compaction summaries, labels, model changes, extension state, and unknown types are excluded.
- Pi uses the documented session header identity and stable entry identifiers for cursors. Local paths and human-readable session metadata remain private.
- Pi branch behavior is deterministic and covered by contract fixtures. Generated branch and compaction summaries are never substituted for Visible Messages.
- Persisted Pi sessions created by third-party subagent extensions require an explicit supported exclusion rule. Where provenance is unavailable, setup or collection fails closed rather than claiming generic subagent filtering.
- Pi review generation runs non-interactively without session persistence and uses an OS scheduler. An interactive extension command is optional and not required for the initial adapter.
- Claude Code uses prospective hook capture as the authoritative timestamped Visible Message feed. Historical Agent SDK data alone is not treated as an exact Review Window.
- Claude Code direct prompts are captured from the user-prompt hook. Assistant text is captured from the display hook, assembled by message and batch identity, and finalized once.
- The Claude Code hook journal stores only normalized text, opaque identifiers, local receipt timestamps, sequence values, and minimum reconciliation metadata. Raw hook payloads are never retained.
- Claude Code tool, thinking, image, document, result, synthetic, subagent, malformed, empty, and unknown events are excluded before the private journal is written.
- The Claude Agent SDK lists sessions and reads messages only to reconcile capture coverage. Missing documented timestamps are never replaced with filesystem modification time, session activity time, or other indirect values.
- Exact Claude Code Daily Review coverage starts after hook installation. Pre-install sessions and any period with an acknowledged hook coverage gap are not backfilled as complete Review Days.
- Claude Code installation requires a release that supports the display hook and a pinned, tested Agent SDK release. The installer merges with existing project hooks and settings rather than replacing them.
- Hooks perform event capture only. A local Desktop scheduled task or OS scheduler runs the review at the configured time. Cloud routines and session-scoped recurring commands are not used for local Daily Review collection.
- Each Agent Platform receives a repo-scoped Review Skill that reads only the private Review Window and configuration, writes the private Review Draft, and invokes the existing submit or no-update action.
- Review Skills reuse platform authentication, model selection, and provider configuration. Agent Blog stores no model credentials and never prints or validates credential values directly.
- Installers perform read-only binary, version, capability, authentication-status, repository, ignore-rule, and Git-access checks before making changes. Dry-run output describes planned changes without writing platform configuration, hooks, skills, schedules, or runtime state.
- Applying an installer is an explicit operator action. Platform configuration, skills, hooks, and scheduling changes are not performed as an incidental side effect of collection.
- Private journals, Review Windows, Review Drafts, snapshots, and cursor state remain outside tracked content and use restrictive file permissions.
- Existing local privacy screening, whole-highlight omission, Review Identity, no-update behavior, Git proposal, pull-request editing, human merge, and static publication remain unchanged.
- Platform and source fallback labels are explicit and tested. Public content may attribute the Agent Platform but never includes source paths, session identifiers, profile homes, or hook identifiers.
- One accepted decision record is added for each new platform boundary, following the existing OpenClaw and Codex decisions and documenting its supported upstream interface, source boundary, exclusions, and scheduling model.

## Testing Decisions

- The primary test seam is the highest existing platform boundary: given platform-owned synthetic input, configuration, Review Day, and cursor state, a collector produces the standard Review Window or a safe failure. Tests assert the contract and never private helper call order.
- A second, existing workflow seam verifies that a standard Review Window produces the same Publication-Safe Review Submission, idempotent proposal, cursor advancement, no-update result, and static output regardless of Agent Platform.
- Platform fixtures contain only synthetic prompts, assistant text, reasoning, tools, paths, identifiers, and timestamps. Automated tests never read the developer's real Hermes, Pi, or Claude Code state.
- Shared collector contract tests verify user and assistant visible text retention, exclusion of every non-visible category, Review Day time-zone boundaries, deterministic ordering, per-conversation cursors, self-review exclusion, malformed-data failure, and failure atomicity.
- Platform routing tests verify that every supported identifier resolves explicitly and unknown identifiers fail rather than falling back to OpenClaw.
- Attribution tests verify correct platform and source fallback labels for all five supported Agent Platforms and ensure private source metadata never enters rendered Markdown.
- Hermes tests use a fake executable that exposes the documented exporter behavior. They verify exact process arguments, incremental stdout parsing across arbitrary chunks, bounded stderr, oversized-line rejection, non-zero exit handling, and absence of raw export files.
- Hermes fixtures cover normal user/assistant text, structured tools, all reasoning fields, leaked hidden markup, tool and cron sources, delegated children, branches, compression continuations, rewrite recovery, inactive messages, and capability differences across supported versions.
- Hermes compatibility smoke tests run only against an isolated synthetic profile. They never use real sessions or credentials and are optional outside the supported-version matrix job.
- Pi tests use a temporary synthetic session directory and the pinned official SDK. They exercise discovery, snapshot loading, stable identities, branch behavior, old-format migration, and unknown future entry types through public SDK behavior.
- Pi snapshot tests prove that source bytes, permissions, and modification metadata remain unchanged after collection. Concurrent-write tests mutate a candidate during copy and assert retry or deferral without cursor advancement.
- Pi compatibility tests cover every declared CLI and SDK version pair and fail setup for deprecated package identity, incompatible versions, or missing SDK capabilities.
- Claude Code hook tests feed synthetic user-prompt and display events through the capture seam. They verify ordered batch assembly, finalization, retry deduplication, monotonic receipt sequencing, concurrent sessions, self-review exclusion, and restrictive journal output.
- Claude Code SDK tests inject session inventory and message readers. They verify pagination and reconciliation while asserting that missing historical timestamps never acquire inferred Review Day values.
- Claude Code coverage-gap tests verify that pre-install sessions, missing hook intervals, malformed journals, and subagent uncertainty are reported as incomplete rather than silently backfilled or cursor-advanced.
- Installer tests verify absent binaries, unsupported versions, capability failures, unauthenticated review workers, alternate binary locations, dry runs, existing settings preservation, restrictive permissions, and repository-scoped Git access without credential disclosure.
- Review Skill tests start from a private Review Window rather than a raw platform transcript. They verify that the skill reads no additional conversation, tool, reasoning, credential, or source-storage data.
- Privacy fixtures include secrets, personal identifiers, local paths, internal links, private repository links, tool arguments, reasoning text, session identifiers, and mixed safe/unsafe highlights. Assertions check known-safe output and whole-highlight omission.
- Idempotency tests repeat the same Agent Source and Review Day and assert one Review Draft and one publication proposal. Failed publication retains cursors; successful submission and explicit no-update advance only eligible cursors.
- Regression verification runs all existing OpenClaw, Codex, review generation, publication workflow, theme, static site, archive, and RSS tests after each platform phase.
- The final smoke verification uses isolated synthetic platform state to collect a Review Window, generate a draft, scan the proposed Git diff for sensitive values, retry without duplication, and exercise no-update. It does not require or inspect real platform sessions.

## Out of Scope

- Historical Claude Code backfill before supported per-message timestamps and sufficient provenance are available
- Treating an incomplete Claude Code hook interval as a complete Review Day
- Direct parsing of Claude Code transcript JSONL
- Direct parsing of Hermes SQLite, routing indexes, or legacy transcript JSONL
- Making the Hermes Dashboard or MCP server a required runtime dependency
- Hand-written Pi session parsing when the supported SDK is available
- Generic support for arbitrary persistent Pi subagent extensions without a documented provenance or exclusion contract
- A Pi event extension that triggers a review after every completed turn or session
- Remote collection from another machine or a hosted ingestion service
- Uploading source conversations, hook payloads, snapshots, or Review Windows to an external service
- Combining multiple configured Agent Sources into one Review Identity
- Project-level ingestion authorization or separate Daily Reviews per project, workspace, session, branch, or subagent
- Historical backfill beyond the bounded initial Review Window for any platform
- Changes to Work Highlight selection, Review Voice, article schema, themes, static routes, RSS, or hosting
- Automatic publication, automatic pull-request merge, or removal of the human approval gate
- Model-provider installation, provider credential management, or model API-key storage in Agent Blog
- Independent verification of Reported Outcomes through tool traces, source repositories, or command output

## Further Notes

- The platform research and primary-source evidence are recorded in [Hermes research](./hermes.md), [Pi research](./pi-agent.md), and [Claude Code research](./claude-code.md).
- The accepted implementation order and principal tradeoffs are summarized in [the adapter recommendation](./recommendation.md).
- The implementation issues in this feature directory separate explicit routing, Hermes, Pi, and Claude Code so each phase can be reviewed and shipped independently.
- The testing seam was selected from the existing OpenClaw and Codex collector contract: platform-owned source data becomes a bounded Review Window, after which all privacy, generation, idempotency, Git, and publication behavior is shared.
- Pi in this specification means the installed `earendil-works/pi` coding agent.
- Claude Code support is intentionally prospective. This is a product boundary, not a temporary parser omission.
