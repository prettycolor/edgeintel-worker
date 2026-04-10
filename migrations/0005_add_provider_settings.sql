CREATE TABLE IF NOT EXISTS provider_settings (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  provider_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  base_url TEXT,
  default_model TEXT,
  uses_ai_gateway INTEGER NOT NULL DEFAULT 0,
  oauth_connected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  secret_envelope_json TEXT,
  last_tested_at TEXT,
  last_test_status TEXT,
  last_test_result_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_settings_provider_code
  ON provider_settings(provider_code);

CREATE INDEX IF NOT EXISTS idx_provider_settings_status
  ON provider_settings(status, updated_at DESC);
