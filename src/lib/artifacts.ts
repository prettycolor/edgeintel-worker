import type { Env } from "../env";
import type { ArtifactDescriptor } from "../types";
import { insertArtifact } from "./repository";
import { nowIso, slugify } from "./utils";

type ArtifactCaptureStatus = "captured" | "skipped" | "failed";

interface ArtifactCaptureAttempt {
  kind: string;
  status: ArtifactCaptureStatus;
  source: "direct-fetch" | "browser-rendering-rest" | "edgeintel";
  targetUrl: string;
  capturedAt: string;
  contentType?: string;
  byteLength?: number;
  httpStatus?: number;
  reason?: string;
  objectKey?: string;
}

interface BrowserCaptureResult<T> {
  ok: boolean;
  data: T | null;
  httpStatus?: number;
  error?: string;
  skipped?: boolean;
}

function artifactExtension(contentType: string, fallback: string): string {
  if (contentType.includes("text/html")) return "html";
  if (contentType.includes("text/markdown")) return "md";
  if (contentType.includes("application/json")) return "json";
  if (contentType.includes("image/png")) return "png";
  if (contentType.includes("image/jpeg")) return "jpg";
  return fallback;
}

function buildObjectKey(
  domain: string,
  scanRunId: string,
  kind: string,
  contentType: string,
  fallbackExtension: string,
): string {
  return `artifacts/${slugify(domain)}/${scanRunId}/${kind}-${Date.now()}.${artifactExtension(
    contentType,
    fallbackExtension,
  )}`;
}

function textByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}

async function putTextArtifact(
  env: Env,
  scanRunId: string,
  domain: string,
  kind: string,
  contentType: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<ArtifactDescriptor> {
  const byteLength = textByteLength(body);
  const objectKey = buildObjectKey(
    domain,
    scanRunId,
    kind,
    contentType,
    "txt",
  );

  await env.EDGE_ARTIFACTS.put(objectKey, body, {
    httpMetadata: {
      contentType,
    },
  });

  const artifact: ArtifactDescriptor = {
    id: crypto.randomUUID(),
    kind,
    objectKey,
    contentType,
    metadata: {
      ...metadata,
      byteLength,
    },
  };
  await insertArtifact(env, scanRunId, artifact);
  return artifact;
}

async function putBinaryArtifact(
  env: Env,
  scanRunId: string,
  domain: string,
  kind: string,
  contentType: string,
  body: ArrayBuffer,
  metadata: Record<string, unknown>,
): Promise<ArtifactDescriptor> {
  const objectKey = buildObjectKey(
    domain,
    scanRunId,
    kind,
    contentType,
    "bin",
  );

  await env.EDGE_ARTIFACTS.put(objectKey, body, {
    httpMetadata: {
      contentType,
    },
  });

  const artifact: ArtifactDescriptor = {
    id: crypto.randomUUID(),
    kind,
    objectKey,
    contentType,
    metadata: {
      ...metadata,
      byteLength: body.byteLength,
    },
  };
  await insertArtifact(env, scanRunId, artifact);
  return artifact;
}

function browserRenderingConfigured(env: Env): boolean {
  return Boolean(
    env.BROWSER_RENDERING_REST_BASE_URL && env.BROWSER_RENDERING_API_TOKEN,
  );
}

async function fetchBrowserRenderingMarkdown(
  env: Env,
  url: string,
): Promise<BrowserCaptureResult<string>> {
  if (!browserRenderingConfigured(env)) {
    return {
      ok: false,
      data: null,
      skipped: true,
      error: "Browser Rendering REST is not configured for this environment.",
    };
  }

  const response = await fetch(
    `${env.BROWSER_RENDERING_REST_BASE_URL.replace(/\/$/, "")}/markdown`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ url }),
    },
  ).catch((error) => ({
    ok: false,
    status: 0,
    error: error instanceof Error ? error.message : "Browser markdown capture failed",
  }));

  if (!(response instanceof Response)) {
    return {
      ok: false,
      data: null,
      error: response.error,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      data: null,
      httpStatus: response.status,
      error: `Browser markdown capture returned status ${response.status}.`,
    };
  }

  return {
    ok: true,
    data: await response.text(),
    httpStatus: response.status,
  };
}

async function fetchBrowserRenderingScreenshot(
  env: Env,
  url: string,
): Promise<BrowserCaptureResult<ArrayBuffer>> {
  if (!browserRenderingConfigured(env)) {
    return {
      ok: false,
      data: null,
      skipped: true,
      error: "Browser Rendering REST is not configured for this environment.",
    };
  }

  const response = await fetch(
    `${env.BROWSER_RENDERING_REST_BASE_URL.replace(/\/$/, "")}/screenshot`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url,
        screenshotOptions: {
          type: "png",
          fullPage: true,
        },
      }),
    },
  ).catch((error) => ({
    ok: false,
    status: 0,
    error:
      error instanceof Error ? error.message : "Browser screenshot capture failed",
  }));

  if (!(response instanceof Response)) {
    return {
      ok: false,
      data: null,
      error: response.error,
      httpStatus: response.status,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      data: null,
      httpStatus: response.status,
      error: `Browser screenshot capture returned status ${response.status}.`,
    };
  }

  return {
    ok: true,
    data: await response.arrayBuffer(),
    httpStatus: response.status,
  };
}

function noteArtifactAttempt(
  attempts: ArtifactCaptureAttempt[],
  attempt: ArtifactCaptureAttempt,
): void {
  attempts.push(attempt);
}

export async function generateArtifacts(
  env: Env,
  scanRunId: string,
  domain: string,
  finalUrl: string | null,
): Promise<ArtifactDescriptor[]> {
  const artifacts: ArtifactDescriptor[] = [];
  const attempts: ArtifactCaptureAttempt[] = [];
  const targetUrl = finalUrl ?? `https://${domain}`;

  const pageResponse = await fetch(targetUrl, {
    headers: {
      "user-agent": "EdgeIntel/0.1 artifact collector",
    },
  }).catch((error) => {
    noteArtifactAttempt(attempts, {
      kind: "response-metadata",
      status: "failed",
      source: "direct-fetch",
      targetUrl,
      capturedAt: nowIso(),
      reason: error instanceof Error ? error.message : "Direct fetch failed.",
    });
    return null;
  });

  if (pageResponse) {
    const capturedAt = nowIso();
    const responseHeaders: Record<string, string> = {};
    pageResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    const responseMetadata = {
      targetUrl,
      fetchedUrl: pageResponse.url || targetUrl,
      status: pageResponse.status,
      ok: pageResponse.ok,
      contentType: pageResponse.headers.get("content-type"),
      contentLength: Number(pageResponse.headers.get("content-length")) || null,
      headers: responseHeaders,
      capturedAt,
    };

    const metadataArtifact = await putTextArtifact(
      env,
      scanRunId,
      domain,
      "response-metadata",
      "application/json; charset=utf-8",
      JSON.stringify(responseMetadata, null, 2),
      {
        targetUrl,
        capturedAt,
        source: "direct-fetch",
        status: pageResponse.status,
      },
    );
    artifacts.push(metadataArtifact);
    noteArtifactAttempt(attempts, {
      kind: "response-metadata",
      status: "captured",
      source: "direct-fetch",
      targetUrl,
      capturedAt,
      contentType: metadataArtifact.contentType,
      byteLength: Number(metadataArtifact.metadata.byteLength ?? 0),
      httpStatus: pageResponse.status,
      objectKey: metadataArtifact.objectKey,
    });

    const contentType = pageResponse.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const html = await pageResponse.text().catch(() => null);
      if (html) {
        const htmlArtifact = await putTextArtifact(
          env,
          scanRunId,
          domain,
          "raw-html",
          "text/html; charset=utf-8",
          html,
          {
            targetUrl,
            capturedAt: nowIso(),
            source: "direct-fetch",
            status: pageResponse.status,
          },
        );
        artifacts.push(htmlArtifact);
        noteArtifactAttempt(attempts, {
          kind: "raw-html",
          status: "captured",
          source: "direct-fetch",
          targetUrl,
          capturedAt: String(htmlArtifact.metadata.capturedAt),
          contentType: htmlArtifact.contentType,
          byteLength: Number(htmlArtifact.metadata.byteLength ?? 0),
          httpStatus: pageResponse.status,
          objectKey: htmlArtifact.objectKey,
        });
      } else {
        noteArtifactAttempt(attempts, {
          kind: "raw-html",
          status: "failed",
          source: "direct-fetch",
          targetUrl,
          capturedAt: nowIso(),
          httpStatus: pageResponse.status,
          reason: "HTML response body could not be read.",
        });
      }
    } else {
      noteArtifactAttempt(attempts, {
        kind: "raw-html",
        status: "skipped",
        source: "direct-fetch",
        targetUrl,
        capturedAt: nowIso(),
        httpStatus: pageResponse.status,
        reason: `Primary response content-type was ${contentType || "unknown"}, so raw HTML capture was skipped.`,
      });
    }
  }

  const markdownResult = await fetchBrowserRenderingMarkdown(env, targetUrl);
  if (markdownResult.ok && markdownResult.data) {
    const markdownArtifact = await putTextArtifact(
      env,
      scanRunId,
      domain,
      "rendered-markdown",
      "text/markdown; charset=utf-8",
      markdownResult.data,
      {
        targetUrl,
        capturedAt: nowIso(),
        source: "browser-rendering-rest",
        status: markdownResult.httpStatus ?? null,
      },
    );
    artifacts.push(markdownArtifact);
    noteArtifactAttempt(attempts, {
      kind: "rendered-markdown",
      status: "captured",
      source: "browser-rendering-rest",
      targetUrl,
      capturedAt: String(markdownArtifact.metadata.capturedAt),
      contentType: markdownArtifact.contentType,
      byteLength: Number(markdownArtifact.metadata.byteLength ?? 0),
      httpStatus: markdownResult.httpStatus,
      objectKey: markdownArtifact.objectKey,
    });
  } else {
    noteArtifactAttempt(attempts, {
      kind: "rendered-markdown",
      status: markdownResult.skipped ? "skipped" : "failed",
      source: "browser-rendering-rest",
      targetUrl,
      capturedAt: nowIso(),
      httpStatus: markdownResult.httpStatus,
      reason: markdownResult.error,
    });
  }

  const screenshotResult = await fetchBrowserRenderingScreenshot(env, targetUrl);
  if (screenshotResult.ok && screenshotResult.data) {
    const screenshotArtifact = await putBinaryArtifact(
      env,
      scanRunId,
      domain,
      "screenshot",
      "image/png",
      screenshotResult.data,
      {
        targetUrl,
        capturedAt: nowIso(),
        source: "browser-rendering-rest",
        status: screenshotResult.httpStatus ?? null,
      },
    );
    artifacts.push(screenshotArtifact);
    noteArtifactAttempt(attempts, {
      kind: "screenshot",
      status: "captured",
      source: "browser-rendering-rest",
      targetUrl,
      capturedAt: String(screenshotArtifact.metadata.capturedAt),
      contentType: screenshotArtifact.contentType,
      byteLength: Number(screenshotArtifact.metadata.byteLength ?? 0),
      httpStatus: screenshotResult.httpStatus,
      objectKey: screenshotArtifact.objectKey,
    });
  } else {
    noteArtifactAttempt(attempts, {
      kind: "screenshot",
      status: screenshotResult.skipped ? "skipped" : "failed",
      source: "browser-rendering-rest",
      targetUrl,
      capturedAt: nowIso(),
      httpStatus: screenshotResult.httpStatus,
      reason: screenshotResult.error,
    });
  }

  const manifestArtifact = await putTextArtifact(
    env,
    scanRunId,
    domain,
    "artifact-manifest",
    "application/json; charset=utf-8",
    JSON.stringify(
      {
        domain,
        scanRunId,
        targetUrl,
        generatedAt: nowIso(),
        attempts,
      },
      null,
      2,
    ),
    {
      targetUrl,
      capturedAt: nowIso(),
      source: "edgeintel",
      attemptCount: attempts.length,
      capturedCount: attempts.filter((attempt) => attempt.status === "captured")
        .length,
      skippedCount: attempts.filter((attempt) => attempt.status === "skipped")
        .length,
      failedCount: attempts.filter((attempt) => attempt.status === "failed").length,
    },
  );
  artifacts.push(manifestArtifact);

  return artifacts;
}
