CREATE TABLE IF NOT EXISTS content_revisions (
  kind TEXT NOT NULL CHECK(kind IN ('review','episode')),
  id TEXT NOT NULL,
  revision TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)),
  body TEXT NOT NULL,
  preview_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(kind,id,revision)
);
CREATE TABLE IF NOT EXISTS content_heads (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  draft_revision TEXT NOT NULL,
  published_revision TEXT,
  published_at TEXT,
  PRIMARY KEY(kind,id)
);
CREATE TABLE IF NOT EXISTS publication_audit (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  revision TEXT NOT NULL,
  actor TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  PRIMARY KEY(kind,id,revision)
);
