CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  machine TEXT NOT NULL,
  days INTEGER NOT NULL,
  exp TEXT NOT NULL,
  lic_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_licenses_created ON licenses(id);
