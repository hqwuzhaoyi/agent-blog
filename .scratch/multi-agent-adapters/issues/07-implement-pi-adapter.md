# 07 — Read Pi sessions without modifying the source

**What to build:** Agent Blog can discover and load candidate Pi Conversation Sources through the official SDK while proving that collection does not migrate, rewrite, or partially read the operator's authoritative session files.

**Blocked by:** 05 — Make Agent Platform selection explicit.

**Status:** ready-for-agent

- [ ] Setup verifies the current Pi package identity, CLI version, SDK version, and required Session Manager capabilities as one tested compatibility matrix.
- [ ] Candidate sessions are discovered through the published SDK, including an explicitly configured session directory.
- [ ] Each candidate is copied to a restrictive private snapshot before the SDK opens it.
- [ ] Collection verifies that the source remained stable across snapshotting and retries or defers a concurrent writer without advancing state.
- [ ] Legacy-session migration is confined to the snapshot, and source bytes, permissions, and modification metadata remain unchanged.
- [ ] Snapshots are removed after use and no raw session body is logged, committed, or exposed as public metadata.
- [ ] Synthetic SDK contract tests cover current entries, legacy migration, concurrent append, custom session locations, package drift, and safe failure without reading real sessions.
