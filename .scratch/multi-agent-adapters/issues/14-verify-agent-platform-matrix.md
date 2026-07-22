# 14 — Verify the five-platform Daily Review matrix

**What to build:** An Agent Operator can select OpenClaw, Codex, Hermes, Pi, or Claude Code and receive the same safe Review Draft, proposal, approval, and publication lifecycle with accurate platform attribution and documented limitations.

**Blocked by:** 09 — Configure scheduled Hermes Daily Reviews; 11 — Configure scheduled Pi Daily Reviews; 13 — Configure scheduled Claude Code Daily Reviews.

**Status:** ready-for-agent

- [ ] The complete automated suite passes for all platform collectors, privacy validation, Review Generation, publication workflow, themes, static pages, archive, and RSS.
- [ ] Isolated synthetic smoke runs cover collection, Review Draft generation, sensitive-diff scanning, same-day retry, proposal idempotency, and no-update for every platform.
- [ ] No smoke or automated test reads real sessions, credentials, profile data, hook payloads, or source repositories.
- [ ] Platform and source attribution is correct for all five platforms, and unknown platform configuration fails closed.
- [ ] Each new platform has an accepted decision record that matches its implemented upstream interface, source boundary, exclusions, scheduling model, and compatibility policy.
- [ ] Operator documentation covers setup, dry run, manual trigger, scheduling, privacy boundaries, upgrade checks, supported versions, and known coverage limitations for each platform.
- [ ] Existing OpenClaw and Codex behavior remains unchanged, and no source conversation, local path, session identifier, reasoning, tool data, or credential value appears in proposed Git content.

## Comments

- 2026-07-22: Added a synthetic public-registry acceptance matrix in `test/platform-matrix.test.mjs` with closed fixtures under `test/fixtures/platform-matrix/`. The matrix covers OpenClaw, Codex, Hermes, Pi, and Claude Code for standard Review Window collection, exact platform/source attribution, whole-highlight privacy omission, same-day Review Identity and proposal idempotency, no-update cursor advancement, and failed-publication cursor retention. Unknown platforms fail closed before collection. Targeted result: 21/21 tests passed. Full result: 21 test files and 160/160 tests passed, including all three Theme builds and the Astro static build. No product gap was found in this slice; no real session, credential, hook payload, profile data, or source repository was read.
