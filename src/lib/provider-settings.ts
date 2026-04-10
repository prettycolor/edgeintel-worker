import type { Env } from "../env";
import type {
  PersistedProviderSetting,
  ProviderConnectionTestResult,
  ProviderSecretPayload,
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

export interface NormalizedProviderSettingsInput {
  kind: PersistedProviderSetting["kind"];
  providerCode: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  usesAiGateway: boolean;
  oauthConnected: boolean;
  status: ProviderStatus;
  metadata: Record<string, unknown>;
  secret: ProviderSecretPayload | null;
}

export interface ProviderSettingView {
  id: string;
  kind: PersistedProviderSetting["kind"];
  providerCode: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  usesAiGateway: boolean;
  oauthConnected: boolean;
  status: ProviderStatus;
  secretConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: PersistedProviderSetting["lastTestStatus"];
  lastTestResult: ProviderConnectionTestResult | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const VALID_PROVIDER_KINDS = [
  "hosted-api-key",
  "hosted-oauth",
  "local-direct",
  "local-gateway",
] as const;

function isValidProviderKind(
  value: string | undefined,
): value is PersistedProviderSetting["kind"] {
  return VALID_PROVIDER_KINDS.includes(
    value as PersistedProviderSetting["kind"],
  );
}

export function buildOpenAiCompatibleModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (!normalized) {
    throw new Error("Provider base URL is required.");
  }

  if (/\/models$/i.test(normalized)) {
    return normalized;
  }

  if (normalized.includes("/v1/") || /\/v1$/i.test(normalized)) {
    return `${normalized}/models`;
  }

  return `${normalized}/v1/models`;
}

function resolveDefaultBaseUrl(providerCode: string): string | null {
  switch (providerCode) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com";
    default:
      return null;
  }
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

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeProviderSettingsInput(
  body: ProviderSettingsRequestBody,
  options: {
    partial?: boolean;
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

  const kind =
    body.kind && isValidProviderKind(body.kind) ? body.kind : undefined;
  if (body.kind && !kind) {
    throw new Error("kind must be one of the supported provider kinds.");
  }

  const providerCode = body.providerCode?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const baseUrl = trimOrNull(body.baseUrl);
  const defaultBaseUrl =
    providerCode && !baseUrl ? resolveDefaultBaseUrl(providerCode) : null;
  const normalizedBaseUrl = baseUrl
    ? ensureHttpsBaseUrl(baseUrl)
    : defaultBaseUrl;

  if (
    body.status &&
    !VALID_PROVIDER_STATUSES.includes(body.status)
  ) {
    throw new Error("status must be one of draft, ready, error, or disabled.");
  }

  if (
    (kind === "local-direct" || kind === "local-gateway") &&
    normalizedBaseUrl &&
    !normalizedBaseUrl.startsWith("https://")
  ) {
    throw new Error("Local provider baseUrl must use HTTPS.");
  }

  return {
    kind: kind ?? "hosted-api-key",
    providerCode: providerCode ?? "custom-openai-compatible",
    displayName: displayName ?? "Untitled provider",
    baseUrl: normalizedBaseUrl,
    defaultModel: trimOrNull(body.defaultModel),
    usesAiGateway: Boolean(body.usesAiGateway),
    oauthConnected: Boolean(body.oauthConnected),
    status: body.status ?? "draft",
    metadata:
      body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    secret: body.secret ?? null,
  };
}

export function serializeProviderSetting(
  provider: PersistedProviderSetting,
): ProviderSettingView {
  return {
    id: provider.id,
    kind: provider.kind,
    providerCode: provider.providerCode,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
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
    metadata: safeJsonParse<Record<string, unknown>>(provider.metadataJson, {}),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function authorizationHeader(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): string | undefined {
  if (provider.providerCode === "anthropic") return undefined;
  return secrets?.apiKey ? `Bearer ${secrets.apiKey}` : undefined;
}

async function testOpenAiCompatibleProvider(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): Promise<ProviderConnectionTestResult> {
  const baseUrl =
    provider.baseUrl ?? resolveDefaultBaseUrl(provider.providerCode);
  if (!baseUrl) {
    throw new Error("Provider baseUrl is required for OpenAI-compatible tests.");
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
      modelCount: models.length,
    },
    testedAt: nowIso(),
  };
}

async function testAnthropicProvider(
  provider: PersistedProviderSetting,
  secrets: ProviderSecretPayload | null,
): Promise<ProviderConnectionTestResult> {
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
      supportedProviderCodes: [
        "openai",
        "ollama",
        "custom-openai-compatible",
        "openai-compatible",
        "anthropic",
        "workers-ai",
      ],
    },
    testedAt: nowIso(),
  };
}
