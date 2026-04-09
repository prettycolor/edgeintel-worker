import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { JobCoordinator } from "./durable-objects/job-coordinator";
import {
  createExportRecord,
  createJob,
  createScanRuns,
  deleteDomainWatch,
  getArtifactsForRun,
  getDomainWatch,
  getExportRecord,
  getFindingsForRun,
  getJob,
  getLatestRunForDomain,
  getRecommendationsForRun,
  getRunsForJob,
  getScanContext,
  getScanRun,
  insertArtifact,
  listDueDomainWatches,
  listDomainHistory,
  markRunFailed,
  markDomainWatchEnqueued,
  markRunStarted,
  recalculateJobStatus,
  storeRunBundle,
  attachWorkflowInstance,
  upsertDomainWatch,
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
import type {
  AiBriefRequestBody,
  ArtifactQueueMessage,
  DomainWatchRequestBody,
  ExportFormat,
  ScanQueueMessage,
  ScanRequestBody,
  ScanWorkflowParams,
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

    if (request.method === "GET" && path === "/health") {
      return jsonResponse({
        status: "ok",
        worker: "edgeintel-worker",
        timestamp: new Date().toISOString(),
      });
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
      !["GET", "POST"].includes(request.method)
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
