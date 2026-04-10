import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { JobCoordinator } from "./durable-objects/job-coordinator";
import {
  activatePairingSession,
  createExportRecord,
  createJob,
  createPairingSession,
  createScanRuns,
  createProviderSetting,
  createTunnelRecord,
  deleteDomainWatch,
  deleteProviderSetting,
  deleteTunnelRecord,
  getArtifactsForRun,
  getDomainWatch,
  getExportRecord,
  getFindingsForRun,
  getJob,
  getLatestRunForDomain,
  getLastKnownGoodTunnelTestRun,
  getPairingSession,
  getProviderSetting,
  getTunnelRecord,
  getRecommendationsForRun,
  getRunsForJob,
  getScanContext,
  getScanRun,
  insertArtifact,
  insertTunnelEvent,
  insertTunnelTestRun,
  listProviderSettings,
  listTunnelEvents,
  listTunnelRecords,
  listTunnelTestRuns,
  listDueDomainWatches,
  listDomainHistory,
  markRunFailed,
  markDomainWatchEnqueued,
  markRunStarted,
  markTunnelHeartbeat,
  markPairingSessionSeen,
  recalculateJobStatus,
  revokeOtherActivePairingsForTunnel,
  storeProviderTestResult,
  storeTunnelTestResult,
  storeRunBundle,
  attachWorkflowInstance,
  upsertDomainWatch,
  updateProviderSetting,
  updateTunnelRecord,
  listPairingSessionsForTunnel,
} from "./lib/repository";
import { buildCanonicalUrl, normalizeDomain, normalizeRequestedDomains } from "./lib/domain";
import {
  badRequest,
  jsonResponse,
  methodNotAllowed,
  notFound,
  safeJsonParse,
} from "./lib/utils";
import {
  bundleHasModuleFailures,
  performEdgeScan,
  summarizeModuleFailures,
} from "./lib/scanner";
import { buildHistoryEntries } from "./lib/history";
import { generateArtifacts } from "./lib/artifacts";
import {
  exportContentType,
  renderApiPayloadExport,
  renderJsonExport,
  renderMarkdownExport,
  renderTerraformExport,
} from "./lib/exports";
import {
  buildAiBriefArtifactKey,
  generateAiBrief,
  getInferenceCapabilities,
} from "./lib/inference";
import {
  normalizeProviderSettingsInput,
  serializeProviderSetting,
  testProviderConnection,
} from "./lib/provider-settings";
import {
  buildConnectorBootstrapResponse,
  buildConnectorSessionView,
  buildPairingSecretView,
  issueConnectorSession,
  issuePairingSecret,
  serializePairingSession,
  verifyOpaqueToken,
} from "./lib/pairings";
import {
  destroyTunnelResources,
  getCloudflareControlPlaneReadiness,
  listCloudflareZones,
  normalizeTunnelSettingsInput,
  provisionTunnelResources,
  serializeTunnelRecord,
  testTunnelConnection,
  validateTunnelHostname,
} from "./lib/tunnels";
import { renderProviderControlPlaneApp } from "./lib/app-shell";
import { renderTunnelControlPlaneApp } from "./lib/tunnel-app-shell";
import {
  decryptProviderSecretPayload,
  decryptTunnelSecretPayload,
  encryptProviderSecretPayload,
  encryptTunnelSecretPayload,
} from "./lib/secrets";
import { requireOperatorSession } from "./lib/auth";
import type {
  AiBriefRequestBody,
  ArtifactQueueMessage,
  DomainWatchRequestBody,
  ExportFormat,
  HostnameValidationRequestBody,
  OperatorSession,
  PairingCreateRequestBody,
  PairingExchangeRequestBody,
  ProviderSettingsRequestBody,
  ProviderTestRequestBody,
  ScanQueueMessage,
  ScanRequestBody,
  ScanWorkflowParams,
  TunnelSettingsRequestBody,
  TunnelHeartbeatRequestBody,
  TunnelTestRequestBody,
  TunnelConnectionTestResult,
} from "./types";
import { EdgeIntelScanWorkflow } from "./workflows/scan-workflow";

function coordinatorFor(env: Env, jobId: string) {
  return env.JOB_COORDINATOR.getByName(jobId);
}

async function streamJobEvents(env: Env, jobId: string, cursor = 0): Promise<Response> {
  const coordinator = coordinatorFor(env, jobId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastSeq = cursor;

      for (let iteration = 0; iteration < 30; iteration += 1) {
        const rawEvents = await coordinator.getEvents(lastSeq);
        const events = Array.from(
          rawEvents as Array<{
            seq: number;
            type: string;
            payload: Record<string, unknown>;
          }>,
        );
        const snapshot = await coordinator.getSnapshot();

        for (const event of events) {
          lastSeq = event.seq;
          controller.enqueue(
            encoder.encode(
              `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(
                event.payload,
              )}\n\n`,
            ),
          );
        }

        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`),
        );

        if (
          snapshot.status === "completed" ||
          snapshot.status === "completed_with_failures" ||
          snapshot.status === "failed"
        ) {
          controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
          controller.close();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      connection: "keep-alive",
    },
  });
}

function isOperatorControlPlaneRoute(request: Request, path: string): boolean {
  if (request.method === "GET" && (path === "/app" || path === "/app/providers")) {
    return true;
  }

  if (request.method === "GET" && path === "/app/tunnels") {
    return true;
  }

  if (path === "/api/session") {
    return true;
  }

  if (path === "/api/settings/providers" || path.startsWith("/api/settings/providers/")) {
    return true;
  }

  if (path === "/api/tunnels") {
    return true;
  }

  if (/^\/api\/tunnels\/[^/]+$/.test(path)) {
    return true;
  }

  if (/^\/api\/tunnels\/[^/]+\/(test|rotate-token|events|observability)$/.test(path)) {
    return true;
  }

  if (path === "/api/pairings") {
    return true;
  }

  if (request.method === "GET" && path === "/api/zones") {
    return true;
  }

  if (request.method === "POST" && path === "/api/hostnames/validate") {
    return true;
  }

  return false;
}

function buildPairingMetadata(
  existingMetadataJson: string | null,
  patch: Record<string, unknown>,
): string {
  return JSON.stringify({
    ...safeJsonParse<Record<string, unknown>>(existingMetadataJson, {}),
    ...patch,
  });
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

async function handleCreateScan(request: Request, env: Env): Promise<Response> {
  let body: ScanRequestBody;
  try {
    body = (await request.json()) as ScanRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const maxBatchSize = Number(env.SCAN_BATCH_LIMIT || "10");
  let normalizedDomains: string[];
  try {
    normalizedDomains = normalizeRequestedDomains(
      body.domain,
      body.domains,
      maxBatchSize,
    );
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domains.");
  }

  const requestedDomains = [
    ...(body.domain ? [body.domain] : []),
    ...(body.domains ?? []),
  ];

  const created = await createScanJob(env, requestedDomains, normalizedDomains);

  return jsonResponse(created, { status: 202 });
}

async function createScanJob(
  env: Env,
  requestedDomains: string[],
  normalizedDomains: string[],
): Promise<{
  jobId: string;
  workflowInstanceId: string;
  domains: string[];
  scanRuns: Array<{ id: string; domain: string }>;
  statusUrl: string;
  eventsUrl: string;
}> {
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

async function handleGetJob(env: Env, jobId: string): Promise<Response> {
  const job = await getJob(env, jobId);
  if (!job) return notFound("Job not found.");

  const [runs, snapshot] = await Promise.all([
    getRunsForJob(env, jobId),
    coordinatorFor(env, jobId).getSnapshot(),
  ]);

  return jsonResponse({
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
  });
}

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

async function handleGetScan(env: Env, scanRunId: string): Promise<Response> {
  const scanContext = await getScanContext(env, scanRunId);
  if (!scanContext) return notFound("Scan run not found.");

  return jsonResponse(serializeScanContext(scanContext));
}

async function handleDomainHistory(env: Env, domainParam: string): Promise<Response> {
  let domain: string;
  try {
    domain = normalizeDomain(domainParam);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domain.");
  }
  const history = await listDomainHistory(env, domain);
  const historyEntries = buildHistoryEntries(history);
  const latest = history[0] ?? null;
  const watch = await getDomainWatch(env, domain);
  return jsonResponse({
    domain,
    latest: historyEntries[0] ?? latest,
    watch,
    history: historyEntries,
  });
}

async function handleLatestDomain(env: Env, domainParam: string): Promise<Response> {
  let domain: string;
  try {
    domain = normalizeDomain(domainParam);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domain.");
  }

  const latestRun = await getLatestRunForDomain(env, domain);
  if (!latestRun) return notFound("No scans found for domain.");

  const scanContext = await getScanContext(env, latestRun.id);
  if (!scanContext) return notFound("Latest scan context not found.");

  return jsonResponse({
    domain,
    latest: serializeScanContext(scanContext),
  });
}

async function handleInferenceCapabilities(env: Env): Promise<Response> {
  return jsonResponse({
    inference: getInferenceCapabilities(env),
  });
}

function handleProviderControlPlaneApp(): Response {
  return new Response(
    renderProviderControlPlaneApp({
      providersEndpoint: "/api/settings/providers",
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function handleTunnelControlPlaneApp(): Response {
  return new Response(
    renderTunnelControlPlaneApp({
      tunnelsEndpoint: "/api/tunnels",
      providersEndpoint: "/api/settings/providers",
      zonesEndpoint: "/api/zones",
      hostnameValidationEndpoint: "/api/hostnames/validate",
    }),
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

async function handleListProviders(env: Env): Promise<Response> {
  const providers = await listProviderSettings(env);
  return jsonResponse({
    providers: providers.map(serializeProviderSetting),
  });
}

async function handleGetProvider(env: Env, providerId: string): Promise<Response> {
  const provider = await getProviderSetting(env, providerId);
  if (!provider) return notFound("Provider setting not found.");

  return jsonResponse({
    provider: serializeProviderSetting(provider),
  });
}

async function handleCreateProvider(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: ProviderSettingsRequestBody;
  try {
    body = (await request.json()) as ProviderSettingsRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    const normalized = normalizeProviderSettingsInput(body);
    const secretEnvelopeJson = normalized.secret
      ? await encryptProviderSecretPayload(env, normalized.secret)
      : null;
    const providerId = await createProviderSetting(env, {
      kind: normalized.kind,
      providerCode: normalized.providerCode,
      displayName: normalized.displayName,
      baseUrl: normalized.baseUrl,
      defaultModel: normalized.defaultModel,
      usesAiGateway: normalized.usesAiGateway,
      oauthConnected: normalized.oauthConnected,
      status: normalized.status,
      secretEnvelopeJson,
      metadataJson: JSON.stringify(normalized.metadata),
    });

    const created = await getProviderSetting(env, providerId);
    if (!created) {
      return jsonResponse({ error: "Provider was created but could not be loaded." }, { status: 500 });
    }

    return jsonResponse({ provider: serializeProviderSetting(created) }, { status: 201 });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Invalid provider payload.",
    );
  }
}

async function handleUpdateProvider(
  request: Request,
  env: Env,
  providerId: string,
): Promise<Response> {
  const existing = await getProviderSetting(env, providerId);
  if (!existing) return notFound("Provider setting not found.");

  let body: ProviderSettingsRequestBody;
  try {
    body = (await request.json()) as ProviderSettingsRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    const merged = normalizeProviderSettingsInput(
      {
        kind: body.kind ?? existing.kind,
        providerCode: body.providerCode ?? existing.providerCode,
        displayName: body.displayName ?? existing.displayName,
        baseUrl: body.baseUrl === undefined ? existing.baseUrl : body.baseUrl,
        defaultModel:
          body.defaultModel === undefined ? existing.defaultModel : body.defaultModel,
        usesAiGateway: body.usesAiGateway ?? existing.usesAiGateway,
        oauthConnected: body.oauthConnected ?? existing.oauthConnected,
        status: body.status ?? existing.status,
        metadata:
          body.metadata ??
          safeJsonParse(existing.metadataJson, {}),
        secret: body.secret ?? undefined,
      },
      { partial: true },
    );

    const secretEnvelopeJson =
      body.secret === undefined
        ? existing.secretEnvelopeJson
        : body.secret
          ? await encryptProviderSecretPayload(env, body.secret)
          : null;

    await updateProviderSetting(env, providerId, {
      kind: merged.kind,
      providerCode: merged.providerCode,
      displayName: merged.displayName,
      baseUrl: merged.baseUrl,
      defaultModel: merged.defaultModel,
      usesAiGateway: merged.usesAiGateway,
      oauthConnected: merged.oauthConnected,
      status: merged.status,
      secretEnvelopeJson,
      metadataJson: JSON.stringify(merged.metadata),
    });

    const updated = await getProviderSetting(env, providerId);
    if (!updated) {
      return jsonResponse({ error: "Provider was updated but could not be loaded." }, { status: 500 });
    }

    return jsonResponse({ provider: serializeProviderSetting(updated) });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Invalid provider payload.",
    );
  }
}

async function handleDeleteProvider(
  env: Env,
  providerId: string,
): Promise<Response> {
  const existing = await getProviderSetting(env, providerId);
  if (!existing) return notFound("Provider setting not found.");

  await deleteProviderSetting(env, providerId);
  return jsonResponse({
    deleted: true,
    providerId,
  });
}

async function handleTestProvider(
  request: Request,
  env: Env,
  providerId: string,
): Promise<Response> {
  const provider = await getProviderSetting(env, providerId);
  if (!provider) return notFound("Provider setting not found.");

  const body = (await request.json().catch(() => ({}))) as ProviderTestRequestBody;

  try {
    const secrets = await decryptProviderSecretPayload(env, provider.secretEnvelopeJson);
    const result = await testProviderConnection(env, provider, secrets, body);

    if (body.persistResult !== false) {
      await storeProviderTestResult(env, providerId, result);
    }

    const refreshed = await getProviderSetting(env, providerId);

    return jsonResponse({
      provider: refreshed ? serializeProviderSetting(refreshed) : serializeProviderSetting(provider),
      testResult: result,
    });
  } catch (error) {
    const failure = {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Provider connection test failed.",
      latencyMs: 0,
      transport: "control-plane-error",
      targetUrl: provider.baseUrl,
      providerCode: provider.providerCode,
      model: provider.defaultModel,
      details: {},
      testedAt: new Date().toISOString(),
    } as const;

    if (body.persistResult !== false) {
      await storeProviderTestResult(env, providerId, failure);
    }

    return jsonResponse(
      {
        provider: serializeProviderSetting(
          (await getProviderSetting(env, providerId)) ?? provider,
        ),
        testResult: failure,
      },
      { status: 502 },
    );
  }
}

async function handleGetSession(session: OperatorSession): Promise<Response> {
  return jsonResponse({ session });
}

async function handleListZones(env: Env): Promise<Response> {
  try {
    const zones = await listCloudflareZones(env);
    return jsonResponse({
      zones,
      defaultZoneId: env.CLOUDFLARE_ZONE_ID?.trim() || null,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Cloudflare zones.",
      },
      { status: 502 },
    );
  }
}

async function handleValidateHostname(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as HostnameValidationRequestBody;
  const publicHostname = body.publicHostname?.trim();
  if (!publicHostname) {
    return badRequest("publicHostname is required.");
  }

  const tunnel = body.tunnelId?.trim()
    ? await getTunnelRecord(env, body.tunnelId.trim())
    : null;

  try {
    const validation = await validateTunnelHostname(env, {
      publicHostname,
      cloudflareZoneId: body.cloudflareZoneId ?? null,
      existingTunnelId: tunnel?.cloudflareTunnelId ?? null,
    });
    return jsonResponse({ validation });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Hostname validation failed.",
    );
  }
}

async function hydrateTunnelZoneSelection(
  env: Env,
  body: TunnelSettingsRequestBody,
  existing?: { cloudflareTunnelId: string | null } | null,
): Promise<TunnelSettingsRequestBody> {
  const requestedZoneId = body.cloudflareZoneId?.trim();
  if (requestedZoneId || env.CLOUDFLARE_ZONE_ID?.trim() || !body.publicHostname?.trim()) {
    return body;
  }

  const validation = await validateTunnelHostname(env, {
    publicHostname: body.publicHostname,
    cloudflareZoneId: null,
    existingTunnelId: existing?.cloudflareTunnelId ?? null,
  });

  return {
    ...body,
    cloudflareZoneId: validation.suggestedZoneId,
  };
}

async function handleListTunnels(env: Env): Promise<Response> {
  const tunnels = await listTunnelRecords(env);
  return jsonResponse({
    tunnels: tunnels.map(serializeTunnelRecord),
    controlPlane: getCloudflareControlPlaneReadiness(env),
  });
}

async function handleGetTunnel(env: Env, tunnelId: string): Promise<Response> {
  const tunnel = await getTunnelRecord(env, tunnelId);
  if (!tunnel) return notFound("Tunnel record not found.");

  const pairings = await listPairingSessionsForTunnel(env, tunnelId, 8);
  return jsonResponse({
    tunnel: serializeTunnelRecord(tunnel),
    pairings: pairings.map(serializePairingSession),
  });
}

async function handleGetTunnelEvents(env: Env, tunnelId: string): Promise<Response> {
  const tunnel = await getTunnelRecord(env, tunnelId);
  if (!tunnel) return notFound("Tunnel record not found.");

  const events = await listTunnelEvents(env, tunnelId, 25);
  return jsonResponse({
    tunnel: serializeTunnelRecord(tunnel),
    events: events.map(serializeTunnelEventRecord),
  });
}

async function handleGetTunnelObservability(
  env: Env,
  tunnelId: string,
): Promise<Response> {
  const tunnel = await getTunnelRecord(env, tunnelId);
  if (!tunnel) return notFound("Tunnel record not found.");

  const [events, testRuns, lastKnownGood] = await Promise.all([
    listTunnelEvents(env, tunnelId, 25),
    listTunnelTestRuns(env, tunnelId, 8),
    getLastKnownGoodTunnelTestRun(env, tunnelId),
  ]);

  const serializedEvents = events.map(serializeTunnelEventRecord);
  const serializedTests = testRuns.map(serializeTunnelTestRunRecord);
  const latestTest =
    serializedTests[0]?.result ??
    safeJsonParse<TunnelConnectionTestResult | null>(tunnel.lastTestResultJson, null);
  const lastKnownGoodResult = lastKnownGood
    ? safeJsonParse<TunnelConnectionTestResult | null>(lastKnownGood.resultJson, null)
    : null;

  return jsonResponse({
    tunnel: serializeTunnelRecord(tunnel),
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
  });
}

async function handleCreateTunnel(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: TunnelSettingsRequestBody;
  try {
    body = (await request.json()) as TunnelSettingsRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    const hydratedBody = await hydrateTunnelZoneSelection(env, body);
    const normalized = normalizeTunnelSettingsInput(hydratedBody, env);

    if (normalized.providerSettingId) {
      const provider = await getProviderSetting(env, normalized.providerSettingId);
      if (!provider) {
        return notFound("Linked provider setting not found.");
      }
    }

    const provisioned = await provisionTunnelResources(env, normalized);
    const secretEnvelopeJson = provisioned.secrets
      ? await encryptTunnelSecretPayload(env, provisioned.secrets)
      : null;

    const tunnelId = await createTunnelRecord(env, {
      providerSettingId: normalized.providerSettingId,
      cloudflareTunnelId: provisioned.cloudflareTunnelId,
      cloudflareTunnelName: provisioned.cloudflareTunnelName,
      cloudflareZoneId: provisioned.cloudflareZoneId,
      publicHostname: provisioned.publicHostname,
      localServiceUrl: provisioned.localServiceUrl,
      accessProtected: provisioned.accessProtected,
      accessAppId: provisioned.accessAppId,
      accessPolicyId: provisioned.accessPolicyId,
      accessServiceTokenId: provisioned.accessServiceTokenId,
      dnsRecordId: provisioned.dnsRecordId,
      secretEnvelopeJson,
      connectorStatus: provisioned.connectorStatus,
      status: provisioned.status,
      metadataJson: JSON.stringify(provisioned.metadata),
    });

    const created = await getTunnelRecord(env, tunnelId);
    if (!created) {
      return jsonResponse(
        { error: "Tunnel was created but could not be loaded." },
        { status: 500 },
      );
    }

    await insertTunnelEvent(env, {
      tunnelId: created.id,
      kind: "tunnel.created",
      level: "info",
      summary: `Provisioned ${created.publicHostname}`,
      detailJson: JSON.stringify({
        cloudflareZoneId: created.cloudflareZoneId,
        accessProtected: created.accessProtected,
        linkedProviderId: created.providerSettingId,
      }),
    }).catch(() => {});

    return jsonResponse(
      {
        tunnel: serializeTunnelRecord(created),
      },
      { status: 201 },
    );
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Invalid tunnel payload.",
    );
  }
}

async function handleUpdateTunnel(
  request: Request,
  env: Env,
  tunnelId: string,
): Promise<Response> {
  const existing = await getTunnelRecord(env, tunnelId);
  if (!existing) return notFound("Tunnel record not found.");

  let body: TunnelSettingsRequestBody;
  try {
    body = (await request.json()) as TunnelSettingsRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  try {
    const hydratedBody = await hydrateTunnelZoneSelection(env, body, existing);
    const normalized = normalizeTunnelSettingsInput(hydratedBody, env, {
      partial: true,
      existing,
    });

    if (normalized.providerSettingId) {
      const provider = await getProviderSetting(env, normalized.providerSettingId);
      if (!provider) {
        return notFound("Linked provider setting not found.");
      }
    }

    const existingSecrets = await decryptTunnelSecretPayload(
      env,
      existing.secretEnvelopeJson,
    );
    const provisioned = await provisionTunnelResources(env, normalized, {
      existing,
      existingSecrets,
    });

    const secretEnvelopeJson = provisioned.secrets
      ? await encryptTunnelSecretPayload(env, provisioned.secrets)
      : null;

    await updateTunnelRecord(env, tunnelId, {
      providerSettingId: normalized.providerSettingId,
      cloudflareTunnelId: provisioned.cloudflareTunnelId,
      cloudflareTunnelName: provisioned.cloudflareTunnelName,
      cloudflareZoneId: provisioned.cloudflareZoneId,
      publicHostname: provisioned.publicHostname,
      localServiceUrl: provisioned.localServiceUrl,
      accessProtected: provisioned.accessProtected,
      accessAppId: provisioned.accessAppId,
      accessPolicyId: provisioned.accessPolicyId,
      accessServiceTokenId: provisioned.accessServiceTokenId,
      dnsRecordId: provisioned.dnsRecordId,
      secretEnvelopeJson,
      connectorStatus: provisioned.connectorStatus,
      status: provisioned.status,
      metadataJson: JSON.stringify(provisioned.metadata),
    });

    const updated = await getTunnelRecord(env, tunnelId);
    if (!updated) {
      return jsonResponse(
        { error: "Tunnel was updated but could not be loaded." },
        { status: 500 },
      );
    }

    await insertTunnelEvent(env, {
      tunnelId: updated.id,
      kind: "tunnel.updated",
      level: "info",
      summary: `Updated ${updated.publicHostname}`,
      detailJson: JSON.stringify({
        cloudflareZoneId: updated.cloudflareZoneId,
        accessProtected: updated.accessProtected,
        linkedProviderId: updated.providerSettingId,
      }),
    }).catch(() => {});

    return jsonResponse({
      tunnel: serializeTunnelRecord(updated),
    });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Invalid tunnel payload.",
    );
  }
}

async function handleDeleteTunnel(env: Env, tunnelId: string): Promise<Response> {
  const existing = await getTunnelRecord(env, tunnelId);
  if (!existing) return notFound("Tunnel record not found.");

  try {
    await destroyTunnelResources(env, existing);
    await deleteTunnelRecord(env, tunnelId);
    return jsonResponse({
      deleted: true,
      tunnelId,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tunnel deletion failed.",
      },
      { status: 502 },
    );
  }
}

async function handleTestTunnel(
  request: Request,
  env: Env,
  tunnelId: string,
): Promise<Response> {
  const tunnel = await getTunnelRecord(env, tunnelId);
  if (!tunnel) return notFound("Tunnel record not found.");

  const body = (await request.json().catch(() => ({}))) as TunnelTestRequestBody;
  const secrets = await decryptTunnelSecretPayload(env, tunnel.secretEnvelopeJson);
  const provider = tunnel.providerSettingId
    ? await getProviderSetting(env, tunnel.providerSettingId)
    : null;

  try {
    const result = await testTunnelConnection(
      env,
      tunnel,
      secrets,
      provider,
      body,
    );

    if (body.persistResult !== false) {
      await storeTunnelTestResult(env, tunnelId, result);
      await Promise.all([
        insertTunnelTestRun(env, tunnelId, result),
        insertTunnelEvent(env, {
        tunnelId,
        kind: "tunnel.test",
        level: result.status === "passed" ? "info" : result.status === "warning" ? "warning" : "error",
        summary: result.message,
        detailJson: JSON.stringify(result),
        }),
      ]).catch(() => {});
    }

    const refreshed = await getTunnelRecord(env, tunnelId);
    const pairings = await listPairingSessionsForTunnel(env, tunnelId, 8);
    return jsonResponse({
      tunnel: refreshed ? serializeTunnelRecord(refreshed) : serializeTunnelRecord(tunnel),
      pairings: pairings.map(serializePairingSession),
      testResult: result,
    });
  } catch (error) {
    const failure = {
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Tunnel connection test failed.",
      latencyMs: 0,
      publicHostname: tunnel.publicHostname,
      tunnelId: tunnel.cloudflareTunnelId,
      details: {},
      testedAt: new Date().toISOString(),
    } as const;

    if (body.persistResult !== false) {
      await storeTunnelTestResult(env, tunnelId, failure);
      await Promise.all([
        insertTunnelTestRun(env, tunnelId, failure),
        insertTunnelEvent(env, {
        tunnelId,
        kind: "tunnel.test",
        level: "error",
        summary: failure.message,
        detailJson: JSON.stringify(failure),
        }),
      ]).catch(() => {});
    }

    return jsonResponse(
      {
        tunnel: serializeTunnelRecord((await getTunnelRecord(env, tunnelId)) ?? tunnel),
        testResult: failure,
      },
      { status: 502 },
    );
  }
}

async function handleRotateTunnelToken(
  env: Env,
  tunnelId: string,
): Promise<Response> {
  const existing = await getTunnelRecord(env, tunnelId);
  if (!existing) return notFound("Tunnel record not found.");
  if (!existing.cloudflareTunnelId) {
    return badRequest("Tunnel record is missing the Cloudflare tunnel ID.");
  }

  const normalized = normalizeTunnelSettingsInput({}, env, {
    partial: true,
    existing,
  });
  const existingSecrets = await decryptTunnelSecretPayload(env, existing.secretEnvelopeJson);
  const provisioned = await provisionTunnelResources(env, normalized, {
    existing,
    existingSecrets,
    rotateAccessTokens: true,
  });
  const secretEnvelopeJson = provisioned.secrets
    ? await encryptTunnelSecretPayload(env, provisioned.secrets)
    : null;

  await updateTunnelRecord(env, tunnelId, {
    providerSettingId: existing.providerSettingId,
    cloudflareTunnelId: provisioned.cloudflareTunnelId,
    cloudflareTunnelName: provisioned.cloudflareTunnelName,
    cloudflareZoneId: provisioned.cloudflareZoneId,
    publicHostname: provisioned.publicHostname,
    localServiceUrl: provisioned.localServiceUrl,
    accessProtected: provisioned.accessProtected,
    accessAppId: provisioned.accessAppId,
    accessPolicyId: provisioned.accessPolicyId,
    accessServiceTokenId: provisioned.accessServiceTokenId,
    dnsRecordId: provisioned.dnsRecordId,
    secretEnvelopeJson,
    connectorStatus: provisioned.connectorStatus,
    status: provisioned.status,
    metadataJson: JSON.stringify({
      ...provisioned.metadata,
      rotatedAt: new Date().toISOString(),
    }),
  });

  const refreshed = await getTunnelRecord(env, tunnelId);
  const pairings = await listPairingSessionsForTunnel(env, tunnelId, 8);
  await insertTunnelEvent(env, {
    tunnelId,
    kind: "tunnel.rotated",
    level: "warning",
    summary: `Rotated scoped bootstrap for ${existing.publicHostname}`,
    detailJson: JSON.stringify({
      cloudflareTunnelId: provisioned.cloudflareTunnelId,
      rotatedAt: new Date().toISOString(),
    }),
  }).catch(() => {});
  return jsonResponse({
    tunnel: refreshed ? serializeTunnelRecord(refreshed) : serializeTunnelRecord(existing),
    pairings: pairings.map(serializePairingSession),
    rotated: true,
    nextStep:
      "Create a fresh pairing before reconnecting any local connector because the tunnel bootstrap changed.",
  });
}

async function handleTunnelHeartbeat(
  request: Request,
  env: Env,
  tunnelId: string,
): Promise<Response> {
  const existing = await getTunnelRecord(env, tunnelId);
  if (!existing) return notFound("Tunnel record not found.");

  const pairingId = request.headers.get("X-EdgeIntel-Pairing-Id")?.trim() ?? null;
  if (!pairingId) {
    return jsonResponse(
      { error: "Missing X-EdgeIntel-Pairing-Id header." },
      { status: 401 },
    );
  }

  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  const tokenMatch = /^Bearer\s+(.+)$/.exec(authorization);
  if (!tokenMatch) {
    return jsonResponse(
      { error: "Missing connector bearer token." },
      { status: 401 },
    );
  }

  const pairing = await getPairingSession(env, pairingId);
  if (!pairing || pairing.tunnelId !== tunnelId) {
    return notFound("Pairing session not found.");
  }

  if (pairing.status !== "active" || !pairing.connectorExpiresAt) {
    return jsonResponse(
      { error: "Connector pairing is not active." },
      { status: 403 },
    );
  }

  if (new Date(pairing.connectorExpiresAt).getTime() <= Date.now()) {
    return jsonResponse(
      { error: "Connector bearer token has expired." },
      { status: 403 },
    );
  }

  const isValidConnectorToken = await verifyOpaqueToken(
    tokenMatch[1] ?? "",
    pairing.connectorTokenHash,
  );
  if (!isValidConnectorToken) {
    return jsonResponse(
      { error: "Connector bearer token is invalid." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as TunnelHeartbeatRequestBody;
  const connectorStatus = body.connectorStatus ?? "connected";
  const currentMetadata = safeJsonParse<Record<string, unknown>>(
    existing.metadataJson,
    {},
  );
  const previousConnector =
    currentMetadata.connector &&
    typeof currentMetadata.connector === "object" &&
    !Array.isArray(currentMetadata.connector)
      ? (currentMetadata.connector as Record<string, unknown>)
      : null;
  const previousStatus =
    typeof previousConnector?.status === "string" ? previousConnector.status : null;
  const previousVersion =
    typeof previousConnector?.version === "string" ? previousConnector.version : null;
  const previousReachable =
    typeof previousConnector?.localServiceReachable === "boolean"
      ? previousConnector.localServiceReachable
      : null;

  await markTunnelHeartbeat(env, tunnelId, {
    connectorStatus,
    metadataJson: JSON.stringify({
      ...currentMetadata,
      connector: {
        pairingId,
        status: connectorStatus,
        version: body.version ?? null,
        localServiceReachable: body.localServiceReachable ?? null,
        model: body.model ?? null,
        note: body.note ?? null,
        heartbeatAt: new Date().toISOString(),
      },
    }),
  });
  await markPairingSessionSeen(
    env,
    pairingId,
    buildPairingMetadata(pairing.metadataJson, {
      lastHeartbeatAt: new Date().toISOString(),
      lastStatus: connectorStatus,
      lastNote: body.note ?? null,
      lastReachable: body.localServiceReachable ?? null,
      connectorName: pairing.connectorName,
      connectorVersion: body.version ?? pairing.connectorVersion,
    }),
  );
  if (
    previousStatus !== connectorStatus ||
    previousVersion !== (body.version ?? null) ||
    previousReachable !== (body.localServiceReachable ?? null)
  ) {
    await insertTunnelEvent(env, {
      tunnelId,
      kind: "connector.heartbeat",
      level:
        connectorStatus === "connected"
          ? "info"
          : connectorStatus === "degraded"
            ? "warning"
            : "error",
      summary: `Connector ${connectorStatus} for ${existing.publicHostname}`,
      detailJson: JSON.stringify({
        pairingId,
        version: body.version ?? null,
        localServiceReachable: body.localServiceReachable ?? null,
        note: body.note ?? null,
      }),
    }).catch(() => {});
  }

  const refreshed = await getTunnelRecord(env, tunnelId);
  return jsonResponse({
    ok: true,
    tunnel: refreshed ? serializeTunnelRecord(refreshed) : serializeTunnelRecord(existing),
  });
}

async function handleCreatePairing(
  request: Request,
  env: Env,
  session: OperatorSession,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as PairingCreateRequestBody;
  const tunnelId = body.tunnelId?.trim();
  if (!tunnelId) {
    return badRequest("tunnelId is required.");
  }

  const tunnel = await getTunnelRecord(env, tunnelId);
  if (!tunnel) {
    return notFound("Tunnel record not found.");
  }

  const issued = await issuePairingSecret(env, body.expiresInSeconds ?? null);
  const pairingId = await createPairingSession(env, {
    tunnelId,
    issuedBySubject: session.subject,
    issuedByEmail: session.email,
    pairingTokenHash: issued.pairingTokenHash,
    expiresAt: issued.expiresAt,
    metadataJson: JSON.stringify({
      label: body.label?.trim() || null,
      note: body.note?.trim() || null,
      issuedByName: session.name,
      issuedByMode: session.mode,
    }),
  });

  const pairing = await getPairingSession(env, pairingId);
  if (!pairing) {
    return jsonResponse(
      { error: "Pairing session was created but could not be loaded." },
      { status: 500 },
    );
  }

  await insertTunnelEvent(env, {
    tunnelId,
    kind: "pairing.created",
    level: "info",
    summary: `Created one-time pairing for ${tunnel.publicHostname}`,
    detailJson: JSON.stringify({
      pairingId,
      issuedBy: session.email ?? session.subject,
      expiresAt: pairing.expiresAt,
    }),
  }).catch(() => {});

  return jsonResponse(
    {
      pairing: serializePairingSession(pairing),
      pairingSecret: buildPairingSecretView(
        request,
        tunnel,
        pairing,
        issued.pairingToken,
      ),
    },
    { status: 201 },
  );
}

async function handleExchangePairing(
  request: Request,
  env: Env,
  pairingId: string,
): Promise<Response> {
  const pairing = await getPairingSession(env, pairingId);
  if (!pairing) return notFound("Pairing session not found.");
  if (pairing.status !== "pending") {
    return jsonResponse(
      { error: "Pairing session is no longer available for exchange." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PairingExchangeRequestBody;
  const pairingToken = body.pairingToken?.trim();
  if (!pairingToken) {
    return badRequest("pairingToken is required.");
  }

  const tokenValid = await verifyOpaqueToken(pairingToken, pairing.pairingTokenHash);
  if (!tokenValid) {
    return jsonResponse(
      { error: "Pairing token is invalid." },
      { status: 403 },
    );
  }

  const tunnel = await getTunnelRecord(env, pairing.tunnelId);
  if (!tunnel) {
    return notFound("Linked tunnel record not found.");
  }

  const secrets = await decryptTunnelSecretPayload(env, tunnel.secretEnvelopeJson);
  const connectorSession = await issueConnectorSession(env);
  const metadataJson = buildPairingMetadata(pairing.metadataJson, {
    connectorName: body.connectorName?.trim() || null,
    connectorVersion: body.connectorVersion?.trim() || null,
    connectorNote: body.note?.trim() || null,
  });

  await revokeOtherActivePairingsForTunnel(env, tunnel.id, pairingId);
  const activated = await activatePairingSession(env, pairingId, {
    connectorTokenHash: connectorSession.connectorTokenHash,
    connectorExpiresAt: connectorSession.expiresAt,
    connectorName: body.connectorName?.trim() || null,
    connectorVersion: body.connectorVersion?.trim() || null,
    metadataJson,
  });
  if (!activated) {
    return jsonResponse(
      { error: "Pairing session was already exchanged or revoked." },
      { status: 409 },
    );
  }

  const refreshedPairing = await getPairingSession(env, pairingId);
  if (!refreshedPairing) {
    return jsonResponse(
      { error: "Pairing exchange completed but could not be reloaded." },
      { status: 500 },
    );
  }

  await insertTunnelEvent(env, {
    tunnelId: tunnel.id,
    kind: "pairing.exchanged",
    level: "info",
    summary: `Connector paired for ${tunnel.publicHostname}`,
    detailJson: JSON.stringify({
      pairingId: refreshedPairing.id,
      connectorName: refreshedPairing.connectorName,
      connectorVersion: refreshedPairing.connectorVersion,
      connectorExpiresAt: refreshedPairing.connectorExpiresAt,
    }),
  }).catch(() => {});

  return jsonResponse({
    pairing: serializePairingSession(refreshedPairing),
    tunnel: serializeTunnelRecord(tunnel),
    bootstrap: buildConnectorBootstrapResponse(tunnel, secrets),
    connectorSession: buildConnectorSessionView(
      refreshedPairing.id,
      connectorSession.connectorToken,
      connectorSession.expiresAt,
    ),
  });
}

async function handleManualRescan(env: Env, domainParam: string): Promise<Response> {
  let domain: string;
  try {
    domain = normalizeDomain(domainParam);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domain.");
  }

  const created = await createScanJob(env, [domain], [domain]);
  return jsonResponse(
    {
      domain,
      ...created,
    },
    { status: 202 },
  );
}

async function handleUpsertDomainWatch(
  request: Request,
  env: Env,
  domainParam: string,
): Promise<Response> {
  let domain: string;
  try {
    domain = normalizeDomain(domainParam);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domain.");
  }

  const body = (await request.json().catch(() => ({}))) as DomainWatchRequestBody;
  const intervalHours = Number(body.intervalHours ?? 24);
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) {
    return badRequest("intervalHours must be an integer between 1 and 168.");
  }

  await upsertDomainWatch(env, domain, intervalHours);
  const watch = await getDomainWatch(env, domain);

  return jsonResponse(
    {
      domain,
      watch,
    },
    { status: 201 },
  );
}

async function handleDeleteDomainWatch(
  env: Env,
  domainParam: string,
): Promise<Response> {
  let domain: string;
  try {
    domain = normalizeDomain(domainParam);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid domain.");
  }

  await deleteDomainWatch(env, domain);
  return jsonResponse({
    domain,
    watch: null,
  });
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

async function handleCreateExport(
  request: Request,
  env: Env,
  scanRunId: string,
): Promise<Response> {
  const scanContext = await getScanContext(env, scanRunId);
  if (!scanContext) return notFound("Scan run not found.");

  let format: ExportFormat = "markdown";
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      format?: ExportFormat;
    };
    if (body.format) format = body.format;
  }

  const content = renderExportContent(format, scanContext);
  const contentType = exportContentType(format);
  const objectKey = `exports/${scanContext.run.domain}/${scanRunId}/${format}-${Date.now()}.${format === "markdown" ? "md" : format === "terraform" ? "tf" : "json"}`;

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
      schemaVersion: "edgeintel.export.v1.5",
      generatedAt: new Date().toISOString(),
      scanRunId,
      domain: scanContext.run.domain,
      generatedFromFindings: true,
      artifactCount: scanContext.artifacts.length,
      recommendationCount: scanContext.recommendations.length,
    },
  );

  return jsonResponse(
    {
      exportId,
      format,
      downloadUrl: `/api/exports/${exportId}?download=1`,
      objectKey,
    },
    { status: 201 },
  );
}

async function handleCreateAiBrief(
  request: Request,
  env: Env,
  scanRunId: string,
): Promise<Response> {
  const scanContext = await getScanContext(env, scanRunId);
  if (!scanContext) return notFound("Scan run not found.");

  let body: AiBriefRequestBody = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    body = (await request.json().catch(() => ({}))) as AiBriefRequestBody;
  }

  try {
    const brief = await generateAiBrief(env, scanContext, body);
    const artifactId = crypto.randomUUID();
    const objectKey = buildAiBriefArtifactKey(scanContext.run, brief);

    await env.EDGE_ARTIFACTS.put(objectKey, brief.content, {
      httpMetadata: {
        contentType: "text/markdown; charset=utf-8",
      },
    });

    await insertArtifact(env, scanRunId, {
      id: artifactId,
      kind: "ai-brief",
      objectKey,
      contentType: "text/markdown; charset=utf-8",
      metadata: {
        generatedAt: brief.groundedInput.generatedAt,
        profile: brief.profile,
        route: brief.route,
        transport: brief.transport,
        provider: brief.provider,
        model: brief.model,
        attempts: brief.attempts,
        groundedFindingCount: brief.groundedInput.findings.length,
        groundedRecommendationCount: brief.groundedInput.recommendations.length,
        groundedArtifactCount: brief.groundedInput.artifacts.length,
      },
    });

    return jsonResponse(
      {
        artifact: {
          id: artifactId,
          kind: "ai-brief",
          objectKey,
        },
        brief: {
          profile: brief.profile,
          route: brief.route,
          transport: brief.transport,
          provider: brief.provider,
          model: brief.model,
          attempts: brief.attempts,
          groundedInput: {
            generatedAt: brief.groundedInput.generatedAt,
            findingCount: brief.groundedInput.findings.length,
            recommendationCount: brief.groundedInput.recommendations.length,
            artifactCount: brief.groundedInput.artifacts.length,
          },
          content: brief.content,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI brief generation failed.",
        inference: getInferenceCapabilities(env),
      },
      { status: 503 },
    );
  }
}

async function handleGetExport(request: Request, env: Env, exportId: string): Promise<Response> {
  const exportRecord = await getExportRecord(env, exportId);
  if (!exportRecord) return notFound("Export not found.");

  if (new URL(request.url).searchParams.get("download") === "1") {
    const objectKey = String(exportRecord.object_key);
    const object = await env.EDGE_ARTIFACTS.get(objectKey);
    if (!object) return notFound("Export artifact missing from storage.");

    return new Response(object.body, {
      headers: {
        "content-type": String(exportRecord.content_type),
        "content-disposition": `attachment; filename="${objectKey.split("/").pop()}"`,
      },
    });
  }

  return jsonResponse({
    ...exportRecord,
    payload: JSON.parse(String(exportRecord.payload_json)),
    downloadUrl: `/api/exports/${exportId}?download=1`,
  });
}

async function processScanMessage(env: Env, message: ScanQueueMessage): Promise<void> {
  const coordinator = coordinatorFor(env, message.jobId);
  await markRunStarted(env, message.scanRunId);
  await coordinator.markRunStatus({
    scanRunId: message.scanRunId,
    domain: message.domain,
    status: "processing",
  });

  try {
    const bundle = await performEdgeScan(message.domain);
    const runStatus = bundleHasModuleFailures(bundle)
      ? "completed_with_failures"
      : "completed";
    const moduleFailureSummary = summarizeModuleFailures(bundle);

    await storeRunBundle(
      env,
      message.scanRunId,
      bundle,
      runStatus,
      moduleFailureSummary,
    );
    await coordinator.markRunStatus({
      scanRunId: message.scanRunId,
      domain: message.domain,
      status: runStatus,
      finalUrl: bundle.http.finalUrl,
      error: moduleFailureSummary ?? undefined,
    });
    await recalculateJobStatus(env, message.jobId);

    await env.ARTIFACT_QUEUE.send({
      jobId: message.jobId,
      scanRunId: message.scanRunId,
      domain: message.domain,
      finalUrl: bundle.http.finalUrl,
      queuedAt: new Date().toISOString(),
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "An unknown scan failure occurred.";
    await markRunFailed(env, message.scanRunId, reason);
    await coordinator.markRunStatus({
      scanRunId: message.scanRunId,
      domain: message.domain,
      status: "failed",
      error: reason,
    });
    await recalculateJobStatus(env, message.jobId);
    throw error;
  }
}

async function processArtifactMessage(
  env: Env,
  message: ArtifactQueueMessage,
): Promise<void> {
  const artifacts = await generateArtifacts(
    env,
    message.scanRunId,
    message.domain,
    message.finalUrl,
  );
  if (artifacts.length === 0) {
    const fallbackArtifact = {
      id: crypto.randomUUID(),
      kind: "artifact-placeholder",
      objectKey: `artifacts/${message.domain}/${message.scanRunId}/placeholder.json`,
      contentType: "application/json; charset=utf-8",
      metadata: {
        reason: "Browser artifacts unavailable for this run.",
      },
    };
    await env.EDGE_ARTIFACTS.put(
      fallbackArtifact.objectKey,
      JSON.stringify(fallbackArtifact.metadata, null, 2),
      {
        httpMetadata: {
          contentType: fallbackArtifact.contentType,
        },
      },
    );
    await insertArtifact(env, message.scanRunId, fallbackArtifact);
  }
}

export { JobCoordinator, EdgeIntelScanWorkflow };

export default class EdgeIntelWorker extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    let operatorSession: OperatorSession | null = null;

    if (request.method === "GET" && path === "/health") {
      return jsonResponse({
        status: "ok",
        worker: "edgeintel-worker",
        timestamp: new Date().toISOString(),
      });
    }

    if (isOperatorControlPlaneRoute(request, path)) {
      const session = await requireOperatorSession(request, this.env);
      if (session instanceof Response) {
        return session;
      }
      operatorSession = session;
    }

    if (request.method === "GET" && (path === "/app" || path === "/app/providers")) {
      return handleProviderControlPlaneApp();
    }

    if (request.method === "GET" && path === "/app/tunnels") {
      return handleTunnelControlPlaneApp();
    }

    if (request.method === "GET" && path === "/api/session") {
      return handleGetSession(operatorSession as OperatorSession);
    }

    if (request.method === "GET" && path === "/api/zones") {
      return handleListZones(this.env);
    }

    if (request.method === "POST" && path === "/api/hostnames/validate") {
      return handleValidateHostname(request, this.env);
    }

    if (request.method === "POST" && path === "/api/scan") {
      return handleCreateScan(request, this.env);
    }

    if (request.method === "GET" && /^\/api\/jobs\/[^/]+$/.test(path)) {
      return handleGetJob(this.env, path.split("/")[3]);
    }

    if (request.method === "GET" && /^\/api\/jobs\/[^/]+\/events$/.test(path)) {
      const cursor = Number(url.searchParams.get("cursor") ?? "0");
      return streamJobEvents(this.env, path.split("/")[3], cursor);
    }

    if (request.method === "GET" && /^\/api\/scans\/[^/]+$/.test(path)) {
      return handleGetScan(this.env, path.split("/")[3]);
    }

    if (request.method === "POST" && /^\/api\/scans\/[^/]+\/ai-brief$/.test(path)) {
      return handleCreateAiBrief(request, this.env, path.split("/")[3]);
    }

    if (request.method === "GET" && path === "/api/settings/providers") {
      return handleListProviders(this.env);
    }

    if (request.method === "POST" && path === "/api/settings/providers") {
      return handleCreateProvider(request, this.env);
    }

    if (request.method === "GET" && /^\/api\/settings\/providers\/[^/]+$/.test(path)) {
      return handleGetProvider(this.env, path.split("/")[4]);
    }

    if (
      request.method === "PATCH" &&
      /^\/api\/settings\/providers\/[^/]+$/.test(path)
    ) {
      return handleUpdateProvider(request, this.env, path.split("/")[4]);
    }

    if (
      request.method === "DELETE" &&
      /^\/api\/settings\/providers\/[^/]+$/.test(path)
    ) {
      return handleDeleteProvider(this.env, path.split("/")[4]);
    }

    if (
      request.method === "POST" &&
      /^\/api\/settings\/providers\/[^/]+\/test$/.test(path)
    ) {
      return handleTestProvider(request, this.env, path.split("/")[4]);
    }

    if (request.method === "GET" && path === "/api/tunnels") {
      return handleListTunnels(this.env);
    }

    if (request.method === "POST" && path === "/api/tunnels") {
      return handleCreateTunnel(request, this.env);
    }

    if (request.method === "GET" && /^\/api\/tunnels\/[^/]+$/.test(path)) {
      return handleGetTunnel(this.env, path.split("/")[3]);
    }

    if (
      request.method === "PATCH" &&
      /^\/api\/tunnels\/[^/]+$/.test(path)
    ) {
      return handleUpdateTunnel(request, this.env, path.split("/")[3]);
    }

    if (
      request.method === "DELETE" &&
      /^\/api\/tunnels\/[^/]+$/.test(path)
    ) {
      return handleDeleteTunnel(this.env, path.split("/")[3]);
    }

    if (
      request.method === "POST" &&
      /^\/api\/tunnels\/[^/]+\/test$/.test(path)
    ) {
      return handleTestTunnel(request, this.env, path.split("/")[3]);
    }

    if (
      request.method === "GET" &&
      /^\/api\/tunnels\/[^/]+\/events$/.test(path)
    ) {
      return handleGetTunnelEvents(this.env, path.split("/")[3]);
    }

    if (
      request.method === "GET" &&
      /^\/api\/tunnels\/[^/]+\/observability$/.test(path)
    ) {
      return handleGetTunnelObservability(this.env, path.split("/")[3]);
    }

    if (
      request.method === "POST" &&
      /^\/api\/tunnels\/[^/]+\/rotate-token$/.test(path)
    ) {
      return handleRotateTunnelToken(this.env, path.split("/")[3]);
    }

    if (
      request.method === "POST" &&
      /^\/api\/tunnels\/[^/]+\/heartbeat$/.test(path)
    ) {
      return handleTunnelHeartbeat(request, this.env, path.split("/")[3]);
    }

    if (request.method === "POST" && path === "/api/pairings") {
      return handleCreatePairing(request, this.env, operatorSession as OperatorSession);
    }

    if (
      request.method === "POST" &&
      /^\/api\/pairings\/[^/]+\/exchange$/.test(path)
    ) {
      return handleExchangePairing(request, this.env, path.split("/")[3]);
    }

    if (request.method === "GET" && /^\/api\/domains\/[^/]+\/history$/.test(path)) {
      return handleDomainHistory(this.env, decodeURIComponent(path.split("/")[3]));
    }

    if (request.method === "GET" && /^\/api\/domains\/[^/]+\/latest$/.test(path)) {
      return handleLatestDomain(this.env, decodeURIComponent(path.split("/")[3]));
    }

    if (request.method === "POST" && /^\/api\/domains\/[^/]+\/rescan$/.test(path)) {
      return handleManualRescan(this.env, decodeURIComponent(path.split("/")[3]));
    }

    if (request.method === "POST" && /^\/api\/domains\/[^/]+\/watch$/.test(path)) {
      return handleUpsertDomainWatch(
        request,
        this.env,
        decodeURIComponent(path.split("/")[3]),
      );
    }

    if (request.method === "DELETE" && /^\/api\/domains\/[^/]+\/watch$/.test(path)) {
      return handleDeleteDomainWatch(
        this.env,
        decodeURIComponent(path.split("/")[3]),
      );
    }

    if (request.method === "POST" && /^\/api\/exports\/[^/]+$/.test(path)) {
      return handleCreateExport(request, this.env, path.split("/")[3]);
    }

    if (request.method === "GET" && /^\/api\/exports\/[^/]+$/.test(path)) {
      return handleGetExport(request, this.env, path.split("/")[3]);
    }

    if (request.method === "GET" && path === "/api/inference/capabilities") {
      return handleInferenceCapabilities(this.env);
    }

    if (
      path.startsWith("/api/") &&
      !["GET", "POST", "PATCH", "DELETE"].includes(request.method)
    ) {
      return methodNotAllowed();
    }

    return notFound();
  }

  async queue(
    batch: MessageBatch<ScanQueueMessage | ArtifactQueueMessage>,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (batch.queue === this.env.SCAN_QUEUE_NAME) {
          await processScanMessage(this.env, message.body as ScanQueueMessage);
        } else if (batch.queue === this.env.ARTIFACT_QUEUE_NAME) {
          await processArtifactMessage(
            this.env,
            message.body as ArtifactQueueMessage,
          );
        }
        message.ack();
      } catch (error) {
        console.error("Queue message failed", {
          queue: batch.queue,
          messageId: message.id,
          error,
        });
        message.retry();
      }
    }
  }

  async scheduled(): Promise<void> {
    const dueWatches = await listDueDomainWatches(this.env, new Date().toISOString());

    for (const watch of dueWatches) {
      await createScanJob(this.env, [watch.domain], [watch.domain]);
      await markDomainWatchEnqueued(this.env, watch.domain, watch.intervalHours);
    }
  }
}
