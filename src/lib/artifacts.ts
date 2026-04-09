import type { Env } from "../env";
import type { ArtifactDescriptor } from "../types";
import { insertArtifact } from "./repository";
import { nowIso, slugify } from "./utils";

async function putTextArtifact(
  env: Env,
  scanRunId: string,
  domain: string,
  kind: string,
  contentType: string,
  body: string,
  metadata: Record<string, unknown>,
): Promise<ArtifactDescriptor> {
  const objectKey = `artifacts/${slugify(domain)}/${scanRunId}/${kind}-${Date.now()}.txt`;
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
    metadata,
  };
  await insertArtifact(env, scanRunId, artifact);
  return artifact;
}

async function fetchBrowserRenderingMarkdown(
  env: Env,
  url: string,
): Promise<string | null> {
  if (!env.BROWSER_RENDERING_REST_BASE_URL || !env.BROWSER_RENDERING_API_TOKEN) {
    return null;
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
  );

  if (!response.ok) return null;
  return response.text();
}

async function fetchBrowserRenderingScreenshot(
  env: Env,
  url: string,
): Promise<ArrayBuffer | null> {
  if (!env.BROWSER_RENDERING_REST_BASE_URL || !env.BROWSER_RENDERING_API_TOKEN) {
    return null;
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
  );

  if (!response.ok) return null;
  return response.arrayBuffer();
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
  const objectKey = `artifacts/${slugify(domain)}/${scanRunId}/${kind}-${Date.now()}.png`;
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
    metadata,
  };
  await insertArtifact(env, scanRunId, artifact);
  return artifact;
}

export async function generateArtifacts(
  env: Env,
  scanRunId: string,
  domain: string,
  finalUrl: string | null,
): Promise<ArtifactDescriptor[]> {
  const artifacts: ArtifactDescriptor[] = [];
  const targetUrl = finalUrl ?? `https://${domain}`;

  const pageResponse = await fetch(targetUrl, {
    headers: {
      "user-agent": "EdgeIntel/0.1 artifact collector",
    },
  }).catch(() => null);

  if (pageResponse?.ok) {
    const html = await pageResponse.text();
    artifacts.push(
      await putTextArtifact(
        env,
        scanRunId,
        domain,
        "raw-html",
        "text/html; charset=utf-8",
        html,
        {
          targetUrl,
          capturedAt: nowIso(),
        },
      ),
    );
  }

  const renderedMarkdown = await fetchBrowserRenderingMarkdown(env, targetUrl);
  if (renderedMarkdown) {
    artifacts.push(
      await putTextArtifact(
        env,
        scanRunId,
        domain,
        "rendered-markdown",
        "text/markdown; charset=utf-8",
        renderedMarkdown,
        {
          targetUrl,
          capturedAt: nowIso(),
          source: "browser-rendering",
        },
      ),
    );
  }

  const screenshot = await fetchBrowserRenderingScreenshot(env, targetUrl);
  if (screenshot) {
    artifacts.push(
      await putBinaryArtifact(
        env,
        scanRunId,
        domain,
        "screenshot",
        "image/png",
        screenshot,
        {
          targetUrl,
          capturedAt: nowIso(),
          source: "browser-rendering",
        },
      ),
    );
  }

  return artifacts;
}
