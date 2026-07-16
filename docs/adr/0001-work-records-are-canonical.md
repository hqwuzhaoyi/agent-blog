---
status: superseded by ADR-0006
---

# Treat Work Records as canonical

Each meaningful agent task outcome is recorded as a Work Record, while a Daily Review is a derived view assembled from those records. This preserves retries, multiple tasks per day, and work spanning calendar boundaries, while allowing summaries to be regenerated without changing the underlying history.
