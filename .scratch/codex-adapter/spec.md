# Codex Agent Source adapter

Status: implemented

## Problem Statement

An Agent Operator who works in local Codex threads cannot include that work in an Agent Blog without routing it through OpenClaw. Reading Codex's internal transcript files would couple the project to private storage formats and risk including reasoning or tool activity that is not a Visible Message.

## Solution

Add Codex as an Agent Platform adapter backed by the supported local `codex app-server` protocol. One local Codex installation is one Agent Source. The collector lists active and archived interactive threads, reads persisted turns, normalizes only user and agent text messages, and maintains an incremental cursor per thread.

A repo-scoped Codex Review Skill turns the private Review Window into the existing Review Draft contract. A local ChatGPT desktop scheduled task invokes that skill at 00:15, reusing the operator's Codex authentication and model configuration. The existing privacy validator, Git publication workflow, and human merge gate remain unchanged.

## Acceptance Criteria

- Collection uses `thread/list` and `thread/read(includeTurns: true)` through `codex app-server`.
- Active and archived interactive threads are considered.
- The Codex thread running the review workflow is excluded.
- User and agent text messages are retained as Visible Messages.
- Reasoning, plans, commands, file changes, tool calls, images, and subagent activity are excluded before the Review Window is written.
- Review Day filtering uses the configured local time zone.
- Successful submission and no-update runs advance independent per-thread cursors.
- Existing OpenClaw configuration remains the default and its tests continue to pass.
- Codex setup stores no model API key and uses a repo-scoped skill.
- Setup documentation explains the local-checkout scheduling and privacy boundaries.

## Out of Scope

- Parsing Codex transcript or rollout files
- Collecting cloud-only threads that are unavailable through the local app-server
- Remote app-server collection
- Automatic publication without pull-request approval
- Managing scheduled tasks from Codex CLI
