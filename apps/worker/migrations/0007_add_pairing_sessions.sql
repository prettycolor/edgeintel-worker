CREATE TABLE tunnel_pairing_sessions (
  id TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL,
  issued_by_subject TEXT NOT NULL,
  issued_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pairing_token_hash TEXT NOT NULL,
  connector_token_hash TEXT,
  connector_name TEXT,
  connector_version TEXT,
  exchange_count INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  exchanged_at TEXT,
  connector_expires_at TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  expired_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tunnel_id) REFERENCES tunnel_records(id) ON DELETE CASCADE
);

CREATE INDEX idx_tunnel_pairing_sessions_tunnel
  ON tunnel_pairing_sessions (tunnel_id, created_at DESC);

CREATE INDEX idx_tunnel_pairing_sessions_status
  ON tunnel_pairing_sessions (status, expires_at, connector_expires_at);
