ALTER TABLE provider_settings
  ADD COLUMN auth_strategy TEXT NOT NULL DEFAULT 'api-key';

UPDATE provider_settings
SET auth_strategy = CASE
  WHEN provider_code = 'workers-ai' THEN 'workers-binding'
  WHEN oauth_connected = 1 THEN 'oauth'
  ELSE 'api-key'
END
WHERE auth_strategy IS NULL OR auth_strategy = '';
