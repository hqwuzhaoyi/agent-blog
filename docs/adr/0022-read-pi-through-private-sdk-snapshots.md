# Read Pi through private SDK snapshots

The Pi adapter runs on the machine that owns the local Pi sessions and discovers
Conversation Sources through the published `@earendil-works/pi-coding-agent` Session Manager
SDK from the `earendil-works/pi` project. The repository pins SDK `0.81.1`; setup accepts the
same `0.81.x` CLI line only when it exposes print, no-session, and explicit-skill flags, and
requires session format v3 plus static `SessionManager.listAll()` and `SessionManager.open()`.
Agent Blog does not implement a parallel Pi JSONL parser. Before the SDK opens a candidate, the
adapter copies it into a mode-`0700` temporary directory, restricts the snapshot to mode
`0600`, and verifies that the authoritative source's device, inode, size, modification time,
and change time remained stable across the copy.

Only the private snapshot is passed to the SDK, so an upstream legacy-session migration can
rewrite the snapshot but cannot rewrite the Agent Operator's authoritative session. A source
that changes during snapshotting is deferred without being opened and without producing a
cursor candidate. Snapshots are removed after success or failure, and platform errors are
reported through stable codes that contain neither session bodies nor local paths.

This boundary supplies in-memory SDK entries to the Pi collector. The collector considers
explicit message entries across the full session tree, orders them by entry timestamp and
stable opaque entry ID, and retains only user and assistant text on the configured Review
Day. It excludes thinking, tool calls and results, shell execution, images, custom messages,
generated summaries, model and label state, the current review session, and sessions
explicitly classified as persistent subagents. Per-session cursors are proposed only from
fresh Visible Messages in stable sources; a deferred source retains its private defer reason
and receives no candidate cursor.

Live collection and registry fixtures share the exported normalized-session builder. Its input
is the closed in-memory shape `{ sessionId, provenance, entries }` after an SDK contract has
already interpreted the fixture. It rejects extra fields, paths, raw session text, uncertain
provenance, and unknown entry schemas. The builder never returns `deferred`; only the live
snapshot loader can observe and attach that private state.

The supported SDK facade classifies an explicitly configured excluded session as `subagent`.
It classifies every other loaded session as `primary` only when the Agent Operator explicitly
confirmed that the selected Pi Agent Source has no persistent subagents. Without that
confirmation, provenance is `unknown` and the whole collection fails closed. Entry, role, and content
schemas use versioned allowlists: known non-visible forms are excluded, while malformed or
unknown forms fail closed instead of producing a partial Review Window. Local source paths,
session names, working directories, SDK errors, and snapshot paths are not part of the
Review Window.

The repository-local Review Skill lives under `.agents/skills/pi-review/`, an upstream-supported
Pi project skill location. Scheduled and manual workers invoke it with `pi -p --no-session`, so
the review uses the existing Pi provider and model configuration without persisting a review
session. The skill consumes only the normalized private Review Window. Setup may describe an
operating-system schedule, but it never installs or mutates one automatically.

Setup fails closed unless Git confirms `.agent-blog` is ignored and GitHub reports `WRITE`,
`MAINTAIN`, or `ADMIN` for the current Publication Repository. Because GitHub CLI cannot prove
that a credential is limited to one repository, the Agent Operator must explicitly confirm
repo-scoped authority; setup records only that boolean confirmation. Pi exposes no reliable
auth-only status command: its available-model listing reflects configured-auth detection rather
than live credential validation and may initialize auth storage. Setup therefore verifies the
official non-secret CLI capability contract through `pi --help`, requires a separate explicit
operator confirmation that Pi authentication works, and never reads credential values. Apply
stores only these confirmation booleans in the mode-`0600` private configuration.
