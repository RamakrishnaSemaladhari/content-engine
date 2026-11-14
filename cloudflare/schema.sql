PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DISCOVERING','SOURCES_COLLECTED','SCORING','VERIFICATION_PENDING','DRAFT_PENDING','LOCAL_AI_PENDING','DRAFT_READY','NEEDS_REVIEW','APPROVED','PUBLISHED','FAILED')),
  stage TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  quota_state TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_error_code TEXT,
  last_error_safe TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_run_date ON jobs(run_date);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  snippet TEXT,
  reliability_score INTEGER NOT NULL DEFAULT 0,
  relevance_score INTEGER NOT NULL DEFAULT 0,
  informativeness_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, canonical_url)
);
CREATE INDEX IF NOT EXISTS idx_sources_job_score ON sources(job_id, total_score DESC);

CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, stage)
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta_description TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  source_list_json TEXT NOT NULL,
  verification_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'UNPUBLISHED' CHECK (status IN ('UNPUBLISHED','APPROVED','PUBLISHED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail_safe TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Additive and idempotent. Safe on the existing database (does not touch existing tables).
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_url TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  title_key TEXT NOT NULL,
  publisher TEXT NOT NULL,
  publisher_url TEXT,
  published_at TEXT,
  snippet TEXT,
  topic TEXT NOT NULL DEFAULT 'Property',
  reliability_score INTEGER NOT NULL DEFAULT 0,
  relevance_score INTEGER NOT NULL DEFAULT 0,
  informativeness_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'SHORTLISTED' CHECK (status IN ('SHORTLISTED','SELECTED','DRAFTING','DRAFTED','REJECTED','FAILED')),
  shortlisted_on TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  job_id TEXT,
  last_error_code TEXT,
  last_error_safe TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status, total_score DESC);
