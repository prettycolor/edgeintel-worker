import type { Env } from "../env";
import type {
  AiBriefProfile,
  AiBriefRequestBody,
  InferenceCapability,
  InferenceRoute,
  InferenceTransport,
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
} from "../types";
import { nowIso, safeJsonParse, slugify, withRetry } from "./utils";

const MAX_GROUNDED_FINDINGS = 10;
const MAX_GROUNDED_RECOMMENDATIONS = 8;
const MAX_GROUNDED_ARTIFACTS = 8;

export interface AiBriefContext {
  run: PersistedScanRun;
  findings: Array<Record<string, unknown>>;
  artifacts: PersistedArtifact[];
  recommendations: PersistedRecommendation[];
}

export interface GroundedAiBriefInput {
  generatedAt: string;
  profile: AiBriefProfile;
  instruction: string | null;
  run: {
    scanRunId: string;
    domain: string;
    status: PersistedScanRun["status"];
    finalUrl: string | null;
    failureReason: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  summary: Record<string, unknown>;
  modules: Record<string, unknown>;
  findings: Array<{
    severity: string;
    code: string;
    title: string;
    detail: string;
  }>;
  recommendations: Array<{
    productCode: string;
    title: string;
    priority: string;
    confidence: number;
    phase: number;
    sequence: number;
    expectedImpact: string;
    prerequisites: string[];
    blockedBy: string[];
    executiveSummary: string;
    technicalSummary: string;
  }>;
  artifacts: Array<{
    kind: string;
    contentType: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface GeneratedAiBrief {
  route: InferenceRoute;
  transport: InferenceTransport;
  provider: string;
  model: string;
  profile: AiBriefProfile;
  content: string;
  attempts: number;
  groundedInput: GroundedAiBriefInput;
}

interface ResolvedInferenceTarget {
  route: InferenceRoute;
  transport: InferenceTransport;
  provider: string;
  model: string;
  endpoint: string;
  gatewayId?: string;
  gatewayToken?: string;
  upstreamApiKey?: string;
  accessClientId?: string;
  accessClientSecret?: string;
}

const VALID_ROUTES: InferenceRoute[] = ["hosted", "local-direct", "local-gateway"];
const VALID_PROFILES: AiBriefProfile[] = [
  "executive",
  "technical",
  "upgrade-planner",
];

function isInferenceRoute(value: string | undefined): value is InferenceRoute {
  return VALID_ROUTES.includes(value as InferenceRoute);
}

function isAiBriefProfile(value: string | undefined): value is AiBriefProfile {
  return VALID_PROFILES.includes(value as AiBriefProfile);
}

function compactHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

export function buildOpenAiCompatibleChatUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("Inference base URL is required.");
  }

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized;
  }

  if (/\/openai$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }

  if (normalized.includes("/v1/") || /\/v1$/i.test(normalized)) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

function requiresHttps(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS in deployed Worker environments.`);
  }
}

function isHttpsUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function extractTextFromModelResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Inference response was empty or invalid.");
  }

  const objectPayload = payload as Record<string, unknown>;

  if (typeof objectPayload.output_text === "string" && objectPayload.output_text.trim()) {
    return objectPayload.output_text.trim();
  }

  if (Array.isArray(objectPayload.choices) && objectPayload.choices.length > 0) {
    const firstChoice = objectPayload.choices[0] as Record<string, unknown>;
    const message = firstChoice.message as Record<string, unknown> | undefined;
    const content = message?.content ?? firstChoice.text;

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const candidate = (part as Record<string, unknown>).text;
          return typeof candidate === "string" ? candidate : "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();

      if (text) return text;
    }
  }

  if (typeof objectPayload.response === "string" && objectPayload.response.trim()) {
    return objectPayload.response.trim();
  }

  throw new Error("Inference response did not contain text content.");
}

function parseRecommendation(
  recommendation: PersistedRecommendation,
): GroundedAiBriefInput["recommendations"][number] {
  return {
    productCode: recommendation.productCode,
    title: recommendation.title,
    priority: recommendation.priority,
    confidence: recommendation.confidence,
    phase: recommendation.phase,
    sequence: recommendation.sequence,
    expectedImpact: recommendation.expectedImpact,
    prerequisites: safeJsonParse<string[]>(
      recommendation.prerequisitesJson,
      [],
    ).slice(0, 4),
    blockedBy: safeJsonParse<string[]>(recommendation.blockedByJson, []),
    executiveSummary: recommendation.executiveSummary,
    technicalSummary: recommendation.technicalSummary,
  };
}

export function buildGroundedAiBriefInput(
  context: AiBriefContext,
  options: {
    profile?: AiBriefProfile;
    instruction?: string;
  } = {},
): GroundedAiBriefInput {
  const parsedSummary = safeJsonParse<Record<string, unknown>>(
    context.run.scanSummaryJson,
    {},
  );
  const parsedBundle = safeJsonParse<Record<string, unknown>>(
    context.run.rawResultJson,
    {},
  );
  const modules =
    parsedBundle.modules && typeof parsedBundle.modules === "object"
      ? (parsedBundle.modules as Record<string, unknown>)
      : {};

  return {
    generatedAt: nowIso(),
    profile: options.profile ?? "executive",
    instruction: options.instruction?.trim() ? options.instruction.trim() : null,
    run: {
      scanRunId: context.run.id,
      domain: context.run.domain,
      status: context.run.status,
      finalUrl: context.run.finalUrl,
      failureReason: context.run.failureReason,
      createdAt: context.run.createdAt,
      completedAt: context.run.completedAt,
    },
    summary: parsedSummary,
    modules,
    findings: context.findings.slice(0, MAX_GROUNDED_FINDINGS).map((finding) => ({
      severity: String(finding.severity ?? "info"),
      code: String(finding.code ?? "UNKNOWN"),
      title: String(finding.title ?? "Untitled finding"),
      detail: String(finding.detail ?? "").slice(0, 400),
    })),
    recommendations: context.recommendations
      .slice(0, MAX_GROUNDED_RECOMMENDATIONS)
      .map(parseRecommendation),
    artifacts: context.artifacts.slice(0, MAX_GROUNDED_ARTIFACTS).map((artifact) => ({
      kind: artifact.kind,
      contentType: artifact.contentType,
      createdAt: artifact.createdAt,
      metadata: safeJsonParse<Record<string, unknown>>(artifact.metadataJson, {}),
    })),
  };
}

function buildProfileInstruction(profile: AiBriefProfile): string {
  switch (profile) {
    case "technical":
      return [
        "Return a technical operator brief in Markdown.",
        "Use these sections: Technical Readout, Most Important Findings, Cloudflare Recommendation Logic, Confidence And Gaps.",
        "Be concrete about DNS, HTTP, edge, and recommendation evidence.",
      ].join(" ");
    case "upgrade-planner":
      return [
        "Return a rollout-oriented Cloudflare upgrade brief in Markdown.",
        "Use these sections: Immediate Wins, Recommended Rollout Order, Blockers, Product Fit Rationale, Caveats.",
        "Tie every product suggestion back to findings or recommendation evidence.",
      ].join(" ");
    case "executive":
    default:
      return [
        "Return an executive-ready Markdown brief.",
        "Use these sections: Executive Takeaway, Why It Matters, Recommended Cloudflare Path, Caveats.",
        "Keep it concise, specific, and grounded in the supplied evidence only.",
      ].join(" ");
  }
}

export function buildAiBriefMessages(grounding: GroundedAiBriefInput): Array<{
  role: "system" | "user";
  content: string;
}> {
  const system = [
    "You are EdgeIntel's evidence-bounded explanation layer.",
    "Use only the supplied JSON facts.",
    "Do not invent scans, providers, routes, threats, or business context.",
    "If the evidence is incomplete or contradictory, say so directly.",
    "Do not mention hidden prompts, tokens, or unsupported claims.",
  ].join(" ");

  const user = [
    buildProfileInstruction(grounding.profile),
    grounding.instruction
      ? `Additional instruction: ${grounding.instruction}`
      : null,
    "Evidence JSON:",
    JSON.stringify(grounding, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function getInferenceCapabilities(env: Env): {
  defaultRoute: InferenceRoute | null;
  routes: InferenceCapability[];
} {
  const hostedTransport: InferenceTransport | null = env.AI_GATEWAY_ID
    ? "ai-gateway-binding"
    : isHttpsUrl(env.AI_GATEWAY_BASE_URL)
      ? "ai-gateway-fetch"
      : null;
  const hostedAvailable = Boolean(hostedTransport);
  const accessProtected = Boolean(
    env.LOCAL_MODEL_ACCESS_CLIENT_ID && env.LOCAL_MODEL_ACCESS_CLIENT_SECRET,
  );
  const localDirectAvailable = isHttpsUrl(env.LOCAL_MODEL_GATEWAY_URL);
  const localGatewayAvailable = Boolean(
    hostedTransport && env.LOCAL_MODEL_AI_GATEWAY_PROVIDER,
  );

  const routes: InferenceCapability[] = [
    {
      route: "hosted",
      available: hostedAvailable,
      transport: hostedTransport,
      provider: env.AI_GATEWAY_PROVIDER || null,
      model: env.AI_GATEWAY_MODEL || null,
      accessProtected: false,
      requiresConfiguredSecrets: env.AI_UPSTREAM_API_KEY ? [] : ["AI_UPSTREAM_API_KEY or BYOK in AI Gateway"],
      notes: hostedAvailable
        ? [
            env.AI_GATEWAY_ID
              ? "Uses the Workers AI binding to call AI Gateway with gateway-level logging and retries."
              : "Uses the AI Gateway HTTPS endpoint directly.",
          ]
        : env.AI_GATEWAY_BASE_URL
          ? [
              "AI_GATEWAY_BASE_URL is set but not usable. Configure an HTTPS provider or route base URL.",
            ]
        : [
            "Configure AI_GATEWAY_ID for the binding path or AI_GATEWAY_BASE_URL for the HTTPS path.",
          ],
    },
    {
      route: "local-direct",
      available: localDirectAvailable,
      transport: localDirectAvailable
        ? "direct-openai-compatible"
        : null,
      provider: "openai-compatible",
      model: env.LOCAL_MODEL_MODEL || null,
      accessProtected,
      requiresConfiguredSecrets: [
        "LOCAL_MODEL_GATEWAY_URL",
        ...(accessProtected ? [] : ["LOCAL_MODEL_ACCESS_CLIENT_ID/SECRET if Access protection is desired"]),
      ],
      notes: env.LOCAL_MODEL_GATEWAY_URL
        ? [
            localDirectAvailable
              ? "Assumes an HTTPS-accessible OpenAI-compatible endpoint such as Ollama behind Cloudflare Tunnel."
              : "LOCAL_MODEL_GATEWAY_URL is set but not HTTPS. Deployed Workers must use a Tunnel-backed or otherwise HTTPS-accessible endpoint.",
          ]
        : [
            "Expose the local model over HTTPS before enabling this route. Localhost is not reachable from deployed Workers.",
          ],
    },
    {
      route: "local-gateway",
      available: localGatewayAvailable,
      transport: localGatewayAvailable ? hostedTransport : null,
      provider: env.LOCAL_MODEL_AI_GATEWAY_PROVIDER || null,
      model: env.LOCAL_MODEL_MODEL || null,
      accessProtected,
      requiresConfiguredSecrets: [
        "LOCAL_MODEL_AI_GATEWAY_PROVIDER",
        ...(hostedTransport
          ? []
          : ["AI_GATEWAY_ID or AI_GATEWAY_BASE_URL"]),
      ],
      notes:
        localGatewayAvailable
          ? [
              "Targets a self-hosted model through AI Gateway, typically via a custom provider or routed OpenAI-compatible upstream.",
            ]
          : [
              "Configure a local-model provider inside AI Gateway before using this route.",
            ],
    },
  ];

  const configuredDefault = isInferenceRoute(env.AI_INFERENCE_DEFAULT_ROUTE)
    ? env.AI_INFERENCE_DEFAULT_ROUTE
    : undefined;
  const firstAvailable = routes.find((route) => route.available)?.route ?? null;
  const defaultRoute =
    configuredDefault &&
    routes.some((route) => route.route === configuredDefault && route.available)
      ? configuredDefault
      : firstAvailable;

  return { defaultRoute, routes };
}

function resolveInferenceTarget(
  env: Env,
  request: AiBriefRequestBody,
): ResolvedInferenceTarget {
  const { defaultRoute } = getInferenceCapabilities(env);
  const route = request.route ?? defaultRoute;

  if (!route) {
    throw new Error(
      "No inference route is configured. Set AI Gateway or local-model environment variables first.",
    );
  }

  if (route === "hosted") {
    if (env.AI_GATEWAY_ID) {
      return {
        route,
        transport: "ai-gateway-binding",
        provider: request.provider || env.AI_GATEWAY_PROVIDER,
        model: request.model || env.AI_GATEWAY_MODEL,
        endpoint: "chat/completions",
        gatewayId: env.AI_GATEWAY_ID,
        upstreamApiKey: env.AI_UPSTREAM_API_KEY,
      };
    }

    if (env.AI_GATEWAY_BASE_URL) {
      requiresHttps(env.AI_GATEWAY_BASE_URL, "AI_GATEWAY_BASE_URL");
      return {
        route,
        transport: "ai-gateway-fetch",
        provider: request.provider || env.AI_GATEWAY_PROVIDER,
        model: request.model || env.AI_GATEWAY_MODEL,
        endpoint: buildOpenAiCompatibleChatUrl(env.AI_GATEWAY_BASE_URL),
        gatewayToken: env.AI_GATEWAY_TOKEN,
        upstreamApiKey: env.AI_UPSTREAM_API_KEY,
      };
    }
  }

  if (route === "local-direct") {
    if (!env.LOCAL_MODEL_GATEWAY_URL) {
      throw new Error(
        "LOCAL_MODEL_GATEWAY_URL is required for the local-direct route.",
      );
    }
    requiresHttps(env.LOCAL_MODEL_GATEWAY_URL, "LOCAL_MODEL_GATEWAY_URL");
    return {
      route,
      transport: "direct-openai-compatible",
      provider: request.provider || "openai-compatible",
      model: request.model || env.LOCAL_MODEL_MODEL || "gemma3:12b",
      endpoint: buildOpenAiCompatibleChatUrl(env.LOCAL_MODEL_GATEWAY_URL),
      upstreamApiKey: env.LOCAL_MODEL_API_KEY || "ollama",
      accessClientId: env.LOCAL_MODEL_ACCESS_CLIENT_ID,
      accessClientSecret: env.LOCAL_MODEL_ACCESS_CLIENT_SECRET,
    };
  }

  if (route === "local-gateway") {
    if (!env.LOCAL_MODEL_AI_GATEWAY_PROVIDER) {
      throw new Error(
        "LOCAL_MODEL_AI_GATEWAY_PROVIDER is required for the local-gateway route.",
      );
    }

    if (env.AI_GATEWAY_ID) {
      return {
        route,
        transport: "ai-gateway-binding",
        provider: request.provider || env.LOCAL_MODEL_AI_GATEWAY_PROVIDER,
        model: request.model || env.LOCAL_MODEL_MODEL || env.AI_GATEWAY_MODEL,
        endpoint: "chat/completions",
        gatewayId: env.AI_GATEWAY_ID,
        upstreamApiKey: env.LOCAL_MODEL_API_KEY || env.AI_UPSTREAM_API_KEY,
      };
    }

    if (env.AI_GATEWAY_BASE_URL) {
      requiresHttps(env.AI_GATEWAY_BASE_URL, "AI_GATEWAY_BASE_URL");
      return {
        route,
        transport: "ai-gateway-fetch",
        provider: request.provider || env.LOCAL_MODEL_AI_GATEWAY_PROVIDER,
        model: request.model || env.LOCAL_MODEL_MODEL || env.AI_GATEWAY_MODEL,
        endpoint: buildOpenAiCompatibleChatUrl(env.AI_GATEWAY_BASE_URL),
        gatewayToken: env.AI_GATEWAY_TOKEN,
        upstreamApiKey: env.LOCAL_MODEL_API_KEY || env.AI_UPSTREAM_API_KEY,
      };
    }
  }

  throw new Error(`Inference route ${route} is not fully configured.`);
}

function buildChatCompletionPayload(
  target: ResolvedInferenceTarget,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  return {
    model: target.model,
    messages,
    temperature: 0.2,
  };
}

async function parseModelResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Inference request failed with status ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Inference response was not valid JSON.");
  }
}

async function executeGatewayBinding(
  env: Env,
  target: ResolvedInferenceTarget,
  messages: Array<{ role: "system" | "user"; content: string }>,
  metadata: Record<string, string>,
): Promise<string> {
  if (!target.gatewayId) {
    throw new Error("AI Gateway binding route requires AI_GATEWAY_ID.");
  }

  const response = await env.AI.gateway(target.gatewayId).run(
    {
      provider: target.provider,
      endpoint: target.endpoint,
      headers: compactHeaders({
        Authorization: target.upstreamApiKey
          ? `Bearer ${target.upstreamApiKey}`
          : undefined,
        "Content-Type": "application/json",
      }),
      query: buildChatCompletionPayload(target, messages),
    },
    {
      gateway: {
        id: target.gatewayId,
        collectLog: true,
        metadata,
        retries: {
          maxAttempts: 2,
          retryDelayMs: 250,
          backoff: "exponential",
        },
      },
    },
  );

  return extractTextFromModelResponse(await parseModelResponse(response));
}

async function executeFetchInference(
  target: ResolvedInferenceTarget,
  messages: Array<{ role: "system" | "user"; content: string }>,
  metadata: Record<string, string>,
): Promise<string> {
  const headers = compactHeaders({
    "content-type": "application/json",
    Authorization: target.upstreamApiKey
      ? `Bearer ${target.upstreamApiKey}`
      : undefined,
    "cf-aig-authorization": target.gatewayToken
      ? `Bearer ${target.gatewayToken}`
      : undefined,
    "cf-aig-metadata":
      target.transport === "ai-gateway-fetch" ? JSON.stringify(metadata) : undefined,
    "CF-Access-Client-Id": target.accessClientId,
    "CF-Access-Client-Secret": target.accessClientSecret,
  });

  const response = await fetch(target.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildChatCompletionPayload(target, messages)),
  });

  return extractTextFromModelResponse(await parseModelResponse(response));
}

export async function generateAiBrief(
  env: Env,
  context: AiBriefContext,
  request: AiBriefRequestBody = {},
): Promise<GeneratedAiBrief> {
  const profile = isAiBriefProfile(request.profile) ? request.profile : "executive";
  const grounding = buildGroundedAiBriefInput(context, {
    profile,
    instruction: request.instruction,
  });
  const messages = buildAiBriefMessages(grounding);
  const target = resolveInferenceTarget(env, request);
  const metadata = {
    route: target.route,
    profile,
    domain: context.run.domain,
    scanRunId: context.run.id,
  };

  const { value: content, attempts } = await withRetry(
    async () => {
      switch (target.transport) {
        case "ai-gateway-binding":
          return executeGatewayBinding(env, target, messages, metadata);
        case "ai-gateway-fetch":
        case "direct-openai-compatible":
          return executeFetchInference(target, messages, metadata);
      }
    },
    {
      attempts: 2,
      delayMs: 300,
    },
  );

  return {
    route: target.route,
    transport: target.transport,
    provider: target.provider,
    model: target.model,
    profile,
    content,
    attempts,
    groundedInput: grounding,
  };
}

export function buildAiBriefArtifactKey(
  run: PersistedScanRun,
  brief: Pick<GeneratedAiBrief, "profile" | "route">,
): string {
  return [
    "artifacts",
    run.domain,
    run.id,
    `ai-brief-${slugify(brief.profile)}-${slugify(brief.route)}-${Date.now()}.md`,
  ].join("/");
}
