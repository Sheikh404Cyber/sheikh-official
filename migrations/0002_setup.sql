-- Sheikh-OFFICIAL — migration 0002: key/value settings table.
-- Holds one-time secrets-by-hash only (e.g. setup_token_hash for the
-- one-time admin setup link). The CREATE TABLE below is verbatim the
-- `settings` table in schema.sql — keep the two identical.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
