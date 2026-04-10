import type { Env } from "../env";
import type {
  ArtifactDescriptor,
  ExportFormat,
  Finding,
  PersistedDomainWatch,
  PersistedArtifact,
  PersistedProviderSetting,
  PersistedRecommendation,
  PersistedScanRun,
  PersistedTunnelRecord,
  ProviderConnectionTestResult,
  Recommendation,
  ScanResultBundle,
  ScanRunStatus,
  TunnelConnectionTestResult,
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

function toProviderSetting(
  row: Record<string, unknown>,
): PersistedProviderSetting {
  return {
    id: String(row.id),
    kind: String(row.kind) as PersistedProviderSetting["kind"],
    providerCode: String(row.provider_code),
    displayName: String(row.display_name),
    baseUrl: (row.base_url as string | null) ?? null,
    defaultModel: (row.default_model as string | null) ?? null,
    usesAiGateway: Number(row.uses_ai_gateway ?? 0) === 1,
    oauthConnected: Number(row.oauth_connected ?? 0) === 1,
    status: String(row.status) as PersistedProviderSetting["status"],
    secretConfigured: Boolean(row.secret_envelope_json),
    secretEnvelopeJson: (row.secret_envelope_json as string | null) ?? null,
    lastTestedAt: (row.last_tested_at as string | null) ?? null,
    lastTestStatus:
      (row.last_test_status as PersistedProviderSetting["lastTestStatus"] | null) ??
      null,
    lastTestResultJson: (row.last_test_result_json as string | null) ?? null,
    metadataJson: String(row.metadata_json ?? "{}"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toTunnelRecord(row: Record<string, unknown>): PersistedTunnelRecord {
  return {
    id: String(row.id),
    providerSettingId: (row.provider_setting_id as string | null) ?? null,
    cloudflareTunnelId: (row.cloudflare_tunnel_id as string | null) ?? null,
    cloudflareTunnelName: (row.cloudflare_tunnel_name as string | null) ?? null,
    cloudflareZoneId: (row.cloudflare_zone_id as string | null) ?? null,
    publicHostname: String(row.public_hostname),
    localServiceUrl: String(row.local_service_url),
    accessProtected: Number(row.access_protected ?? 0) === 1,
    accessAppId: (row.access_app_id as string | null) ?? null,
    accessPolicyId: (row.access_policy_id as string | null) ?? null,
    accessServiceTokenId:
      (row.access_service_token_id as string | null) ?? null,
    dnsRecordId: (row.dns_record_id as string | null) ?? null,
    secretConfigured: Boolean(row.secret_envelope_json),
    secretEnvelopeJson: (row.secret_envelope_json as string | null) ?? null,
    connectorStatus:
      row.connector_status as PersistedTunnelRecord["connectorStatus"],
    status: row.status as PersistedTunnelRecord["status"],
    lastConnectorHeartbeatAt:
      (row.last_connector_heartbeat_at as string | null) ?? null,
    lastTunnelHealthAt: (row.last_tunnel_health_at as string | null) ?? null,
    lastTestedAt: (row.last_tested_at as string | null) ?? null,
    lastTestStatus:
      (row.last_test_status as PersistedTunnelRecord["lastTestStatus"] | null) ??
      null,
    lastTestResultJson: (row.last_test_result_json as string | null) ?? null,
    metadataJson: String(row.metadata_json ?? "{}"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
      phase, sequence, blocked_by_json, evidence_json, expected_impact,
      technical_summary, executive_summary, prerequisites_json, export_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      recommendation.id,
      scanRunId,
      recommendation.productCode,
      recommendation.title,
      recommendation.rationale,
      recommendation.priority,
      recommendation.confidence,
      recommendation.phase,
      recommendation.sequence,
      JSON.stringify(recommendation.blockedBy),
      JSON.stringify(recommendation.evidenceRefs),
      recommendation.expectedImpact,
      recommendation.technicalSummary,
      recommendation.executiveSummary,
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

export async function getLatestRunForDomain(
  env: Env,
  domain: string,
): Promise<PersistedScanRun | null> {
  const row = await env.EDGE_DB.prepare(
    `SELECT * FROM scan_runs WHERE domain = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(domain)
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
    `SELECT * FROM scan_recommendations
     WHERE scan_run_id = ?
     ORDER BY phase ASC, sequence ASC, confidence DESC`,
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
    phase: Number(row.phase) as PersistedRecommendation["phase"],
    sequence: Number(row.sequence),
    blockedByJson: String(row.blocked_by_json ?? "[]"),
    evidenceJson: String(row.evidence_json ?? "[]"),
    expectedImpact: String(row.expected_impact),
    technicalSummary: String(row.technical_summary ?? ""),
    executiveSummary: String(row.executive_summary ?? ""),
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

export async function createProviderSetting(
  env: Env,
  input: {
    kind: PersistedProviderSetting["kind"];
    providerCode: string;
    displayName: string;
    baseUrl: string | null;
    defaultModel: string | null;
    usesAiGateway: boolean;
    oauthConnected: boolean;
    status: PersistedProviderSetting["status"];
    secretEnvelopeJson: string | null;
    metadataJson: string;
  },
): Promise<string> {
  const providerId = crypto.randomUUID();
  const timestamp = nowIso();

  await env.EDGE_DB.prepare(
    `INSERT INTO provider_settings (
      id, kind, provider_code, display_name, base_url, default_model,
      uses_ai_gateway, oauth_connected, status, secret_envelope_json,
      metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      providerId,
      input.kind,
      input.providerCode,
      input.displayName,
      input.baseUrl,
      input.defaultModel,
      input.usesAiGateway ? 1 : 0,
      input.oauthConnected ? 1 : 0,
      input.status,
      input.secretEnvelopeJson,
      input.metadataJson,
      timestamp,
      timestamp,
    )
    .run();

  return providerId;
}

export async function updateProviderSetting(
  env: Env,
  providerId: string,
  input: {
    kind: PersistedProviderSetting["kind"];
    providerCode: string;
    displayName: string;
    baseUrl: string | null;
    defaultModel: string | null;
    usesAiGateway: boolean;
    oauthConnected: boolean;
    status: PersistedProviderSetting["status"];
    secretEnvelopeJson: string | null;
    metadataJson: string;
  },
): Promise<void> {
  await env.EDGE_DB.prepare(
    `UPDATE provider_settings
     SET kind = ?,
         provider_code = ?,
         display_name = ?,
         base_url = ?,
         default_model = ?,
         uses_ai_gateway = ?,
         oauth_connected = ?,
         status = ?,
         secret_envelope_json = ?,
         metadata_json = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.kind,
      input.providerCode,
      input.displayName,
      input.baseUrl,
      input.defaultModel,
      input.usesAiGateway ? 1 : 0,
      input.oauthConnected ? 1 : 0,
      input.status,
      input.secretEnvelopeJson,
      input.metadataJson,
      nowIso(),
      providerId,
    )
    .run();
}

export async function storeProviderTestResult(
  env: Env,
  providerId: string,
  result: ProviderConnectionTestResult,
): Promise<void> {
  await env.EDGE_DB.prepare(
    `UPDATE provider_settings
     SET last_tested_at = ?,
         last_test_status = ?,
         last_test_result_json = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      result.testedAt,
      result.status,
      JSON.stringify(result),
      nowIso(),
      providerId,
    )
    .run();
}

export async function createTunnelRecord(
  env: Env,
  input: {
    providerSettingId: string | null;
    cloudflareTunnelId: string | null;
    cloudflareTunnelName: string | null;
    cloudflareZoneId: string | null;
    publicHostname: string;
    localServiceUrl: string;
    accessProtected: boolean;
    accessAppId: string | null;
    accessPolicyId: string | null;
    accessServiceTokenId: string | null;
    dnsRecordId: string | null;
    secretEnvelopeJson: string | null;
    connectorStatus: PersistedTunnelRecord["connectorStatus"];
    status: PersistedTunnelRecord["status"];
    metadataJson: string;
  },
): Promise<string> {
  const tunnelId = crypto.randomUUID();
  const timestamp = nowIso();

  await env.EDGE_DB.prepare(
    `INSERT INTO tunnel_records (
      id, provider_setting_id, cloudflare_tunnel_id, cloudflare_tunnel_name,
      cloudflare_zone_id, public_hostname, local_service_url, access_protected,
      access_app_id, access_policy_id, access_service_token_id, dns_record_id,
      secret_envelope_json, connector_status, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      tunnelId,
      input.providerSettingId,
      input.cloudflareTunnelId,
      input.cloudflareTunnelName,
      input.cloudflareZoneId,
      input.publicHostname,
      input.localServiceUrl,
      input.accessProtected ? 1 : 0,
      input.accessAppId,
      input.accessPolicyId,
      input.accessServiceTokenId,
      input.dnsRecordId,
      input.secretEnvelopeJson,
      input.connectorStatus,
      input.status,
      input.metadataJson,
      timestamp,
      timestamp,
    )
    .run();

  return tunnelId;
}

export async function updateTunnelRecord(
  env: Env,
  tunnelId: string,
  input: {
    providerSettingId: string | null;
    cloudflareTunnelId: string | null;
    cloudflareTunnelName: string | null;
    cloudflareZoneId: string | null;
    publicHostname: string;
    localServiceUrl: string;
    accessProtected: boolean;
    accessAppId: string | null;
    accessPolicyId: string | null;
    accessServiceTokenId: string | null;
    dnsRecordId: string | null;
    secretEnvelopeJson: string | null;
    connectorStatus: PersistedTunnelRecord["connectorStatus"];
    status: PersistedTunnelRecord["status"];
    lastConnectorHeartbeatAt?: string | null;
    lastTunnelHealthAt?: string | null;
    metadataJson: string;
  },
): Promise<void> {
  await env.EDGE_DB.prepare(
    `UPDATE tunnel_records
     SET provider_setting_id = ?,
         cloudflare_tunnel_id = ?,
         cloudflare_tunnel_name = ?,
         cloudflare_zone_id = ?,
         public_hostname = ?,
         local_service_url = ?,
         access_protected = ?,
         access_app_id = ?,
         access_policy_id = ?,
         access_service_token_id = ?,
         dns_record_id = ?,
         secret_envelope_json = ?,
         connector_status = ?,
         status = ?,
         last_connector_heartbeat_at = COALESCE(?, last_connector_heartbeat_at),
         last_tunnel_health_at = COALESCE(?, last_tunnel_health_at),
         metadata_json = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.providerSettingId,
      input.cloudflareTunnelId,
      input.cloudflareTunnelName,
      input.cloudflareZoneId,
      input.publicHostname,
      input.localServiceUrl,
      input.accessProtected ? 1 : 0,
      input.accessAppId,
      input.accessPolicyId,
      input.accessServiceTokenId,
      input.dnsRecordId,
      input.secretEnvelopeJson,
      input.connectorStatus,
      input.status,
      input.lastConnectorHeartbeatAt ?? null,
      input.lastTunnelHealthAt ?? null,
      input.metadataJson,
      nowIso(),
      tunnelId,
    )
    .run();
}

export async function storeTunnelTestResult(
  env: Env,
  tunnelId: string,
  result: TunnelConnectionTestResult,
): Promise<void> {
  const runtimeDetails =
    result.details.runtime &&
    typeof result.details.runtime === "object" &&
    !Array.isArray(result.details.runtime)
      ? (result.details.runtime as Record<string, unknown>)
      : null;
  const runtimeStatus =
    typeof runtimeDetails?.status === "number" ? runtimeDetails.status : null;

  await env.EDGE_DB.prepare(
    `UPDATE tunnel_records
     SET last_tested_at = ?,
         last_test_status = ?,
         last_test_result_json = ?,
         last_tunnel_health_at = CASE WHEN ? IS NOT NULL THEN ? ELSE last_tunnel_health_at END,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      result.testedAt,
      result.status,
      JSON.stringify(result),
      runtimeStatus,
      result.testedAt,
      nowIso(),
      tunnelId,
    )
    .run();
}

export async function markTunnelHeartbeat(
  env: Env,
  tunnelId: string,
  input: {
    connectorStatus: PersistedTunnelRecord["connectorStatus"];
    metadataJson?: string;
  },
): Promise<void> {
  const timestamp = nowIso();
  await env.EDGE_DB.prepare(
    `UPDATE tunnel_records
     SET connector_status = ?,
         last_connector_heartbeat_at = ?,
         updated_at = ?,
         metadata_json = COALESCE(?, metadata_json)
     WHERE id = ?`,
  )
    .bind(
      input.connectorStatus,
      timestamp,
      timestamp,
      input.metadataJson ?? null,
      tunnelId,
    )
    .run();
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

export async function listProviderSettings(
  env: Env,
): Promise<PersistedProviderSetting[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT *
     FROM provider_settings
     ORDER BY updated_at DESC, created_at DESC`,
  ).all<Record<string, unknown>>();

  return (result.results ?? []).map(toProviderSetting);
}

export async function listTunnelRecords(
  env: Env,
): Promise<PersistedTunnelRecord[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT *
     FROM tunnel_records
     ORDER BY updated_at DESC, created_at DESC`,
  ).all<Record<string, unknown>>();

  return (result.results ?? []).map(toTunnelRecord);
}

export async function getProviderSetting(
  env: Env,
  providerId: string,
): Promise<PersistedProviderSetting | null> {
  const row = await env.EDGE_DB.prepare(
    `SELECT * FROM provider_settings WHERE id = ?`,
  )
    .bind(providerId)
    .first<Record<string, unknown>>();

  return row ? toProviderSetting(row) : null;
}

export async function getTunnelRecord(
  env: Env,
  tunnelId: string,
): Promise<PersistedTunnelRecord | null> {
  const row = await env.EDGE_DB.prepare(
    `SELECT * FROM tunnel_records WHERE id = ?`,
  )
    .bind(tunnelId)
    .first<Record<string, unknown>>();

  return row ? toTunnelRecord(row) : null;
}

export async function deleteProviderSetting(
  env: Env,
  providerId: string,
): Promise<void> {
  await env.EDGE_DB.prepare(`DELETE FROM provider_settings WHERE id = ?`)
    .bind(providerId)
    .run();
}

export async function deleteTunnelRecord(
  env: Env,
  tunnelId: string,
): Promise<void> {
  await env.EDGE_DB.prepare(`DELETE FROM tunnel_records WHERE id = ?`)
    .bind(tunnelId)
    .run();
}

export async function upsertDomainWatch(
  env: Env,
  domain: string,
  intervalHours: number,
): Promise<void> {
  const timestamp = nowIso();
  const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000)
    .toISOString();

  await env.EDGE_DB.prepare(
    `INSERT INTO domain_watches (
      domain, interval_hours, active, next_run_at, created_at, updated_at
    ) VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(domain) DO UPDATE SET
      interval_hours = excluded.interval_hours,
      active = 1,
      next_run_at = excluded.next_run_at,
      updated_at = excluded.updated_at`,
  )
    .bind(domain, intervalHours, nextRunAt, timestamp, timestamp)
    .run();
}

export async function deleteDomainWatch(env: Env, domain: string): Promise<void> {
  await env.EDGE_DB.prepare(`DELETE FROM domain_watches WHERE domain = ?`)
    .bind(domain)
    .run();
}

export async function getDomainWatch(
  env: Env,
  domain: string,
): Promise<PersistedDomainWatch | null> {
  const row = await env.EDGE_DB.prepare(
    `SELECT * FROM domain_watches WHERE domain = ?`,
  )
    .bind(domain)
    .first<Record<string, unknown>>();

  if (!row) return null;

  return {
    domain: String(row.domain),
    intervalHours: Number(row.interval_hours),
    active: Number(row.active) === 1,
    lastEnqueuedAt: (row.last_enqueued_at as string | null) ?? null,
    nextRunAt: String(row.next_run_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listDueDomainWatches(
  env: Env,
  dueBefore: string,
  limit = 20,
): Promise<PersistedDomainWatch[]> {
  const result = await env.EDGE_DB.prepare(
    `SELECT *
     FROM domain_watches
     WHERE active = 1 AND next_run_at <= ?
     ORDER BY next_run_at ASC
     LIMIT ?`,
  )
    .bind(dueBefore, limit)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    domain: String(row.domain),
    intervalHours: Number(row.interval_hours),
    active: Number(row.active) === 1,
    lastEnqueuedAt: (row.last_enqueued_at as string | null) ?? null,
    nextRunAt: String(row.next_run_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function markDomainWatchEnqueued(
  env: Env,
  domain: string,
  intervalHours: number,
): Promise<void> {
  const timestamp = nowIso();
  const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000)
    .toISOString();

  await env.EDGE_DB.prepare(
    `UPDATE domain_watches
     SET last_enqueued_at = ?, next_run_at = ?, updated_at = ?
     WHERE domain = ?`,
  )
    .bind(timestamp, nextRunAt, timestamp, domain)
    .run();
}
