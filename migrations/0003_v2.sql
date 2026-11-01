-- Sheikh-OFFICIAL — migration 0003 (v2 upgrade).
-- Adds: paid-tool fields (price / demo video), per-tool ownership
-- (user_tools), uploaded site photos (media_blobs), testimonials, FAQs
-- and hire-me orders.
--
-- Apply ONCE to a database that already has migrations 0001 + 0002 and
-- seed.sql. The CREATE TABLE / CREATE INDEX statements use IF NOT EXISTS
-- and the FAQ seed uses INSERT OR IGNORE, so those parts are safe to
-- re-run; the two ALTER TABLE statements are the only one-shot parts
-- (SQLite has no ADD COLUMN IF NOT EXISTS). The same final shape is
-- mirrored in schema.sql for fresh installs.

ALTER TABLE tools ADD COLUMN price TEXT NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN demo_youtube TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS user_tools (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tool_id)
);

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

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  contact    TEXT NOT NULL,
  service    TEXT NOT NULL DEFAULT 'Website',
  message    TEXT NOT NULL DEFAULT '',
  seen       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_tools_user ON user_tools(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tools_tool ON user_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_vis ON testimonials(visible, sort);
CREATE INDEX IF NOT EXISTS idx_faqs_vis          ON faqs(visible, sort);
CREATE INDEX IF NOT EXISTS idx_orders_seen       ON orders(seen, id);

-- Starter FAQs (the admin can edit or delete these in the FAQ tab).
INSERT OR IGNORE INTO faqs (id, q, a, sort, visible) VALUES
  (1, 'How do I buy a tool?',
   'Pick the tool you want and tap the WhatsApp Buy button on its card. Pay the price shown via Bkash or Nagad, then send the transaction ID or a payment screenshot on WhatsApp. The admin will activate the download on your account.',
   1, 1),
  (2, 'How long until my download activates?',
   'As soon as your payment is confirmed, the admin activates the tool on your account — usually within a few hours. Then log in and open My Tools to download it any time.',
   2, 1),
  (3, 'What if a tool does not work on my PC?',
   'Message on WhatsApp with a screenshot of the problem — you will get setup help or a fix. Every tool is tested on Windows before it is listed here.',
   3, 1);
