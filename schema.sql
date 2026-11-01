-- Sheikh-OFFICIAL — D1 database schema
-- Run once when setting up (see README.md). The base tables mirror
-- migrations/0001_init.sql verbatim, `settings` comes from 0002, and the
-- v2 objects (tools.price / tools.demo_youtube, user_tools, media_blobs,
-- testimonials, faqs, orders) mirror migrations/0003_v2.sql.
-- Safe to re-run: tables use IF NOT EXISTS.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  pass_hash    TEXT NOT NULL,
  salt         TEXT NOT NULL,
  is_admin     INTEGER NOT NULL DEFAULT 0,
  can_download INTEGER NOT NULL DEFAULT 0,
  blocked      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tools (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  tagline      TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  version      TEXT NOT NULL DEFAULT '',
  size_label   TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('file','link')),
  file_path    TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  price        TEXT NOT NULL DEFAULT '',
  demo_youtube TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS demos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL,
  image_url   TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS downloads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- v2 (migration 0003): per-tool ownership grants.
CREATE TABLE IF NOT EXISTS user_tools (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tool_id)
);

-- v2 (migration 0003): admin-uploaded site photos, served by /api/media/:key.
CREATE TABLE IF NOT EXISTS media_blobs (
  key        TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  data       BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS testimonials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  text       TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  q          TEXT NOT NULL,
  a          TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- v2 (migration 0003): hire-me / service requests from the public form.
CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  contact    TEXT NOT NULL,
  service    TEXT NOT NULL DEFAULT 'Website',
  message    TEXT NOT NULL DEFAULT '',
  seen       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tools_pub_order   ON tools(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_pub_order  ON videos(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_demos_pub_order   ON demos(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_downloads_user    ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_tool    ON downloads(tool_id);
CREATE INDEX IF NOT EXISTS idx_attempts_ip_time  ON login_attempts(ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_user_tools_user   ON user_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tools_tool   ON user_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_vis  ON testimonials(visible, sort);
CREATE INDEX IF NOT EXISTS idx_faqs_vis          ON faqs(visible, sort);
CREATE INDEX IF NOT EXISTS idx_orders_seen       ON orders(seen, id);
