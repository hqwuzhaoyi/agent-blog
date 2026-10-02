# Publish content through D1 with explicit review approval

The Agent Operator replaced Daily Review PRs with complete draft previews and explicit human confirmation, while Morning Coffee Episodes retain automatic publication. Workers now renders content and RSS from D1, with final audio in private R2, so publishing content never rebuilds or deploys application code. Immutable content revisions, a separate published pointer, and reviewer-only approval bind confirmation to the version actually reviewed; edits preserve the current public version until approved again.

This supersedes ADR-0009's Git publication workflow and ADR-0020's per-episode rebuild and R2 content catalog. ADR-0007's human approval requirement remains active. Git retains code, skills, and historical content fixtures; D1 is authoritative for live content.
