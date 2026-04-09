CREATE TABLE IF NOT EXISTS domain_watches (
  domain TEXT PRIMARY KEY,
  interval_hours INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_enqueued_at TEXT,
  next_run_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_watches_next_run_at
  ON domain_watches(active, next_run_at);
