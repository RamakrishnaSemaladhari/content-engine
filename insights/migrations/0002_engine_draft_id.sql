-- NOTE: the staging database (a10a355f...) ALREADY has this column. Apply only to a fresh database.
ALTER TABLE articles ADD COLUMN engine_draft_id TEXT;
