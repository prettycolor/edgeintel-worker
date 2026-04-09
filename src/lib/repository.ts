import type { Env } from "../env";
import type {
  ArtifactDescriptor,
  ExportFormat,
  Finding,
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
  Recommendation,
  ScanResultBundle,
  ScanRunStatus,
} from "../types";
import { nowIso, safeJsonParse } from "./utils";

interface PersistedJob {
  id: string;
  requested_domains: string;
  normalized_domains: string;
  status: string;
  progress: number;
  total_runs: number;
  completed_runs: number;
  degraded_runs: number;
  failed_runs: number;
  workflow_instance_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function toRun(row: Record<string, unknown>): PersistedScanRun {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    domain: String(row.domain),
    status: row.status as ScanRunStatus,
    sourceUrl: (row.source_url as string | null) ?? null,
    finalUrl: (row.final_url as string | null) ?? null,
    scanSummaryJson: (row.scan_summary_json as string | null) ?? null,
    rawResultJson: (row.raw_result_json as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export async function createJob(
  env: Env,
  jobId: string,
  requestedDomains: string[],
  normalizedDomains: string[],
): Promise<void> {
  const timestamp = nowIso();
  await env.EDGE_DB.prepare(
    `INSERT INTO scan_jobs (
      id, requested_domains, normalized_domains, status, progress, total_runs,
      completed_runs, degraded_runs, failed_runs, created_at, updated_at
    ) VALUES (?, ?, ?, 'queued', 0, ?, 0, 0, 0, ?, ?)`,
  )
    .bind(
      jobId,
      JSON.stringify(requestedDomains),
      JSON.stringify(normalizedDomains),
      normalizedDomains.length,
      timestamp,
      timestamp,
    )
    .run();
}

export async function createScanRuns(
  env: Env,
  jobId: string,
  domains: string[],
): Promise<Array<{ id: string; domain: string }>> {
  const createdAt = nowIso();
  const runs = domains.map((domain) => ({
    id: crypto.randomUUID(),
    domain,
  }));

  for (const run of runs) {
    await env.EDGE_DB.prepare(
      `INSERT INTO scan_runs (
        id, job_id, domain, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'queued', ?, ?)`,
    )
      .bind(run.id, jobId, run.domain, createdAt, createdAt)
      .run();
  }

  return runs;
}

export async function attachWorkflowInstance(
  env: Env,
  jobId: string,
  workflowInstanceId: string,
): Promise<void> {
  await env.EDGE_DB.prepare(
    `UPDATE scan_jobs
     SET workflow_instance_id = ?, status = 'running', updated_at = ?
     WHERE id = ?`,
  )
    .bind(workflowInstanceId, nowIso(), jobId)
    .run();
}

export async function markRunStarted(
  env: Env,
  scanRunId: string,
): Promise<void> {
  const timestamp = nowIso();
  await env.EDGE_DB.prepare(
    `UPDATE scan_runs
     SET status = 'processing', started_at = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(timestamp, timestamp, scanRunId)
    .run();
}

export async function storeRunBundle(
  env: Env,
  scanRunId: string,
  bundle: ScanResultBundle,
  runStatus: Extract<ScanRunStatus, "completed" | "completed_with_failures">,
  failureReason: string | null,
): Promise<void> {
  const timestamp = nowIso();
  await env.EDGE_DB.prepare(
    `UPDATE scan_runs
     SET status = ?,
         source_url = ?,
         final_url = ?,
         scan_summary_json = ?,
         raw_result_json = ?,
         failure_reason = ?,
         completed_at = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      runStatus,
      bundle.http.attemptedUrl,
      bundle.http.finalUrl,
      JSON.stringify(bundle.summary),
      JSON.stringify(bundle),
      failureReason,
      timestamp,
      timestamp,
      scanRunId,
    )
    .run();

  await env.EDGE_DB.prepare(`DELETE FROM scan_findings WHERE scan_run_id = ?`)
    .bind(scanRunId)
    .run();
  await env.EDGE_DB.prepare(
    `DELETE FROM scan_recommendations WHERE scan_run_id = ?`,
  )
    .bind(scanRunId)
    .run();

  for (const finding of bundle.findings) {
    await insertFinding(env, scanRunId, finding);
  }
  for (const recommendation of bundle.recommendations) {
    await insertRecommendation(env, scanRunId, recommendation);
  }
}

export async function markRunFailed(
  env: Env,
  scanRunId: string,
  reason: string,
): Promise<void> {
  const timestamp = nowIso();
  await env.EDGE_DB.prepare(
    `UPDATE scan_runs
     SET status = 'failed',
         failure_reason = ?,
         completed_at = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(reason, timestamp, timestamp, scanRunId)
    .run();
}

export async function recalculateJobStatus(env: Env, jobId: string): Promise<void> {
  const counts = await env.EDGE_DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'completed_with_failures' THEN 1 ELSE 0 END) AS degraded,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM scan_runs
     WHERE job_id = ?`,
  )
    .bind(jobId)
    .first<Record<string, number | null>>();

  const total = Number(counts?.total ?? 0);
  const completed = Number(counts?.completed ?? 0);
  const degraded = Number(counts?.degraded ?? 0);
  const failed = Number(counts?.failed ?? 0);
  const processed = completed + degraded + failed;
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  let status = "running";
  let completedAt: string | null = null;
  if (processed === total && total > 0) {
    status = degraded + failed > 0 ? "completed_with_failures" : "completed";
    completedAt = nowIso();
  }

  await env.EDGE_DB.prepare(
    `UPDATE scan_jobs
     SET status = ?, progress = ?, completed_runs = ?, degraded_runs = ?, failed_runs = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
  )
    .bind(
      status,
      progress,
      completed,
      degraded,
      failed,
      nowIso(),
      completedAt,
      jobId,
    )
    .run();
}

async function insertFinding(env: Env, scanRunId: string, finding: Finding): Promise<void> {
  await env.EDGE_DB.prepare(
    `INSERT INTO scan_findings (
      id, scan_run_id, category, severity, code, title, detail, evidence_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      finding.id,
      scanRunId,
      finding.category,
      finding.severity,
      finding.code,
      finding.title,
      finding.detail,
      JSON.stringify(finding.evidence),
      nowIso(),
    )
    .run();
}

async function insertRecommendation(
  env: Env,
  scanRunId: string,
  recommendation: Recommendation,
): Promise<void> {
  await env.EDGE_DB.prepare(
    `INSERT INTO scan_recommendations (
      id, scan_run_id, product_code, title, rationale, priority, confidence,
      expected_impact, prerequisites_json, export_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      recommendation.id,
      scanRunId,
      recommendation.productCode,
      recommendation.title,
      recommendation.rationale,
      recommendation.priority,
      recommendation.confidence,
      recommendation.expectedImpact,
      JSON.stringify(recommendation.prerequisites),
      JSON.stringify(recommendation.exportPayload),
      nowIso(),
    )
    .run();
}

export async function insertArtifact(
  env: Env,
  scanRunId: string,
  artifact: ArtifactDescriptor,
): Promise<void> {
  await env.EDGE_DB.prepare(
    `INSERT INTO scan_artifacts (
      id, scan_run_id, kind, object_key, content_type, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      artifact.id,
      scanRunId,
      artifact.kind,
      artifact.objectKey,
      artifact.contentType,
      JSON.stringify(artifact.metadata),
      nowIso(),
    )
    .run();
}

export async function createExportRecord(
  env: Env,
  scanRunId: string,
  format: ExportFormat,
  objectKey: string,
  contentType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const exportId = crypto.randomUUID();
  await env.EDGE_DB.prepare(
    `INSERT INTO scan_exports (
      id, scan_run_id, format, status, object_key, content_type, payload_json, created_at
    ) VALUES (?, ?, ?, 'ready', ?, ?, ?, ?)`,
  )
    .bind(
      exportId,
      scanRunId,
      format,
      objectKey,
      contentType,
      JSON.stringify(payload),
      nowIso(),
    )
    .run();
  return exportId;
}

export async function getJob(env: Env, jobId: string): Promise<PersistedJob | null> {
  const row = await env.EDGE_DB.prepare(`SELECT * FROM scan_jobs WHERE id = ?`)
    .bind(jobId)
    .first<PersistedJob>();
  return row ?? null;
}

export async function getRunsForJob(env: Env, jobId: string): Promise<PersistedScanRun[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_runs WHERE job_id = ? ORDER BY created_at ASC`,
  )
    .bind(jobId)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(toRun);
}

export async function getScanRun(env: Env, scanRunId: string): Promise<PersistedScanRun | null> {
  const row = await env.EDGE_DB.prepare(`SELECT * FROM scan_runs WHERE id = ?`)
    .bind(scanRunId)
    .first<Record<string, unknown>>();
  return row ? toRun(row) : null;
}

export async function getFindingsForRun(
  env: Env,
  scanRunId: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_findings WHERE scan_run_id = ? ORDER BY created_at ASC`,
  )
    .bind(scanRunId)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    ...row,
    evidence: safeJsonParse((row.evidence_json as string | null) ?? "{}", {}),
  }));
}

export async function getArtifactsForRun(
  env: Env,
  scanRunId: string,
): Promise<PersistedArtifact[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_artifacts WHERE scan_run_id = ? ORDER BY created_at ASC`,
  )
    .bind(scanRunId)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    scanRunId: String(row.scan_run_id),
    kind: String(row.kind),
    objectKey: String(row.object_key),
    contentType: String(row.content_type),
    metadataJson: String(row.metadata_json),
    createdAt: String(row.created_at),
  }));
}

export async function getRecommendationsForRun(
  env: Env,
  scanRunId: string,
): Promise<PersistedRecommendation[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_recommendations WHERE scan_run_id = ? ORDER BY confidence DESC`,
  )
    .bind(scanRunId)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    scanRunId: String(row.scan_run_id),
    productCode: String(row.product_code),
    title: String(row.title),
    rationale: String(row.rationale),
    priority: row.priority as PersistedRecommendation["priority"],
    confidence: Number(row.confidence),
    expectedImpact: String(row.expected_impact),
    prerequisitesJson: String(row.prerequisites_json),
    exportJson: String(row.export_json),
    createdAt: String(row.created_at),
  }));
}

export async function getScanContext(
  env: Env,
  scanRunId: string,
): Promise<{
  run: PersistedScanRun;
  findings: Array<Record<string, unknown>>;
  artifacts: PersistedArtifact[];
  recommendations: PersistedRecommendation[];
} | null> {
  const run = await getScanRun(env, scanRunId);
  if (!run) return null;
  const [findings, artifacts, recommendations] = await Promise.all([
    getFindingsForRun(env, scanRunId),
    getArtifactsForRun(env, scanRunId),
    getRecommendationsForRun(env, scanRunId),
  ]);
  return { run, findings, artifacts, recommendations };
}

export async function getExportRecord(
  env: Env,
  exportId: string,
): Promise<Record<string, unknown> | null> {
  return (
    (await env.EDGE_DB.prepare(`SELECT * FROM scan_exports WHERE id = ?`)
      .bind(exportId)
      .first<Record<string, unknown>>()) ?? null
  );
}

export async function listDomainHistory(
  env: Env,
  domain: string,
): Promise<PersistedScanRun[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_runs WHERE domain = ? ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(domain)
    .all<Record<string, unknown>>();
  return (result.results ?? []).map(toRun);
}
