import type { Env } from "../env";
import type {
  ExportFormat,
  HostnameValidationRequestBody,
  PersistedRecommendation,
  PersistedScanRun,
  ScanRequestBody,
  TunnelConnectionTestResult,
} from "../types";
import {
  attachWorkflowInstance,
  createExportRecord,
  createJob,
  createScanRuns,
  getDomainWatch,
  getJob,
  getLastKnownGoodTunnelTestRun,
  getLatestRunForDomain,
  getRunsForJob,
  getScanContext,
  getTunnelRecord,
  listDomainHistory,
  listTunnelEvents,
  listTunnelTestRuns,
} from "../lib/repository";
import { normalizeDomain, normalizeRequestedDomains } from "../lib/domain";
import { buildHistoryEntries } from "../lib/history";
import {
  exportContentType,
  renderApiPayloadExport,
  renderJsonExport,
  renderMarkdownExport,
  renderTerraformExport,
} from "../lib/exports";
import { buildCommercialBrief } from "../lib/commercial-brief";
import { getInferenceCapabilities } from "../lib/inference";
import { listProviderCapabilityCatalog } from "../lib/provider-settings";
import {
  getCloudflareControlPlaneReadiness,
  listCloudflareZones,
  validateTunnelHostname,
} from "../lib/tunnels";
import { safeJsonParse } from "../lib/utils";
import type { ScanWorkflowParams } from "../types";

function serializeScanContext(
  scanContext: NonNullable<Awaited<ReturnType<typeof getScanContext>>>,
) {
  return {
    run: scanContext.run,
    resultBundle: safeJsonParse(scanContext.run.rawResultJson, null),
    findings: scanContext.findings,
    artifacts: scanContext.artifacts.map((artifact) => ({
      ...artifact,
      metadata: JSON.parse(artifact.metadataJson),
    })),
    recommendations: scanContext.recommendations.map((recommendation) => ({
      ...recommendation,
      blockedBy: JSON.parse(recommendation.blockedByJson),
      evidenceRefs: JSON.parse(recommendation.evidenceJson),
      technicalSummary: recommendation.technicalSummary,
      executiveSummary: recommendation.executiveSummary,
      prerequisites: JSON.parse(recommendation.prerequisitesJson),
      exportPayload: JSON.parse(recommendation.exportJson),
    })),
  };
}

function serializeTunnelEventRecord(event: {
  id: string;
  tunnelId: string;
  kind: string;
  level: "info" | "warning" | "error";
  summary: string;
  detailJson: string;
  createdAt: string;
}) {
  return {
    id: event.id,
    tunnelId: event.tunnelId,
    kind: event.kind,
    level: event.level,
    summary: event.summary,
    detail: safeJsonParse<Record<string, unknown>>(event.detailJson, {}),
    createdAt: event.createdAt,
  };
}

function serializeTunnelTestRunRecord(testRun: {
  id: string;
  tunnelId: string;
  status: "passed" | "failed" | "warning";
  resultJson: string;
  testedAt: string;
  createdAt: string;
}) {
  return {
    id: testRun.id,
    tunnelId: testRun.tunnelId,
    status: testRun.status,
    result: safeJsonParse<TunnelConnectionTestResult | null>(testRun.resultJson, null),
    testedAt: testRun.testedAt,
    createdAt: testRun.createdAt,
  };
}

function extractRuntimeStatus(result: TunnelConnectionTestResult | null): number | null {
  const runtime =
    result?.details?.runtime &&
    typeof result.details.runtime === "object" &&
    !Array.isArray(result.details.runtime)
      ? (result.details.runtime as Record<string, unknown>)
      : null;
  return typeof runtime?.status === "number" ? runtime.status : null;
}

function buildTunnelFailureDelta(
  latest: TunnelConnectionTestResult | null,
  lastKnownGood: TunnelConnectionTestResult | null,
) {
  if (!latest || latest.status === "passed" || !lastKnownGood) {
    return null;
  }

  const latestRuntimeStatus = extractRuntimeStatus(latest);
  const lastKnownGoodRuntimeStatus = extractRuntimeStatus(lastKnownGood);
  const latencyDeltaMs = latest.latencyMs - lastKnownGood.latencyMs;

  return {
    summary:
      latestRuntimeStatus !== null && lastKnownGoodRuntimeStatus !== null
        ? `Runtime status changed from ${lastKnownGoodRuntimeStatus} to ${latestRuntimeStatus}.`
        : `Latest tunnel check regressed from the last known good run by ${latencyDeltaMs}ms.`,
    latencyDeltaMs,
    previousRuntimeStatus: lastKnownGoodRuntimeStatus,
    currentRuntimeStatus: latestRuntimeStatus,
  };
}

function buildVersionDrift(events: Array<ReturnType<typeof serializeTunnelEventRecord>>) {
  const versions = events
    .map((event) => event.detail.version)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const current = versions[0] ?? null;
  const previous = versions.find((value) => value !== current) ?? null;

  return {
    changed: Boolean(current && previous && current !== previous),
    current,
    previous,
  };
}

function renderExportContent(
  format: ExportFormat,
  context: Awaited<ReturnType<typeof getScanContext>>,
): string {
  if (!context) {
    throw new Error("Cannot render export without scan context.");
  }

  switch (format) {
    case "markdown":
      return renderMarkdownExport(context);
    case "json":
      return renderJsonExport(context);
    case "terraform":
      return renderTerraformExport(context);
    case "cf-api":
      return renderApiPayloadExport(context);
  }
}

function coordinatorFor(env: Env, jobId: string) {
  return env.JOB_COORDINATOR.getByName(jobId);
}

export async function createBoundedScanJob(
  env: Env,
  body: ScanRequestBody,
): Promise<{
  jobId: string;
  workflowInstanceId: string;
  domains: string[];
  scanRuns: Array<{ id: string; domain: string }>;
  statusUrl: string;
  eventsUrl: string;
}> {
  const maxBatchSize = Number(env.SCAN_BATCH_LIMIT || "10");
  const normalizedDomains = normalizeRequestedDomains(
    body.domain,
    body.domains,
    maxBatchSize,
  );
  const requestedDomains = [
    ...(body.domain ? [body.domain] : []),
    ...(body.domains ?? []),
  ];

  const jobId = crypto.randomUUID();
  await createJob(env, jobId, requestedDomains, normalizedDomains);
  const runs = await createScanRuns(env, jobId, normalizedDomains);

  const coordinator = coordinatorFor(env, jobId);
  await coordinator.initialize(
    jobId,
    runs.map((run) => ({
      scanRunId: run.id,
      domain: run.domain,
    })),
  );

  const workflowPayload: ScanWorkflowParams = {
    jobId,
    targets: runs.map((run) => ({
      domain: run.domain,
      scanRunId: run.id,
    })),
  };

  const workflowInstance = await env.SCAN_WORKFLOW.create({
    id: jobId,
    params: workflowPayload,
  });
  await attachWorkflowInstance(env, jobId, workflowInstance.id);

  return {
    jobId,
    workflowInstanceId: workflowInstance.id,
    domains: normalizedDomains,
    scanRuns: runs,
    statusUrl: `/api/jobs/${jobId}`,
    eventsUrl: `/api/jobs/${jobId}/events`,
  };
}

export async function getScanJobStatus(env: Env, jobId: string) {
  const job = await getJob(env, jobId);
  if (!job) {
    throw new Error("Job not found.");
  }

  const [runs, snapshot] = await Promise.all([
    getRunsForJob(env, jobId),
    coordinatorFor(env, jobId).getSnapshot(),
  ]);

  return {
    job,
    snapshot,
    runs,
    batchSummary: {
      queued: snapshot.domains.filter((domain) => domain.status === "queued").length,
      processing: snapshot.domains.filter((domain) => domain.status === "processing")
        .length,
      completed: snapshot.domains.filter((domain) => domain.status === "completed")
        .length,
      degraded: snapshot.domains.filter(
        (domain) => domain.status === "completed_with_failures",
      ).length,
      failed: snapshot.domains.filter((domain) => domain.status === "failed").length,
    },
  };
}

export async function getLatestDomainPosture(env: Env, domainParam: string) {
  const domain = normalizeDomain(domainParam);
  const latestRun = await getLatestRunForDomain(env, domain);
  if (!latestRun) {
    throw new Error("No scans found for domain.");
  }

  const scanContext = await getScanContext(env, latestRun.id);
  if (!scanContext) {
    throw new Error("Latest scan context not found.");
  }

  return {
    domain,
    latest: serializeScanContext(scanContext),
  };
}

export async function getDomainHistoryView(env: Env, domainParam: string) {
  const domain = normalizeDomain(domainParam);
  const history = await listDomainHistory(env, domain);
  const historyEntries = buildHistoryEntries(history as PersistedScanRun[]);
  const latest = history[0] ?? null;
  const watch = await getDomainWatch(env, domain);

  return {
    domain,
    latest: historyEntries[0] ?? latest,
    watch,
    history: historyEntries,
  };
}

export async function getCommercialBriefView(env: Env, scanRunId: string) {
  const scanContext = await getScanContext(env, scanRunId);
  if (!scanContext) {
    throw new Error("Scan run not found.");
  }

  return {
    brief: buildCommercialBrief(scanContext),
  };
}

export async function createExportArtifact(
  env: Env,
  scanRunId: string,
  format: ExportFormat,
) {
  const scanContext = await getScanContext(env, scanRunId);
  if (!scanContext) {
    throw new Error("Scan run not found.");
  }

  const content = renderExportContent(format, scanContext);
  const contentType = exportContentType(format);
  const objectKey = `exports/${scanContext.run.domain}/${scanRunId}/${format}-${Date.now()}.${
    format === "markdown" ? "md" : format === "terraform" ? "tf" : "json"
  }`;

  await env.EDGE_ARTIFACTS.put(objectKey, content, {
    httpMetadata: {
      contentType,
    },
  });

  const exportId = await createExportRecord(
    env,
    scanRunId,
    format,
    objectKey,
    contentType,
    {
      schemaVersion: "edgeintel.export.v1.6",
      generatedAt: new Date().toISOString(),
      scanRunId,
      domain: scanContext.run.domain,
      generatedFromFindings: true,
      artifactCount: scanContext.artifacts.length,
      recommendationCount: scanContext.recommendations.length,
    },
  );

  return {
    exportId,
    format,
    downloadUrl: `/api/exports/${exportId}?download=1`,
    objectKey,
  };
}

export function listProviderCatalogView() {
  return {
    catalog: listProviderCapabilityCatalog(),
  };
}

export function getInferenceCapabilityView(env: Env) {
  return {
    inference: getInferenceCapabilities(env),
  };
}

export async function listZoneView(env: Env) {
  return {
    zones: await listCloudflareZones(env),
    controlPlane: getCloudflareControlPlaneReadiness(env),
  };
}

export async function validateHostnameView(
  env: Env,
  body: HostnameValidationRequestBody,
) {
  if (!body.publicHostname) {
    throw new Error("publicHostname is required.");
  }

  return {
    validation: await validateTunnelHostname(env, {
      publicHostname: body.publicHostname,
      cloudflareZoneId: body.cloudflareZoneId,
      existingTunnelId: body.tunnelId,
    }),
  };
}

export function redactTunnelObservabilityForMcp(input: {
  tunnel: Awaited<ReturnType<typeof getTunnelRecord>>;
  events: Array<{
    id: string;
    tunnelId: string;
    kind: string;
    level: "info" | "warning" | "error";
    summary: string;
    detailJson: string;
    createdAt: string;
  }>;
  testRuns: Array<{
    id: string;
    tunnelId: string;
    status: "passed" | "failed" | "warning";
    resultJson: string;
    testedAt: string;
    createdAt: string;
  }>;
  lastKnownGood: Awaited<ReturnType<typeof getLastKnownGoodTunnelTestRun>>;
}) {
  const tunnel = input.tunnel;
  if (!tunnel) {
    throw new Error("Tunnel record not found.");
  }

  const serializedEvents = input.events.map(serializeTunnelEventRecord);
  const serializedTests = input.testRuns.map(serializeTunnelTestRunRecord);
  const latestTest =
    serializedTests[0]?.result ??
    safeJsonParse<TunnelConnectionTestResult | null>(tunnel.lastTestResultJson, null);
  const lastKnownGoodResult = input.lastKnownGood
    ? safeJsonParse<TunnelConnectionTestResult | null>(input.lastKnownGood.resultJson, null)
    : null;

  return {
    tunnel: {
      id: tunnel.id,
      publicHostname: tunnel.publicHostname,
      cloudflareTunnelId: tunnel.cloudflareTunnelId,
      cloudflareTunnelName: tunnel.cloudflareTunnelName,
      status: tunnel.status,
      connectorStatus: tunnel.connectorStatus,
      accessProtected: tunnel.accessProtected,
      secretConfigured: tunnel.secretConfigured,
      lastConnectorHeartbeatAt: tunnel.lastConnectorHeartbeatAt,
      lastTunnelHealthAt: tunnel.lastTunnelHealthAt,
      lastTestedAt: tunnel.lastTestedAt,
      lastTestStatus: tunnel.lastTestStatus,
      metadata: safeJsonParse<Record<string, unknown>>(tunnel.metadataJson, {}),
      createdAt: tunnel.createdAt,
      updatedAt: tunnel.updatedAt,
    },
    observability: {
      events: serializedEvents,
      recentTests: serializedTests,
      latestTest,
      lastKnownGood: lastKnownGoodResult,
      versionDrift: buildVersionDrift(
        serializedEvents.filter((event) => event.kind === "connector.heartbeat"),
      ),
      failureDelta: buildTunnelFailureDelta(latestTest, lastKnownGoodResult),
    },
  };
}

export async function getTunnelObservabilityView(env: Env, tunnelId: string) {
  const [tunnel, events, testRuns, lastKnownGood] = await Promise.all([
    getTunnelRecord(env, tunnelId),
    listTunnelEvents(env, tunnelId, 25),
    listTunnelTestRuns(env, tunnelId, 8),
    getLastKnownGoodTunnelTestRun(env, tunnelId),
  ]);

  return redactTunnelObservabilityForMcp({
    tunnel,
    events,
    testRuns,
    lastKnownGood,
  });
}
