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
