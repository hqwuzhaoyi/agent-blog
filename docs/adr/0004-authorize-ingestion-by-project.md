---
status: superseded by ADR-0013
---

# Authorize ingestion by project

Operators authorize a Tracked Project rather than selecting individual conversations. All existing and newly discovered Conversation Sources associated with that project are then eligible for scheduled ingestion, balancing low-maintenance collection with a boundary that prevents unrelated projects from being scanned.
