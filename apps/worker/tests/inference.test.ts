import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import {
  buildGroundedAiBriefInput,
  buildOpenAiCompatibleChatUrl,
  extractTextFromModelResponse,
  generateAiBrief,
  getInferenceCapabilities,
} from "../src/lib/inference";
import type {
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
} from "../src/types";

const run: PersistedScanRun = {
  id: "run-1",
  jobId: "job-1",
  domain: "example.com",
  status: "completed",
  sourceUrl: "https://example.com",
  finalUrl: "https://example.com/login",
  scanSummaryJson: JSON.stringify({
    dnsProvider: { provider: "Cloudflare" },
    edgeProvider: { provider: "Cloudflare" },
    authSurfaceDetected: true,
  }),
  rawResultJson: JSON.stringify({
    modules: {
      dns: { ok: true, durationMs: 20 },
      http: { ok: true, durationMs: 45 },
    },
  }),
  failureReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

const recommendations: PersistedRecommendation[] = [
  {
    id: "rec-1",
    scanRunId: "run-1",
    productCode: "WAF",
    title: "Adopt Cloudflare WAF",
    rationale: "The edge should enforce auth-aware controls.",
    priority: "high",
    confidence: 87,
    phase: 1,
    sequence: 20,
    blockedByJson: JSON.stringify(["cloudflare_proxy_adoption"]),
    evidenceJson: JSON.stringify(["AUTH_SURFACE_DETECTED"]),
    expectedImpact: "Reduce edge exposure.",
    technicalSummary: "Enable managed rules then auth route expressions.",
    executiveSummary: "Fastest path to stronger edge controls.",
    prerequisitesJson: JSON.stringify(["Proxy the hostname through Cloudflare."]),
    exportJson: JSON.stringify({ product: "waf" }),
    createdAt: new Date().toISOString(),
  },
];

const artifacts: PersistedArtifact[] = [
  {
    id: "artifact-1",
    scanRunId: "run-1",
    kind: "artifact-manifest",
    objectKey: "artifacts/example.com/run-1/artifact-manifest.json",
    contentType: "application/json; charset=utf-8",
    metadataJson: JSON.stringify({
      generatedAt: new Date().toISOString(),
      captures: [{ kind: "screenshot", status: "skipped" }],
    }),
    createdAt: new Date().toISOString(),
  },
];

const context = {
  run,
  findings: [
    {
      severity: "high",
      code: "AUTH_SURFACE_DETECTED",
      title: "Authentication flow detected",
      detail: "Login and password reset paths were visible.",
    },
  ],
  artifacts,
  recommendations,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("inference helpers", () => {
  it("normalizes OpenAI-compatible endpoints for gateway and local providers", () => {
    expect(buildOpenAiCompatibleChatUrl("https://gateway.example.com/v1/acct/gw/openai")).toBe(
      "https://gateway.example.com/v1/acct/gw/openai/chat/completions",
    );
    expect(buildOpenAiCompatibleChatUrl("https://ollama.example.com")).toBe(
      "https://ollama.example.com/v1/chat/completions",
    );
    expect(
      buildOpenAiCompatibleChatUrl("https://ollama.example.com/v1/chat/completions"),
    ).toBe("https://ollama.example.com/v1/chat/completions");
  });

  it("surfaces hosted and local inference capabilities with a valid default route", () => {
    const env = {
      AI_GATEWAY_ID: "gw_123",
      AI_GATEWAY_BASE_URL: "",
      AI_GATEWAY_PROVIDER: "anthropic",
      AI_GATEWAY_MODEL: "claude-sonnet-4-20250514",
      AI_INFERENCE_DEFAULT_ROUTE: "hosted",
      LOCAL_MODEL_GATEWAY_URL: "https://ollama.example.com",
      LOCAL_MODEL_MODEL: "gemma3:12b",
      LOCAL_MODEL_ACCESS_CLIENT_ID: "access-id",
      LOCAL_MODEL_ACCESS_CLIENT_SECRET: "access-secret",
      LOCAL_MODEL_AI_GATEWAY_PROVIDER: "ollama-local",
    } as Env;

    const capabilities = getInferenceCapabilities(env);

    expect(capabilities.defaultRoute).toBe("hosted");
    expect(capabilities.routes.find((route) => route.route === "hosted")?.available).toBe(
      true,
    );
    expect(
      capabilities.routes.find((route) => route.route === "local-direct")
        ?.accessProtected,
    ).toBe(true);
    expect(
      capabilities.routes.find((route) => route.route === "local-gateway")
        ?.available,
    ).toBe(true);
  });

  it("builds bounded grounding input from persisted findings and recommendations", () => {
    const grounding = buildGroundedAiBriefInput(context, {
      profile: "upgrade-planner",
      instruction: "Prioritize the fastest wow-factor improvements.",
    });

    expect(grounding.profile).toBe("upgrade-planner");
    expect(grounding.findings[0]?.code).toBe("AUTH_SURFACE_DETECTED");
    expect(grounding.recommendations[0]?.blockedBy).toContain(
      "cloudflare_proxy_adoption",
    );
    expect(grounding.artifacts[0]?.kind).toBe("artifact-manifest");
    expect(JSON.stringify(grounding)).not.toContain("raw-html");
  });

  it("extracts text from OpenAI-compatible responses", () => {
    expect(
      extractTextFromModelResponse({
        choices: [{ message: { content: "Executive summary." } }],
      }),
    ).toBe("Executive summary.");

    expect(
      extractTextFromModelResponse({
        choices: [
          {
            message: {
              content: [{ type: "text", text: "Technical" }, { text: "brief." }],
            },
          },
        ],
      }),
    ).toBe("Technical\nbrief.");
  });

  it("generates a local-model AI brief through an HTTPS OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "## Executive Takeaway\nUse WAF first." } }],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      AI_GATEWAY_ID: "",
      AI_GATEWAY_BASE_URL: "",
      AI_GATEWAY_PROVIDER: "workers-ai",
      AI_GATEWAY_MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      AI_INFERENCE_DEFAULT_ROUTE: "local-direct",
      LOCAL_MODEL_GATEWAY_URL: "https://ollama.example.com",
      LOCAL_MODEL_MODEL: "gemma3:12b",
      LOCAL_MODEL_API_KEY: "ollama-demo",
      LOCAL_MODEL_ACCESS_CLIENT_ID: "access-id",
      LOCAL_MODEL_ACCESS_CLIENT_SECRET: "access-secret",
    } as Env;

    const brief = await generateAiBrief(env, context, {
      route: "local-direct",
      profile: "executive",
    });

    expect(brief.route).toBe("local-direct");
    expect(brief.transport).toBe("direct-openai-compatible");
    expect(brief.model).toBe("gemma3:12b");
    expect(brief.content).toContain("Executive Takeaway");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    const init = (call?.[1] ?? {}) as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ollama-demo");
    expect(headers["CF-Access-Client-Id"]).toBe("access-id");
    expect(headers["CF-Access-Client-Secret"]).toBe("access-secret");
  });
});
