# Read Codex through app-server

The Codex adapter runs on the machine that owns the local Codex threads and reads them through the supported `codex app-server` protocol. It lists both active and archived interactive threads, excludes the thread currently running the review, and requests persisted turns updated on or after the Review Day. It retains only user and agent message text as Visible Messages. It does not parse Codex transcript or rollout files, and it excludes reasoning, commands, file changes, tool calls, images, and subagent activity before review generation.

The Codex Review Skill runs in a local Codex scheduled task, reusing Codex's existing authentication, model configuration, and repo-scoped skill discovery. The task must use the main local checkout so ignored cursor state under `.agent-blog/` persists across runs; cloud-only tasks and remote collection remain outside this adapter.
