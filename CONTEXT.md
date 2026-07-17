# Agent Worklog

This context describes how people understand and review work performed by long-running agents.

## Language

**Agent Blog**:
A self-hosted site owned by one Agent Operator that publishes approved Daily Reviews from configured Agent Sources.
_Avoid_: Multi-tenant platform, hosted service, agent social network

**Theme**:
A selectable presentation package for an Agent Blog. It may reuse shared presentation components or replace them, but it does not change review content, publication rules, or source processing.
_Avoid_: CSS preset, independent blog application, publication workflow

**Theme Slot**:
A stable presentation boundary rendered by a shared default component or an optional Theme replacement. It receives prepared blog content, labels, and actions but owns no routing, content discovery, or publication behavior.
_Avoid_: Route, page fork, data adapter

**Review Voice**:
The neutral narrative perspective used by a Daily Review to describe an Agent Source's work, optionally organized into Project Groups and with contributing Agent Platforms attributed separately.
_Avoid_: Agent persona, platform-specific first person

**Publication-Safe**:
The state of review content after local privacy screening has removed secrets, personal identifiers, private locations, internal links, and customer-identifying information. Uncertain content is omitted rather than partially exposed.
_Avoid_: Probably safe, reviewed later, masked after push

**Public Evidence**:
An optional, confirmed-public link to an artifact supporting a Work Highlight. Private repository links, local paths, session identifiers, and URLs of uncertain visibility do not qualify.
_Avoid_: Raw log, required proof, private artifact

**Agent Operator**:
An independent developer or small-team lead responsible for one to five long-running agents.
_Avoid_: User, blog author, administrator

**Daily Review**:
An Agent Source's derived daily summary through which an Agent Operator understands the day's selected Work Highlights, failures, and decisions requiring human input.
_Avoid_: Morning brief, daily blog post, activity dump

**Review Draft**:
A generated Daily Review that remains private until an Agent Operator approves it for publication.
_Avoid_: Published article, automatic post

**Review Submission**:
A Review Draft generated locally from an Agent Source and pushed to the blog system without its source conversations.
_Avoid_: Raw transcript upload, published article

**Review Skill**:
The platform-local instructions that turn a Review Window into a Publication-Safe Review Submission using the Agent Source's configured model.
_Avoid_: Central summarization service, Astro renderer, model provider

**Published Review**:
A Daily Review approved through Git review and merged into the publication branch for the site to render publicly.
_Avoid_: Review Draft, unreviewed submission

**Publication Repository**:
The single Git repository containing the Agent Blog and its review content, and the only repository to which the Review Skill receives write access.
_Avoid_: Source project, OpenClaw workspace, general GitHub account

**Work Highlight**:
A concise, selected account of reported work that materially changed a project or the Agent Source's overall work state. Minor tasks, execution details, intermediate attempts, and work that was merely verbose or time-consuming are omitted or briefly grouped.
_Avoid_: Work Record, activity log, task transcript

**Visible Message**:
A human or primary-agent message exposed in the conversation. Hidden reasoning, tool-call streams, and intermediate-agent exchanges are excluded.
_Avoid_: Full trace, chain of thought, raw transcript

**Reported Outcome**:
A work result inferred from Visible Messages without independent verification that the underlying action succeeded.
_Avoid_: Verified fact, execution trace

**Review Window**:
The bounded set of new Visible Messages considered for one scheduled review. The initial window covers the previous 24 hours; later windows advance from saved per-session cursors.
_Avoid_: Full history, entire transcript, calendar archive

**Review Day**:
The local calendar day represented by a Daily Review, determined by the Agent Blog's configured time zone.
_Avoid_: UTC day, run date, rolling 24-hour label

**Review Identity**:
The unique pairing of an Agent Source and Review Day used to update one Review Draft safely across retries.
_Avoid_: Cron run ID, pull-request number, generated filename

**Agent Platform**:
A supported local agent product that exposes Conversation Sources through an upstream-supported interface.
_Avoid_: Model, model provider, agent instance

**Agent Source**:
A configured Agent Platform instance whose Conversation Sources are reviewed together. In the OpenClaw adapter, one Gateway is one Agent Source.
_Avoid_: Agent Platform, OpenClaw agentId, project

**Conversation Source**:
A conversation or session discovered from an Agent Platform that can supply Visible Messages.
_Avoid_: Raw directory, model session

**Project Group**:
An optional grouping of related Work Highlights within a Daily Review. It is inferred for readability and is not an ingestion or authorization boundary.
_Avoid_: Agent Source, tracked workspace, separate blog
