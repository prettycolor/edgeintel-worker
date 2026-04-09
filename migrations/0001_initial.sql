CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  requested_domains TEXT NOT NULL,
  normalized_domains TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  completed_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  workflow_instance_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  source_url TEXT,
  final_url TEXT,
  scan_summary_json TEXT,
  raw_result_json TEXT,
  failure_reason TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES scan_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_runs_job_id ON scan_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_domain ON scan_runs(domain);

CREATE TABLE IF NOT EXISTS scan_findings (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES scan_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_findings_scan_run_id ON scan_findings(scan_run_id);

CREATE TABLE IF NOT EXISTS scan_artifacts (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES scan_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_artifacts_scan_run_id ON scan_artifacts(scan_run_id);

CREATE TABLE IF NOT EXISTS scan_recommendations (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  priority TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  expected_impact TEXT NOT NULL,
  prerequisites_json TEXT NOT NULL,
  export_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES scan_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_recommendations_scan_run_id ON scan_recommendations(scan_run_id);

CREATE TABLE IF NOT EXISTS scan_exports (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES scan_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_exports_scan_run_id ON scan_exports(scan_run_id);
