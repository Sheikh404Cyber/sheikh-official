-- v3: per-tool logo image (path/URL shown on the public card instead of the generic icon).
-- One-shot statement: SQLite has no ADD COLUMN IF NOT EXISTS — apply exactly once.
ALTER TABLE tools ADD COLUMN logo TEXT NOT NULL DEFAULT '';
