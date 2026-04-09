ALTER TABLE scan_recommendations ADD COLUMN phase INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scan_recommendations ADD COLUMN sequence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scan_recommendations ADD COLUMN blocked_by_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE scan_recommendations ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE scan_recommendations ADD COLUMN technical_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_recommendations ADD COLUMN executive_summary TEXT NOT NULL DEFAULT '';
