import type { Env } from "../env";
import type {
  PersistedProviderSetting,
  ProviderAuthStrategy,
  ProviderCapabilityAuthOption,
  ProviderCapabilityView,
  ProviderConnectionTestResult,
  ProviderSecretField,
  ProviderSecretHealthView,
  ProviderSecretPayload,
  ProviderSettingView,
  ProviderSettingsRequestBody,
  ProviderStatus,
  ProviderTestRequestBody,
} from "../types";
import { nowIso, safeJsonParse } from "./utils";

const VALID_PROVIDER_STATUSES: ProviderStatus[] = [
  "draft",
  "ready",
  "error",
  "disabled",
];

const VALID_PROVIDER_KINDS = [
  "hosted-api-key",
  "hosted-oauth",
  "local-direct",
  "local-gateway",
] as const;

const VALID_PROVIDER_AUTH_STRATEGIES = [
  "api-key",
  "oauth",
  "workers-binding",
  "none",
] as const;

const CATALOG: ProviderCapabilityView[] = [
  {
    providerCode: "openai",
    title: "OpenAI",
    category: "frontier",
    description: "Hosted OpenAI route using the standard HTTPS API surface.",
    supportedKinds: ["hosted-api-key"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-5.x / gpt-4.x family",
    supportsAiGateway: true,
    authOptions: [
      {
        strategy: "api-key",
        label: "API key",
        description: "Recommended production path for OpenAI routes in EdgeIntel.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: [],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "openai-compatible-models",
      summary: "Model inventory request against the OpenAI-compatible endpoint.",
      billable: false,
    },
    notes: [
      "OAuth is not exposed here because EdgeIntel treats OpenAI as an operator-managed API-key route.",
      "AI Gateway can sit in front of this provider without changing the operator workflow.",
    ],
  },
  {
    providerCode: "anthropic",
    title: "Anthropic",
    category: "frontier",
    description: "Hosted Anthropic route using the Messages API.",
    supportedKinds: ["hosted-api-key"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: "https://api.anthropic.com",
    modelPlaceholder: "claude-* model family",
    supportsAiGateway: true,
    authOptions: [
      {
        strategy: "api-key",
        label: "API key",
        description: "Recommended production path for Anthropic routes in EdgeIntel.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: [],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "anthropic-messages",
      summary: "Small Messages API call to confirm auth and route health.",
      billable: true,
    },
    notes: [
      "The Anthropic connectivity check makes a tiny billable request.",
      "OAuth is intentionally not implied because the operator-owned API key is the stable path here.",
    ],
  },
  {
    providerCode: "gemini",
    title: "Google Gemini",
    category: "frontier",
    description:
      "Gemini through the OpenAI-compatible HTTPS surface so the same operator flow works across frontier providers.",
    supportedKinds: ["hosted-api-key"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelPlaceholder: "gemini-* model family",
    supportsAiGateway: true,
    authOptions: [
      {
        strategy: "api-key",
        label: "API key",
        description: "Preferred EdgeIntel path for Gemini's OpenAI-compatible endpoint.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: [],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "openai-compatible-models",
      summary: "Model inventory request against Gemini's OpenAI-compatible endpoint.",
      billable: false,
    },
    notes: [
      "EdgeIntel treats Gemini as an API-key-first route even though Google offers other auth modes outside this control plane.",
      "Use AI Gateway if you want provider routing, analytics, or fallback above Gemini.",
    ],
  },
  {
    providerCode: "openrouter",
    title: "OpenRouter",
    category: "gateway",
    description: "Hosted routed-model provider with an OpenAI-compatible HTTPS surface.",
    supportedKinds: ["hosted-api-key"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelPlaceholder: "provider/model route",
    supportsAiGateway: false,
    authOptions: [
      {
        strategy: "api-key",
        label: "API key",
        description: "The stable operator path for OpenRouter inside EdgeIntel.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: [],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "openai-compatible-models",
      summary: "Model inventory request against the OpenRouter-compatible endpoint.",
      billable: false,
    },
    notes: [
      "EdgeIntel does not expose platform-specific OAuth for OpenRouter in this wave.",
      "If you already use OpenRouter, keep the credential path explicit and API-key based.",
    ],
  },
  {
    providerCode: "workers-ai",
    title: "Workers AI",
    category: "first-party",
    description: "Cloudflare Workers AI binding with no external provider secret required.",
    supportedKinds: ["hosted-api-key"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: null,
    modelPlaceholder: "@cf/... model identifier",
    supportsAiGateway: false,
    authOptions: [
      {
        strategy: "workers-binding",
        label: "Workers binding",
        description: "Runs through the Worker binding instead of a stored third-party credential.",
        requiredSecretFields: [],
        optionalSecretFields: [],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "workers-ai-binding",
      summary: "Minimal Workers AI prompt through the configured binding.",
      billable: false,
    },
    notes: [
      "No provider OAuth or API key is required for this path.",
      "This is the cleanest first-party route when the model you need exists in Workers AI.",
    ],
  },
  {
    providerCode: "ollama",
    title: "Ollama",
    category: "self-hosted",
    description:
      "Self-hosted OpenAI-compatible route, usually exposed through a Cloudflare Tunnel or another HTTPS edge.",
    supportedKinds: ["local-direct", "local-gateway"],
    recommendedKind: "local-direct",
    defaultBaseUrl: null,
    modelPlaceholder: "gemma3:27b or local model tag",
    supportsAiGateway: true,
    authOptions: [
      {
        strategy: "none",
        label: "No upstream auth",
        description: "Use when the local route is controlled by network posture only.",
        requiredSecretFields: [],
        optionalSecretFields: ["accessClientId", "accessClientSecret"],
        recommended: true,
      },
      {
        strategy: "api-key",
        label: "Bearer API key",
        description: "Use when the local OpenAI-compatible route expects a bearer token.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: ["accessClientId", "accessClientSecret"],
        recommended: false,
      },
    ],
    connectionTest: {
      transport: "openai-compatible-models",
      summary: "Model inventory request through the public HTTPS route to the local model.",
      billable: false,
    },
    notes: [
      "If the route is Access-protected, store the service-token headers here so tests and the Worker can traverse it.",
      "Use local-gateway only when the route is intentionally mediated by AI Gateway.",
    ],
  },
  {
    providerCode: "custom-openai-compatible",
    title: "Custom OpenAI-compatible",
    category: "gateway",
    description:
      "Generic OpenAI-compatible endpoint for advanced hosted or self-hosted routes that do not deserve a dedicated preset yet.",
    supportedKinds: ["hosted-api-key", "local-direct", "local-gateway"],
    recommendedKind: "hosted-api-key",
    defaultBaseUrl: null,
    modelPlaceholder: "model identifier",
    supportsAiGateway: true,
    authOptions: [
      {
        strategy: "none",
        label: "No upstream auth",
        description: "Use when the endpoint is authenticated by network posture alone.",
        requiredSecretFields: [],
        optionalSecretFields: ["accessClientId", "accessClientSecret"],
        recommended: false,
      },
      {
        strategy: "api-key",
        label: "Bearer API key",
        description: "Use when the route expects an OpenAI-style bearer token.",
        requiredSecretFields: ["apiKey"],
        optionalSecretFields: ["accessClientId", "accessClientSecret"],
        recommended: true,
      },
    ],
    connectionTest: {
      transport: "openai-compatible-models",
      summary: "Model inventory request against the supplied OpenAI-compatible base URL.",
      billable: false,
    },
    notes: [
      "Keep the auth path explicit. EdgeIntel will not imply OAuth on a custom endpoint.",
      "If the route is behind Access, provide the service token headers separately from the upstream auth choice.",
    ],
  },
];

export interface NormalizedProviderSettingsInput {
  kind: PersistedProviderSetting["kind"];
  providerCode: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  authStrategy: ProviderAuthStrategy;
  usesAiGateway: boolean;
  oauthConnected: boolean;
  status: ProviderStatus;
  metadata: Record<string, unknown>;
  secret: ProviderSecretPayload | null;
}

function isValidProviderKind(
  value: string | undefined,
): value is PersistedProviderSetting["kind"] {
  return VALID_PROVIDER_KINDS.includes(
    value as PersistedProviderSetting["kind"],
  );
}

function isValidProviderAuthStrategy(
  value: string | undefined,
): value is ProviderAuthStrategy {
  return VALID_PROVIDER_AUTH_STRATEGIES.includes(value as ProviderAuthStrategy);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dedupeSecretFields(
  fields: ProviderSecretField[],
): ProviderSecretField[] {
  return [...new Set(fields)];
}

function cloneCapability(capability: ProviderCapabilityView): ProviderCapabilityView {
  return {
    ...capability,
    supportedKinds: [...capability.supportedKinds],
    authOptions: capability.authOptions.map((option) => ({
      ...option,
      requiredSecretFields: [...option.requiredSecretFields],
      optionalSecretFields: [...option.optionalSecretFields],
    })),
    connectionTest: { ...capability.connectionTest },
    notes: [...capability.notes],
  };
}

function titleCaseProviderCode(providerCode: string): string {
  return providerCode
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackCapability(
  providerCode: string,
  kind?: PersistedProviderSetting["kind"],
): ProviderCapabilityView {
  const localPreferred = kind === "local-direct" || kind === "local-gateway";
  const base = cloneCapability(
    CATALOG.find((entry) => entry.providerCode === "custom-openai-compatible")!,
  );
  return {
    ...base,
    providerCode,
    title: titleCaseProviderCode(providerCode),
    recommendedKind: localPreferred ? "local-direct" : "hosted-api-key",
    description: localPreferred
      ? "Advanced self-hosted route using a custom OpenAI-compatible edge."
      : "Advanced hosted route using a custom OpenAI-compatible endpoint.",
  };
}

export function listProviderCapabilityCatalog(): ProviderCapabilityView[] {
  return CATALOG.map(cloneCapability);
}

export function resolveProviderCapability(
  providerCode: string,
  kind?: PersistedProviderSetting["kind"],
): ProviderCapabilityView {
  const normalizedCode = providerCode.trim().toLowerCase();
  const found = CATALOG.find((entry) => entry.providerCode === normalizedCode);
  return found ? cloneCapability(found) : fallbackCapability(normalizedCode, kind);
}

function capabilityAuthOption(
  capability: ProviderCapabilityView,
  authStrategy: ProviderAuthStrategy,
): ProviderCapabilityAuthOption | null {
  return (
    capability.authOptions.find((option) => option.strategy === authStrategy) ??
    null
  );
}

function defaultAuthStrategy(
  capability: ProviderCapabilityView,
): ProviderAuthStrategy {
  return (
    capability.authOptions.find((option) => option.recommended)?.strategy ??
    capability.authOptions[0]?.strategy ??
    "api-key"
  );
}

function resolveDefaultBaseUrl(providerCode: string, kind?: PersistedProviderSetting["kind"]): string | null {
  return resolveProviderCapability(providerCode, kind).defaultBaseUrl;
}

function ensureHttpsBaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("baseUrl must be a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("baseUrl must use HTTPS.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function buildOpenAiCompatibleModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("Provider base URL is required.");
  }

  if (/\/models$/i.test(normalized)) {
    return normalized;
  }

  if (/\/openai$/i.test(normalized)) {
    return `${normalized}/models`;
  }

  if (normalized.includes("/v1/") || /\/v1$/i.test(normalized)) {
    return `${normalized}/models`;
  }

  return `${normalized}/v1/models`;
}

export function normalizeProviderSettingsInput(
  body: ProviderSettingsRequestBody,
  options: {
    partial?: boolean;
    existing?: PersistedProviderSetting | null;
  } = {},
): NormalizedProviderSettingsInput {
  if (!options.partial) {
    if (!isValidProviderKind(body.kind)) {
      throw new Error("kind must be one of the supported provider kinds.");
    }
    if (!body.providerCode?.trim()) {
      throw new Error("providerCode is required.");
    }
    if (!body.displayName?.trim()) {
      throw new Error("displayName is required.");
    }
  }

  const requestedKind =
    body.kind && isValidProviderKind(body.kind) ? body.kind : options.existing?.kind;
  if (body.kind && !requestedKind) {
    throw new Error("kind must be one of the supported provider kinds.");
  }

  const providerCode =
    trimOrNull(body.providerCode)?.toLowerCase() ??
    options.existing?.providerCode ??
    "custom-openai-compatible";
  const capability = resolveProviderCapability(providerCode, requestedKind);
  const kind = requestedKind ?? capability.recommendedKind;

  if (!capability.supportedKinds.includes(kind)) {
    throw new Error(
      `${capability.title} does not support kind=${kind}. Choose one of ${capability.supportedKinds.join(", ")}.`,
    );
  }

  const requestedAuthStrategy = trimOrNull(body.authStrategy);
  const legacyOauth = body.oauthConnected === true ? "oauth" : null;
  const authStrategy = requestedAuthStrategy
    ? (requestedAuthStrategy as ProviderAuthStrategy)
    : legacyOauth ??
      options.existing?.authStrategy ??
      defaultAuthStrategy(capability);

  if (!isValidProviderAuthStrategy(authStrategy)) {
    throw new Error("authStrategy must be one of the supported provider auth strategies.");
  }

  if (!capabilityAuthOption(capability, authStrategy)) {
    throw new Error(
      `${capability.title} does not support authStrategy=${authStrategy}.`,
    );
  }

  const baseUrl = trimOrNull(body.baseUrl);
  const normalizedBaseUrl = baseUrl
    ? ensureHttpsBaseUrl(baseUrl)
    : resolveDefaultBaseUrl(providerCode, kind);

  if (body.status && !VALID_PROVIDER_STATUSES.includes(body.status)) {
    throw new Error("status must be one of draft, ready, error, or disabled.");
  }

  return {
    kind,
    providerCode,
    displayName: trimOrNull(body.displayName) ?? capability.title,
    baseUrl: normalizedBaseUrl,
    defaultModel: trimOrNull(body.defaultModel),
    authStrategy,
    usesAiGateway:
      typeof body.usesAiGateway === "boolean"
        ? body.usesAiGateway
        : options.existing?.usesAiGateway ?? false,
    oauthConnected: authStrategy === "oauth",
    status: body.status ?? options.existing?.status ?? "draft",
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? body.metadata
        : {},
    secret: body.secret ?? null,
  };
}

function configuredSecretFields(
  secrets: ProviderSecretPayload | null,
): ProviderSecretField[] {
  if (!secrets) return [];

  const candidates: ProviderSecretField[] = [
    "apiKey",
    "gatewayToken",
    "accessClientId",
    "accessClientSecret",
    "oauthAccessToken",
    "oauthRefreshToken",
  ];

  return candidates.filter((key) => {
    const value = secrets[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function requiresAccessHeaders(provider: PersistedProviderSetting): boolean {
  const metadata = safeJsonParse<Record<string, unknown>>(provider.metadataJson, {});
  return Boolean(metadata.accessProtected);
}

export function buildProviderSecretHealth(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): ProviderSecretHealthView {
  const capability = resolveProviderCapability(provider.providerCode, provider.kind);
  const authOption = capabilityAuthOption(capability, provider.authStrategy);
  const configured = configuredSecretFields(secrets);
  const required = dedupeSecretFields(authOption?.requiredSecretFields ?? []);
  const optional = dedupeSecretFields([
    ...(authOption?.optionalSecretFields ?? []),
    ...(provider.usesAiGateway ? (["gatewayToken"] as ProviderSecretField[]) : []),
  ]);
  const missing = required.filter((field) => !configured.includes(field));
  const requiresAccess = requiresAccessHeaders(provider);
  const accessConfigured =
    configured.includes("accessClientId") &&
    configured.includes("accessClientSecret");

  let summary = "Configuration incomplete.";
  if (!authOption) {
    summary = `Auth strategy ${provider.authStrategy} is not supported for ${capability.title}.`;
  } else if (missing.length) {
    summary = `Missing ${missing.join(", ")} for the selected auth path.`;
  } else if (requiresAccess && !accessConfigured) {
    summary = "Route expects Cloudflare Access headers, but the service token pair is incomplete.";
  } else if (provider.authStrategy === "workers-binding") {
    summary = "Workers binding path is ready. No provider secret is required.";
  } else if (provider.authStrategy === "none") {
    summary = requiresAccess
      ? "No upstream secret required. Access headers are the only credential gate."
      : "No upstream secret required for this route.";
  } else {
    summary = "Credential posture is ready for connection testing.";
  }

  return {
    authStrategy: provider.authStrategy,
    requiredSecretFields: required,
    optionalSecretFields: optional,
    configuredSecretFields: configured,
    missingRequiredSecretFields: missing,
    requiresAccessHeaders: requiresAccess,
    accessHeadersConfigured: accessConfigured,
    canRunConnectionTest:
      Boolean(authOption) &&
      missing.length === 0 &&
      (!requiresAccess || accessConfigured),
    summary,
  };
}

export function serializeProviderSetting(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null = null,
): ProviderSettingView {
  const capability = resolveProviderCapability(provider.providerCode, provider.kind);
  return {
    id: provider.id,
    kind: provider.kind,
    providerCode: provider.providerCode,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    authStrategy: provider.authStrategy,
    usesAiGateway: provider.usesAiGateway,
    oauthConnected: provider.oauthConnected,
    status: provider.status,
    secretConfigured: provider.secretConfigured,
    lastTestedAt: provider.lastTestedAt,
    lastTestStatus: provider.lastTestStatus,
    lastTestResult: safeJsonParse<ProviderConnectionTestResult | null>(
      provider.lastTestResultJson,
      null,
    ),
    capability,
    secretHealth: buildProviderSecretHealth(provider, secrets),
    metadata: safeJsonParse<Record<string, unknown>>(provider.metadataJson, {}),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function authorizationHeader(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): string | undefined {
  if (provider.authStrategy !== "api-key") return undefined;
  if (provider.providerCode === "anthropic") return undefined;
  return secrets?.apiKey ? `Bearer ${secrets.apiKey}` : undefined;
}

async function testOpenAiCompatibleProvider(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): Promise<ProviderConnectionTestResult> {
  const baseUrl =
    provider.baseUrl ?? resolveDefaultBaseUrl(provider.providerCode, provider.kind);
  if (!baseUrl) {
    throw new Error("Provider baseUrl is required for OpenAI-compatible tests.");
  }

  if (provider.authStrategy === "oauth") {
    return {
      status: "warning",
      message:
        "OAuth-based OpenAI-compatible provider tests are not implemented in EdgeIntel yet. Switch to an explicit API key or no-auth route.",
      latencyMs: 0,
      transport: "unsupported-auth-strategy",
      targetUrl: buildOpenAiCompatibleModelsUrl(baseUrl),
      providerCode: provider.providerCode,
      model: provider.defaultModel,
      details: {
        authStrategy: provider.authStrategy,
      },
      testedAt: nowIso(),
    };
  }

  if (provider.authStrategy === "api-key" && !secrets?.apiKey) {
    throw new Error("This provider test requires an apiKey secret.");
  }

  const targetUrl = buildOpenAiCompatibleModelsUrl(baseUrl);
  const startedAt = Date.now();
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: Object.fromEntries(
      Object.entries({
        Authorization: authorizationHeader(provider, secrets),
        "CF-Access-Client-Id": secrets?.accessClientId,
        "CF-Access-Client-Secret": secrets?.accessClientSecret,
      }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  });

  const latencyMs = Date.now() - startedAt;
  const text = await response.text();

  if (!response.ok) {
    return {
      status: "failed",
      message: `OpenAI-compatible provider test failed with status ${response.status}.`,
      latencyMs,
      transport: "openai-compatible-models",
      targetUrl,
      providerCode: provider.providerCode,
      model: provider.defaultModel,
      details: {
        authStrategy: provider.authStrategy,
        responseStatus: response.status,
        responseBodyPreview: text.slice(0, 300),
      },
      testedAt: nowIso(),
    };
  }

  const payload = safeJsonParse<Record<string, unknown>>(text, {});
  const models = Array.isArray(payload.data) ? payload.data : [];

  return {
    status: "passed",
    message: "Provider responded to a model inventory request.",
    latencyMs,
    transport: "openai-compatible-models",
    targetUrl,
    providerCode: provider.providerCode,
    model: provider.defaultModel,
    details: {
      authStrategy: provider.authStrategy,
      modelCount: models.length,
    },
    testedAt: nowIso(),
  };
}

async function testAnthropicProvider(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): Promise<ProviderConnectionTestResult> {
  if (provider.authStrategy !== "api-key") {
    return {
      status: "warning",
      message:
        "Anthropic routes in EdgeIntel are API-key-first. Update the auth strategy before testing this provider.",
      latencyMs: 0,
      transport: "unsupported-auth-strategy",
      targetUrl: `${provider.baseUrl ?? "https://api.anthropic.com"}/v1/messages`,
      providerCode: provider.providerCode,
      model: provider.defaultModel ?? "claude-*",
      details: {
        authStrategy: provider.authStrategy,
      },
      testedAt: nowIso(),
    };
  }

  const apiKey = secrets?.apiKey;
  if (!apiKey) {
    throw new Error("Anthropic provider tests require an apiKey secret.");
  }

  const targetUrl = `${provider.baseUrl ?? "https://api.anthropic.com"}/v1/messages`;
  const startedAt = Date.now();
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.defaultModel ?? "claude-3-5-haiku-latest",
      max_tokens: 8,
      messages: [
        {
          role: "user",
          content: "Reply with the single word pong.",
        },
      ],
    }),
  });

  const latencyMs = Date.now() - startedAt;
  const text = await response.text();

  if (!response.ok) {
    return {
      status: "failed",
      message: `Anthropic provider test failed with status ${response.status}.`,
      latencyMs,
      transport: "anthropic-messages",
      targetUrl,
      providerCode: provider.providerCode,
      model: provider.defaultModel ?? "claude-3-5-haiku-latest",
      details: {
        authStrategy: provider.authStrategy,
        responseStatus: response.status,
        responseBodyPreview: text.slice(0, 300),
        billableTest: true,
      },
      testedAt: nowIso(),
    };
  }

  return {
    status: "warning",
    message:
      "Anthropic provider responded successfully. This connectivity check makes a tiny billable request.",
    latencyMs,
    transport: "anthropic-messages",
    targetUrl,
    providerCode: provider.providerCode,
    model: provider.defaultModel ?? "claude-3-5-haiku-latest",
    details: {
      authStrategy: provider.authStrategy,
      billableTest: true,
      responseBodyPreview: text.slice(0, 120),
    },
    testedAt: nowIso(),
  };
}

async function testWorkersAiProvider(
  env: Env,
  provider: PersistedProviderSetting,
): Promise<ProviderConnectionTestResult> {
  const model = provider.defaultModel ?? env.AI_GATEWAY_MODEL;
  const startedAt = Date.now();
  const response = await env.AI.run(model as never, {
    prompt: "Reply with the single word pong.",
  } as never);
  const latencyMs = Date.now() - startedAt;
  const previewSource: unknown = response;

  return {
    status: "passed",
    message: "Workers AI returned a response.",
    latencyMs,
    transport: "workers-ai-binding",
    targetUrl: null,
    providerCode: provider.providerCode,
    model,
    details: {
      authStrategy: provider.authStrategy,
      responsePreview:
        typeof previewSource === "string"
          ? previewSource.slice(0, 120)
          : JSON.stringify(previewSource).slice(0, 120),
    },
    testedAt: nowIso(),
  };
}

export async function testProviderConnection(
  env: Env,
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
  _body: ProviderTestRequestBody = {},
): Promise<ProviderConnectionTestResult> {
  if (provider.providerCode === "workers-ai") {
    return testWorkersAiProvider(env, provider);
  }

  if (provider.providerCode === "anthropic") {
    return testAnthropicProvider(provider, secrets);
  }

  if (
    [
      "openai",
      "gemini",
      "openrouter",
      "ollama",
      "custom-openai-compatible",
      "openai-compatible",
    ].includes(provider.providerCode) ||
    provider.kind === "local-direct" ||
    provider.kind === "local-gateway"
  ) {
    return testOpenAiCompatibleProvider(provider, secrets);
  }

  return {
    status: "warning",
    message: `No first-class connectivity strategy is implemented yet for providerCode=${provider.providerCode}.`,
    latencyMs: 0,
    transport: "unsupported",
    targetUrl: provider.baseUrl,
    providerCode: provider.providerCode,
    model: provider.defaultModel,
    details: {
      supportedProviderCodes: CATALOG.map((entry) => entry.providerCode),
    },
    testedAt: nowIso(),
  };
}
