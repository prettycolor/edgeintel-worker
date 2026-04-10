CREATE TABLE IF NOT EXISTS tunnel_records (
  id TEXT PRIMARY KEY,
  provider_setting_id TEXT,
  cloudflare_tunnel_id TEXT,
  cloudflare_tunnel_name TEXT,
  cloudflare_zone_id TEXT,
  public_hostname TEXT NOT NULL,
  local_service_url TEXT NOT NULL,
  access_protected INTEGER NOT NULL DEFAULT 0,
  access_app_id TEXT,
  access_policy_id TEXT,
  access_service_token_id TEXT,
  dns_record_id TEXT,
  secret_envelope_json TEXT,
  connector_status TEXT NOT NULL DEFAULT 'unpaired',
  status TEXT NOT NULL DEFAULT 'draft',
  last_connector_heartbeat_at TEXT,
  last_tunnel_health_at TEXT,
  last_tested_at TEXT,
  last_test_status TEXT,
  last_test_result_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tunnel_records_public_hostname
  ON tunnel_records(public_hostname);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tunnel_records_cloudflare_tunnel_id
  ON tunnel_records(cloudflare_tunnel_id)
  WHERE cloudflare_tunnel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tunnel_records_provider_setting_id
  ON tunnel_records(provider_setting_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tunnel_records_status
  ON tunnel_records(status, connector_status, updated_at DESC);
