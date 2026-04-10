CREATE TABLE tunnel_events (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  level TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (tunnel_id) REFERENCES tunnel_records(id) ON DELETE CASCADE
);

CREATE INDEX idx_tunnel_events_tunnel_created
  ON tunnel_events (tunnel_id, created_at DESC);

CREATE TABLE tunnel_test_runs (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL,
  status TEXT NOT NULL,
  result_json TEXT NOT NULL,
  tested_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tunnel_id) REFERENCES tunnel_records(id) ON DELETE CASCADE
);

CREATE INDEX idx_tunnel_test_runs_tunnel_tested
  ON tunnel_test_runs (tunnel_id, tested_at DESC);
