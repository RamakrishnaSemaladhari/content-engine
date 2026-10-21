ALTER TABLE articles ADD COLUMN engine_draft_id TEXT;
CREATE UNIQUE INDEX idx_articles_engine_draft_id ON articles(engine_draft_id) WHERE engine_draft_id IS NOT NULL;
