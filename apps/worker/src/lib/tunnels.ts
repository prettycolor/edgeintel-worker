import type { Env } from "../env";
import type {
  CloudflareZoneView,
  HostnameConflictView,
  HostnameValidationResult,
  PersistedProviderSetting,
  PersistedTunnelRecord,
  TunnelConnectionTestResult,
  TunnelConnectorStatus,
  TunnelSecretPayload,
  TunnelSettingsRequestBody,
  TunnelStatus,
  TunnelTestRequestBody,
  TunnelTestStatus,
} from "../types";
import { nowIso, safeJsonParse, slugify } from "./utils";

const VALID_TUNNEL_STATUSES: TunnelStatus[] = [
  "draft",
  "provisioning",
  "ready",
  "error",
  "deleting",
];

const VALID_CONNECTOR_STATUSES: TunnelConnectorStatus[] = [
  "unpaired",
  "awaiting_connector",
  "connected",
  "degraded",
  "offline",
];

interface CloudflareApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{
    code?: number;
    message?: string;
  }>;
  messages?: Array<{
    code?: number;
    message?: string;
  }>;
}

interface CloudflareTunnelResponse {
  id?: string;
  name?: string;
  status?: string;
  remote_config?: boolean;
  connections?: Array<{
    client_id?: string;
    client_version?: string;
    opened_at?: string;
  }>;
}

interface CloudflareDnsRecordResponse {
  id?: string;
  name?: string;
  type?: string;
  content?: string;
  proxied?: boolean;
}

interface CloudflareZoneResponse {
  id?: string;
  name?: string;
  status?: string;
  paused?: boolean;
  account?: {
    name?: string;
  };
  plan?: {
    name?: string;
  };
}

interface CloudflareAccessServiceTokenCreateResponse {
  id?: string;
  client_id?: string;
  client_secret?: string;
  name?: string;
}

interface CloudflareAccessApplicationResponse {
  id?: string;
  aud?: string;
  domain?: string;
  name?: string;
}

interface CloudflareAccessPolicyResponse {
  id?: string;
  name?: string;
}

export interface NormalizedTunnelSettingsInput {
  providerSettingId: string | null;
  cloudflareZoneId: string;
  publicHostname: string;
  tunnelName: string;
  localServiceUrl: string;
  accessProtected: boolean;
  status: TunnelStatus;
  connectorStatus: TunnelConnectorStatus;
  metadata: Record<string, unknown>;
}

export interface TunnelRecordView {
  id: string;
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
  secretConfigured: boolean;
  connectorStatus: TunnelConnectorStatus;
  status: TunnelStatus;
  lastConnectorHeartbeatAt: string | null;
  lastTunnelHealthAt: string | null;
  lastTestedAt: string | null;
  lastTestStatus: TunnelTestStatus | null;
  lastTestResult: TunnelConnectionTestResult | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TunnelBootstrapPayload {
  mode: "cloudflared-token";
  publicHostname: string;
  localServiceUrl: string;
  cloudflareTunnelId: string | null;
  cloudflareTunnelName: string | null;
  command: string | null;
  launchArgs: string[] | null;
  tunnelTokenPresent: boolean;
  accessHeaders: Record<string, string>;
  notes: string[];
}

export interface TunnelProvisioningResult {
  cloudflareTunnelId: string;
  cloudflareTunnelName: string;
  cloudflareZoneId: string;
  publicHostname: string;
  localServiceUrl: string;
  accessProtected: boolean;
  accessAppId: string | null;
  accessPolicyId: string | null;
  accessServiceTokenId: string | null;
  dnsRecordId: string | null;
  status: TunnelStatus;
  connectorStatus: TunnelConnectorStatus;
  metadata: Record<string, unknown>;
  secrets: TunnelSecretPayload | null;
}

const ZONE_PAGE_SIZE = 100;

function requireCloudflareCredentials(env: Env): {
  accountId: string;
  apiToken: string;
} {
  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID must be configured for tunnel orchestration.");
  }

  if (!env.CLOUDFLARE_API_TOKEN?.trim()) {
    throw new Error("CLOUDFLARE_API_TOKEN must be configured for tunnel orchestration.");
  }

  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID.trim(),
    apiToken: env.CLOUDFLARE_API_TOKEN.trim(),
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function ensurePublicHostname(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("publicHostname is required.");
  }

  if (trimmed.includes("/") || trimmed.includes(":")) {
    throw new Error("publicHostname must be a hostname without a scheme, port, or path.");
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${trimmed}`);
  } catch {
    throw new Error("publicHostname must be a valid hostname.");
  }

  if (parsed.hostname !== trimmed) {
    throw new Error("publicHostname must be a bare hostname.");
  }

  return trimmed;
}

function ensureLocalServiceUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("localServiceUrl is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("localServiceUrl must be a valid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("localServiceUrl must use http:// or https://.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function normalizeTunnelSettingsInput(
  body: TunnelSettingsRequestBody,
  env: Env,
  options: {
    partial?: boolean;
    existing?: PersistedTunnelRecord | null;
  } = {},
): NormalizedTunnelSettingsInput {
  const zoneId =
    trimOrNull(body.cloudflareZoneId) ??
    trimOrNull(options.existing?.cloudflareZoneId) ??
    trimOrNull(env.CLOUDFLARE_ZONE_ID);

  if (!options.partial && !zoneId) {
    throw new Error(
      "cloudflareZoneId is required unless CLOUDFLARE_ZONE_ID is configured.",
    );
  }

  const publicHostname = body.publicHostname
    ? ensurePublicHostname(body.publicHostname)
    : options.existing?.publicHostname;
  if (!publicHostname) {
    throw new Error("publicHostname is required.");
  }

  const localServiceUrl = body.localServiceUrl
    ? ensureLocalServiceUrl(body.localServiceUrl)
    : options.existing?.localServiceUrl;
  if (!localServiceUrl) {
    throw new Error("localServiceUrl is required.");
  }

  if (body.status && !VALID_TUNNEL_STATUSES.includes(body.status)) {
    throw new Error("status must be one of draft, provisioning, ready, error, or deleting.");
  }

  if (
    body.connectorStatus &&
    !VALID_CONNECTOR_STATUSES.includes(body.connectorStatus)
  ) {
    throw new Error(
      "connectorStatus must be one of unpaired, awaiting_connector, connected, degraded, or offline.",
    );
  }

  const inferredName = options.existing?.cloudflareTunnelName
    ? options.existing.cloudflareTunnelName
    : `edgeintel-${slugify(publicHostname).slice(0, 44) || "local-model"}`;

  return {
    providerSettingId:
      trimOrNull(body.providerSettingId) ??
      options.existing?.providerSettingId ??
      null,
    cloudflareZoneId: zoneId ?? "",
    publicHostname,
    tunnelName: trimOrNull(body.tunnelName) ?? inferredName,
    localServiceUrl,
    accessProtected:
      body.accessProtected ?? options.existing?.accessProtected ?? true,
    status: body.status ?? options.existing?.status ?? "draft",
    connectorStatus:
      body.connectorStatus ?? options.existing?.connectorStatus ?? "unpaired",
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? body.metadata
        : safeJsonParse(options.existing?.metadataJson ?? "{}", {}),
  };
}

export function serializeTunnelRecord(
  record: PersistedTunnelRecord,
): TunnelRecordView {
  return {
    id: record.id,
    providerSettingId: record.providerSettingId,
    cloudflareTunnelId: record.cloudflareTunnelId,
    cloudflareTunnelName: record.cloudflareTunnelName,
    cloudflareZoneId: record.cloudflareZoneId,
    publicHostname: record.publicHostname,
    localServiceUrl: record.localServiceUrl,
    accessProtected: record.accessProtected,
    accessAppId: record.accessAppId,
    accessPolicyId: record.accessPolicyId,
    accessServiceTokenId: record.accessServiceTokenId,
    dnsRecordId: record.dnsRecordId,
    secretConfigured: record.secretConfigured,
    connectorStatus: record.connectorStatus,
    status: record.status,
    lastConnectorHeartbeatAt: record.lastConnectorHeartbeatAt,
    lastTunnelHealthAt: record.lastTunnelHealthAt,
    lastTestedAt: record.lastTestedAt,
    lastTestStatus: record.lastTestStatus,
    lastTestResult: safeJsonParse<TunnelConnectionTestResult | null>(
      record.lastTestResultJson,
      null,
    ),
    metadata: safeJsonParse<Record<string, unknown>>(record.metadataJson, {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function buildTunnelConnectorBootstrap(
  record: Pick<
    PersistedTunnelRecord,
    | "publicHostname"
    | "localServiceUrl"
    | "cloudflareTunnelId"
    | "cloudflareTunnelName"
  >,
  secrets: TunnelSecretPayload | null,
): TunnelBootstrapPayload {
  const accessHeaders = Object.fromEntries(
    Object.entries({
      "CF-Access-Client-Id": secrets?.accessClientId,
      "CF-Access-Client-Secret": secrets?.accessClientSecret,
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    mode: "cloudflared-token",
    publicHostname: record.publicHostname,
    localServiceUrl: record.localServiceUrl,
    cloudflareTunnelId: record.cloudflareTunnelId,
    cloudflareTunnelName: record.cloudflareTunnelName,
    command: secrets?.tunnelToken
      ? `cloudflared tunnel run --token ${secrets.tunnelToken}`
      : null,
    launchArgs: secrets?.tunnelToken
      ? ["tunnel", "run", "--token", secrets.tunnelToken]
      : null,
    tunnelTokenPresent: Boolean(secrets?.tunnelToken),
    accessHeaders,
    notes: [
      "Cloudflare creates the remotely managed tunnel and DNS route. A local connector or cloudflared still has to run on the machine serving the local model.",
      "If Access protection is enabled, runtime probes and OpenAI-compatible traffic should send the CF-Access-Client-Id and CF-Access-Client-Secret headers.",
    ],
  };
}

export function getCloudflareControlPlaneReadiness(env: Env): {
  configured: boolean;
  missing: string[];
  defaults: {
    zoneId: string | null;
  };
} {
  const missing: string[] = [];
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) missing.push("CLOUDFLARE_API_TOKEN");
  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) missing.push("CLOUDFLARE_ACCOUNT_ID");
  return {
    configured: missing.length === 0,
    missing,
    defaults: {
      zoneId: trimOrNull(env.CLOUDFLARE_ZONE_ID),
    },
  };
}

async function cloudflareRequest<T>(
  env: Env,
  options: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  },
): Promise<T> {
  const { apiToken } = requireCloudflareCredentials(env);
  const url = new URL(`https://api.cloudflare.com/client/v4${options.path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers({
    Authorization: `Bearer ${apiToken}`,
  });
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = safeJsonParse<CloudflareApiEnvelope<T> | null>(text, null);

  if (!response.ok || !payload?.success) {
    const errorMessage =
      payload?.errors?.map((entry) => entry.message).filter(Boolean).join("; ") ||
      text ||
      `Cloudflare API request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload.result;
}

function toZoneView(
  row: CloudflareZoneResponse,
  defaultZoneId: string | null,
): CloudflareZoneView | null {
  if (!row.id || !row.name) return null;
  return {
    id: row.id,
    name: row.name.toLowerCase(),
    status: row.status ?? null,
    paused: Boolean(row.paused),
    planName: row.plan?.name ?? null,
    accountName: row.account?.name ?? null,
    isDefault: row.id === defaultZoneId,
  };
}

function hostnameMatchesZone(hostname: string, zoneName: string): boolean {
  return hostname === zoneName || hostname.endsWith(`.${zoneName}`);
}

function pickBestZoneForHostname(
  zones: CloudflareZoneView[],
  hostname: string,
): CloudflareZoneView | null {
  return (
    [...zones]
      .filter((zone) => hostnameMatchesZone(hostname, zone.name))
      .sort((left, right) => right.name.length - left.name.length)[0] ?? null
  );
}

export async function listCloudflareZones(env: Env): Promise<CloudflareZoneView[]> {
  const defaultZoneId = trimOrNull(env.CLOUDFLARE_ZONE_ID);
  const zones: CloudflareZoneView[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const result = await cloudflareRequest<CloudflareZoneResponse[]>(env, {
      method: "GET",
      path: "/zones",
      query: {
        page,
        per_page: ZONE_PAGE_SIZE,
      },
    });

    const pageZones = result
      .map((entry) => toZoneView(entry, defaultZoneId))
      .filter((entry): entry is CloudflareZoneView => Boolean(entry));
    zones.push(...pageZones);

    if (result.length < ZONE_PAGE_SIZE) {
      break;
    }
  }

  return zones.sort((left, right) => left.name.localeCompare(right.name));
}

export async function validateTunnelHostname(
  env: Env,
  input: {
    publicHostname: string;
    cloudflareZoneId?: string | null;
    existingTunnelId?: string | null;
  },
): Promise<HostnameValidationResult> {
  const hostname = ensurePublicHostname(input.publicHostname);
  const zones = await listCloudflareZones(env);
  const requestedZoneId = trimOrNull(input.cloudflareZoneId);
  const explicitZone = requestedZoneId
    ? zones.find((zone) => zone.id === requestedZoneId) ?? null
    : null;
  const defaultZone =
    zones.find((zone) => zone.isDefault) ??
    (trimOrNull(env.CLOUDFLARE_ZONE_ID)
      ? ({
          id: trimOrNull(env.CLOUDFLARE_ZONE_ID) ?? "",
          name: "",
          status: null,
          paused: false,
          planName: null,
          accountName: null,
          isDefault: true,
        } satisfies CloudflareZoneView)
      : null);

  let matchedBy: HostnameValidationResult["matchedBy"] = "none";
  let zone: CloudflareZoneView | null = null;

  if (explicitZone) {
    zone = explicitZone;
    matchedBy = "provided-zone";
  } else if (requestedZoneId) {
    return {
      status: "invalid",
      hostname,
      zone: null,
      matchedBy,
      suggestedZoneId: null,
      suggestedTunnelName: `edgeintel-${slugify(hostname).slice(0, 44) || "local-model"}`,
      conflicts: [],
      existingTunnelRecordConflict: false,
      message: "The selected Cloudflare zone could not be found for this API token.",
    };
  } else {
    zone = pickBestZoneForHostname(zones, hostname);
    matchedBy = zone ? "suffix-match" : "none";
    if (!zone && defaultZone && defaultZone.name && hostnameMatchesZone(hostname, defaultZone.name)) {
      zone = defaultZone;
      matchedBy = "default-zone";
    }
  }

  if (!zone || !hostnameMatchesZone(hostname, zone.name)) {
    return {
      status: "invalid",
      hostname,
      zone,
      matchedBy: zone ? matchedBy : "none",
      suggestedZoneId: null,
      suggestedTunnelName: `edgeintel-${slugify(hostname).slice(0, 44) || "local-model"}`,
      conflicts: [],
      existingTunnelRecordConflict: false,
      message:
        "No Cloudflare zone available to this token matches the requested hostname. Pick a hostname under a discovered zone or choose a different zone.",
    };
  }

  const existingRecords = await cloudflareRequest<CloudflareDnsRecordResponse[]>(env, {
    method: "GET",
    path: `/zones/${zone.id}/dns_records`,
    query: {
      "name.exact": hostname,
      per_page: 25,
    },
  });

  const expectedTarget = input.existingTunnelId
    ? `${input.existingTunnelId}.cfargotunnel.com`
    : null;

  const conflicts: HostnameConflictView[] = existingRecords.map((record) => ({
    id: record.id ?? null,
    type: record.type ?? "unknown",
    name: record.name ?? hostname,
    content: record.content ?? null,
    proxied: typeof record.proxied === "boolean" ? record.proxied : null,
  }));

  const blockingConflicts = conflicts.filter((record) => {
    if (record.type !== "CNAME") return true;
    if (!expectedTarget) return true;
    return record.content !== expectedTarget;
  });

  if (blockingConflicts.length > 0) {
    return {
      status: "warning",
      hostname,
      zone,
      matchedBy,
      suggestedZoneId: zone.id,
      suggestedTunnelName: `edgeintel-${slugify(hostname).slice(0, 44) || "local-model"}`,
      conflicts,
      existingTunnelRecordConflict: true,
      message:
        "The hostname already has DNS records in the matched zone. Review the conflicts before provisioning or updating this tunnel route.",
    };
  }

  return {
    status: "valid",
    hostname,
    zone,
    matchedBy,
    suggestedZoneId: zone.id,
    suggestedTunnelName: `edgeintel-${slugify(hostname).slice(0, 44) || "local-model"}`,
    conflicts,
    existingTunnelRecordConflict: false,
    message:
      conflicts.length > 0
        ? "The hostname already points at this EdgeIntel tunnel target."
        : "The hostname is clear to provision in the matched Cloudflare zone.",
  };
}

async function createCloudflareTunnel(
  env: Env,
  tunnelName: string,
): Promise<CloudflareTunnelResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareTunnelResponse>(env, {
    method: "POST",
    path: `/accounts/${accountId}/cfd_tunnel`,
    body: {
      name: tunnelName,
      config_src: "cloudflare",
    },
  });
}

async function updateCloudflareTunnelName(
  env: Env,
  tunnelId: string,
  tunnelName: string,
): Promise<CloudflareTunnelResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareTunnelResponse>(env, {
    method: "PATCH",
    path: `/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
    body: {
      name: tunnelName,
    },
  });
}

async function getCloudflareTunnel(
  env: Env,
  tunnelId: string,
): Promise<CloudflareTunnelResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareTunnelResponse>(env, {
    method: "GET",
    path: `/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
  });
}

async function deleteCloudflareTunnel(env: Env, tunnelId: string): Promise<void> {
  const { accountId } = requireCloudflareCredentials(env);
  await cloudflareRequest<Record<string, never>>(env, {
    method: "DELETE",
    path: `/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
  });
}

async function getCloudflareTunnelToken(
  env: Env,
  tunnelId: string,
): Promise<string> {
  const { accountId } = requireCloudflareCredentials(env);
  const result = await cloudflareRequest<{ token?: string }>(env, {
    method: "GET",
    path: `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
  });

  if (!result.token) {
    throw new Error("Cloudflare did not return a tunnel token.");
  }

  return result.token;
}

async function putCloudflareTunnelConfiguration(
  env: Env,
  tunnelId: string,
  config: Record<string, unknown>,
): Promise<void> {
  const { accountId } = requireCloudflareCredentials(env);
  await cloudflareRequest<Record<string, unknown>>(env, {
    method: "PUT",
    path: `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    body: {
      config,
    },
  });
}

async function listDnsRecords(
  env: Env,
  zoneId: string,
  hostname: string,
): Promise<CloudflareDnsRecordResponse[]> {
  return cloudflareRequest<CloudflareDnsRecordResponse[]>(env, {
    method: "GET",
    path: `/zones/${zoneId}/dns_records`,
    query: {
      "name.exact": hostname,
      type: "CNAME",
      per_page: 5,
    },
  });
}

async function createDnsRecord(
  env: Env,
  zoneId: string,
  hostname: string,
  content: string,
): Promise<CloudflareDnsRecordResponse> {
  return cloudflareRequest<CloudflareDnsRecordResponse>(env, {
    method: "POST",
    path: `/zones/${zoneId}/dns_records`,
    body: {
      type: "CNAME",
      name: hostname,
      content,
      proxied: true,
      ttl: 1,
      comment: "Managed by EdgeIntel",
    },
  });
}

async function patchDnsRecord(
  env: Env,
  zoneId: string,
  recordId: string,
  hostname: string,
  content: string,
): Promise<CloudflareDnsRecordResponse> {
  return cloudflareRequest<CloudflareDnsRecordResponse>(env, {
    method: "PATCH",
    path: `/zones/${zoneId}/dns_records/${recordId}`,
    body: {
      name: hostname,
      content,
      proxied: true,
      comment: "Managed by EdgeIntel",
    },
  });
}

async function deleteDnsRecord(
  env: Env,
  zoneId: string,
  recordId: string,
): Promise<void> {
  await cloudflareRequest<Record<string, never>>(env, {
    method: "DELETE",
    path: `/zones/${zoneId}/dns_records/${recordId}`,
  });
}

async function upsertTunnelDnsRecord(
  env: Env,
  zoneId: string,
  hostname: string,
  target: string,
  existingRecordId?: string | null,
): Promise<CloudflareDnsRecordResponse> {
  if (existingRecordId) {
    return patchDnsRecord(env, zoneId, existingRecordId, hostname, target);
  }

  const existing = await listDnsRecords(env, zoneId, hostname);
  const match = existing[0];
  if (match?.id) {
    return patchDnsRecord(env, zoneId, match.id, hostname, target);
  }

  return createDnsRecord(env, zoneId, hostname, target);
}

async function createAccessPolicy(
  env: Env,
  policyName: string,
): Promise<CloudflareAccessPolicyResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareAccessPolicyResponse>(env, {
    method: "POST",
    path: `/accounts/${accountId}/access/policies`,
    body: {
      name: policyName,
      decision: "non_identity",
      include: [{ any_valid_service_token: {} }],
    },
  });
}

async function deleteAccessPolicy(env: Env, policyId: string): Promise<void> {
  const { accountId } = requireCloudflareCredentials(env);
  await cloudflareRequest<Record<string, never>>(env, {
    method: "DELETE",
    path: `/accounts/${accountId}/access/policies/${policyId}`,
  });
}

async function createAccessServiceToken(
  env: Env,
  tokenName: string,
): Promise<CloudflareAccessServiceTokenCreateResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareAccessServiceTokenCreateResponse>(env, {
    method: "POST",
    path: `/accounts/${accountId}/access/service_tokens`,
    body: {
      name: tokenName,
      duration: "8760h",
    },
  });
}

async function rotateAccessServiceToken(
  env: Env,
  tokenId: string,
): Promise<CloudflareAccessServiceTokenCreateResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareAccessServiceTokenCreateResponse>(env, {
    method: "POST",
    path: `/accounts/${accountId}/access/service_tokens/${tokenId}/rotate`,
  });
}

async function deleteAccessServiceToken(
  env: Env,
  tokenId: string,
): Promise<void> {
  const { accountId } = requireCloudflareCredentials(env);
  await cloudflareRequest<Record<string, never>>(env, {
    method: "DELETE",
    path: `/accounts/${accountId}/access/service_tokens/${tokenId}`,
  });
}

async function createAccessApplication(
  env: Env,
  input: {
    name: string;
    publicHostname: string;
    policyId: string;
  },
): Promise<CloudflareAccessApplicationResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareAccessApplicationResponse>(env, {
    method: "POST",
    path: `/accounts/${accountId}/access/apps`,
    body: {
      name: input.name,
      type: "self_hosted",
      domain: input.publicHostname,
      destinations: [
        {
          type: "public",
          uri: input.publicHostname,
        },
      ],
      app_launcher_visible: false,
      skip_interstitial: true,
      service_auth_401_redirect: true,
      policies: [
        {
          id: input.policyId,
          precedence: 1,
        },
      ],
    },
  });
}

async function updateAccessApplication(
  env: Env,
  appId: string,
  input: {
    name: string;
    publicHostname: string;
    policyId: string;
  },
): Promise<CloudflareAccessApplicationResponse> {
  const { accountId } = requireCloudflareCredentials(env);
  return cloudflareRequest<CloudflareAccessApplicationResponse>(env, {
    method: "PUT",
    path: `/accounts/${accountId}/access/apps/${appId}`,
    body: {
      name: input.name,
      type: "self_hosted",
      domain: input.publicHostname,
      destinations: [
        {
          type: "public",
          uri: input.publicHostname,
        },
      ],
      app_launcher_visible: false,
      skip_interstitial: true,
      service_auth_401_redirect: true,
      policies: [
        {
          id: input.policyId,
          precedence: 1,
        },
      ],
    },
  });
}

async function deleteAccessApplication(env: Env, appId: string): Promise<void> {
  const { accountId } = requireCloudflareCredentials(env);
  await cloudflareRequest<Record<string, never>>(env, {
    method: "DELETE",
    path: `/accounts/${accountId}/access/apps/${appId}`,
  });
}

function buildRuntimeProbePath(provider?: PersistedProviderSetting | null): string {
  switch (provider?.providerCode) {
    case "ollama":
    case "openai":
    case "custom-openai-compatible":
      return "/v1/models";
    default:
      return "/";
  }
}

export async function provisionTunnelResources(
  env: Env,
  input: NormalizedTunnelSettingsInput,
  options: {
    existing?: PersistedTunnelRecord | null;
    existingSecrets?: TunnelSecretPayload | null;
    rotateAccessTokens?: boolean;
  } = {},
): Promise<TunnelProvisioningResult> {
  const existing = options.existing ?? null;
  const existingSecrets = options.existingSecrets ?? null;
  const createdResources: {
    tunnelId: string | null;
    dnsRecordId: string | null;
    accessAppId: string | null;
    accessPolicyId: string | null;
    accessServiceTokenId: string | null;
  } = {
    tunnelId: null,
    dnsRecordId: null,
    accessAppId: null,
    accessPolicyId: null,
    accessServiceTokenId: null,
  };

  if (
    existing?.cloudflareZoneId &&
    existing.cloudflareZoneId !== input.cloudflareZoneId
  ) {
    throw new Error(
      "Changing cloudflareZoneId on an existing tunnel is not supported. Create a new tunnel record instead.",
    );
  }

  let tunnelId = existing?.cloudflareTunnelId ?? null;
  let tunnelName = input.tunnelName;
  let tunnelToken: string | null = null;
  let dnsTarget: string | null = null;
  let dnsRecord: CloudflareDnsRecordResponse | null = null;
  let accessPolicyId = existing?.accessPolicyId ?? null;
  let accessAppId = existing?.accessAppId ?? null;
  let accessServiceTokenId = existing?.accessServiceTokenId ?? null;
  let accessClientId = existingSecrets?.accessClientId;
  let accessClientSecret = existingSecrets?.accessClientSecret;

  try {
    if (!tunnelId) {
      const createdTunnel = await createCloudflareTunnel(env, tunnelName);
      tunnelId = createdTunnel.id ?? null;
      tunnelName = createdTunnel.name ?? tunnelName;
      createdResources.tunnelId = tunnelId;
    } else if (tunnelName !== existing?.cloudflareTunnelName) {
      const updatedTunnel = await updateCloudflareTunnelName(env, tunnelId, tunnelName);
      tunnelName = updatedTunnel.name ?? tunnelName;
    }

    if (!tunnelId) {
      throw new Error("Cloudflare tunnel provisioning did not return a tunnel ID.");
    }

    await putCloudflareTunnelConfiguration(env, tunnelId, {
      ingress: [
        {
          hostname: input.publicHostname,
          service: input.localServiceUrl,
        },
        {
          service: "http_status:404",
        },
      ],
    });

    tunnelToken = await getCloudflareTunnelToken(env, tunnelId);
    dnsTarget = `${tunnelId}.cfargotunnel.com`;
    dnsRecord = await upsertTunnelDnsRecord(
      env,
      input.cloudflareZoneId,
      input.publicHostname,
      dnsTarget,
      existing?.dnsRecordId ?? null,
    );
    createdResources.dnsRecordId = dnsRecord.id ?? null;

    if (input.accessProtected) {
      if (!accessPolicyId) {
        const createdPolicy = await createAccessPolicy(
          env,
          `${tunnelName} EdgeIntel service token policy`,
        );
        accessPolicyId = createdPolicy.id ?? null;
        createdResources.accessPolicyId = accessPolicyId;
      }

      if (!accessPolicyId) {
        throw new Error("Cloudflare did not return an Access policy ID.");
      }

      if (!accessServiceTokenId) {
        const createdServiceToken = await createAccessServiceToken(
          env,
          `${tunnelName} EdgeIntel connector token`,
        );
        accessServiceTokenId = createdServiceToken.id ?? null;
        accessClientId = createdServiceToken.client_id;
        accessClientSecret = createdServiceToken.client_secret;
        createdResources.accessServiceTokenId = accessServiceTokenId;
      } else if (options.rotateAccessTokens || !accessClientId || !accessClientSecret) {
        const rotated = await rotateAccessServiceToken(env, accessServiceTokenId);
        accessClientId = rotated.client_id;
        accessClientSecret = rotated.client_secret;
      }

      if (!accessServiceTokenId || !accessClientId || !accessClientSecret) {
        throw new Error("Cloudflare did not return the Access service token credentials.");
      }

      if (!accessAppId) {
        const createdApp = await createAccessApplication(env, {
          name: `${tunnelName} EdgeIntel route`,
          publicHostname: input.publicHostname,
          policyId: accessPolicyId,
        });
        accessAppId = createdApp.id ?? null;
        createdResources.accessAppId = accessAppId;
      } else {
        const updatedApp = await updateAccessApplication(env, accessAppId, {
          name: `${tunnelName} EdgeIntel route`,
          publicHostname: input.publicHostname,
          policyId: accessPolicyId,
        });
        accessAppId = updatedApp.id ?? accessAppId;
      }
    } else {
      if (existing?.accessAppId) {
        await deleteAccessApplication(env, existing.accessAppId);
        accessAppId = null;
      }
      if (existing?.accessPolicyId) {
        await deleteAccessPolicy(env, existing.accessPolicyId);
        accessPolicyId = null;
      }
      if (existing?.accessServiceTokenId) {
        await deleteAccessServiceToken(env, existing.accessServiceTokenId);
        accessServiceTokenId = null;
      }
      accessClientId = undefined;
      accessClientSecret = undefined;
    }

    return {
      cloudflareTunnelId: tunnelId,
      cloudflareTunnelName: tunnelName,
      cloudflareZoneId: input.cloudflareZoneId,
      publicHostname: input.publicHostname,
      localServiceUrl: input.localServiceUrl,
      accessProtected: input.accessProtected,
      accessAppId,
      accessPolicyId,
      accessServiceTokenId,
      dnsRecordId: dnsRecord.id ?? existing?.dnsRecordId ?? null,
      status: "ready",
      connectorStatus:
        input.connectorStatus === "connected"
          ? "connected"
          : "awaiting_connector",
      metadata: {
        ...input.metadata,
        dnsTarget,
        provisionedAt: nowIso(),
        accessProtected: input.accessProtected,
      },
      secrets: {
        tunnelToken,
        accessClientId,
        accessClientSecret,
      },
    };
  } catch (error) {
    if (!existing) {
      const dnsRecordId = dnsRecord?.id ?? null;
      if (createdResources.accessAppId) {
        await deleteAccessApplication(env, createdResources.accessAppId).catch(() => {});
      }
      if (createdResources.accessPolicyId) {
        await deleteAccessPolicy(env, createdResources.accessPolicyId).catch(() => {});
      }
      if (createdResources.accessServiceTokenId) {
        await deleteAccessServiceToken(env, createdResources.accessServiceTokenId).catch(
          () => {},
        );
      }
      if (dnsRecordId) {
        await deleteDnsRecord(env, input.cloudflareZoneId, dnsRecordId).catch(() => {});
      }
      if (tunnelId) {
        await deleteCloudflareTunnel(env, tunnelId).catch(() => {});
      }
    }

    throw error;
  }
}

export async function destroyTunnelResources(
  env: Env,
  record: PersistedTunnelRecord,
): Promise<void> {
  if (record.accessAppId) {
    await deleteAccessApplication(env, record.accessAppId);
  }
  if (record.accessPolicyId) {
    await deleteAccessPolicy(env, record.accessPolicyId);
  }
  if (record.accessServiceTokenId) {
    await deleteAccessServiceToken(env, record.accessServiceTokenId);
  }
  if (record.dnsRecordId && record.cloudflareZoneId) {
    await deleteDnsRecord(env, record.cloudflareZoneId, record.dnsRecordId);
  }
  if (record.cloudflareTunnelId) {
    await deleteCloudflareTunnel(env, record.cloudflareTunnelId);
  }
}

export async function testTunnelConnection(
  env: Env,
  record: PersistedTunnelRecord,
  secrets: TunnelSecretPayload | null,
  provider: PersistedProviderSetting | null,
  body: TunnelTestRequestBody,
): Promise<TunnelConnectionTestResult> {
  const startedAt = Date.now();
  const details: Record<string, unknown> = {
    providerCode: provider?.providerCode ?? null,
    tunnelId: record.cloudflareTunnelId,
  };

  let tunnelStatus = "unknown";
  let connectionCount = 0;

  if (record.cloudflareTunnelId) {
    try {
      const tunnel = await getCloudflareTunnel(env, record.cloudflareTunnelId);
      tunnelStatus = tunnel.status ?? "unknown";
      connectionCount = Array.isArray(tunnel.connections)
        ? tunnel.connections.length
        : 0;
      details.controlPlane = {
        status: tunnelStatus,
        connectionCount,
        remoteConfig: tunnel.remote_config ?? null,
      };
    } catch (error) {
      details.controlPlane = {
        error: error instanceof Error ? error.message : "Cloudflare control-plane lookup failed.",
      };
    }
  }

  const includeRuntimeProbe = body.includeRuntimeProbe !== false;
  const publicUrl = `https://${record.publicHostname}${buildRuntimeProbePath(provider)}`;

  if (!includeRuntimeProbe) {
    return {
      status: tunnelStatus === "healthy" || tunnelStatus === "degraded" ? "passed" : "warning",
      message: "Tunnel control-plane lookup completed without a runtime probe.",
      latencyMs: Date.now() - startedAt,
      publicHostname: record.publicHostname,
      tunnelId: record.cloudflareTunnelId,
      details,
      testedAt: nowIso(),
    };
  }

  const runtimeStartedAt = Date.now();
  const response = await fetch(publicUrl, {
    method: "GET",
    headers: Object.fromEntries(
      Object.entries({
        "CF-Access-Client-Id": secrets?.accessClientId,
        "CF-Access-Client-Secret": secrets?.accessClientSecret,
      }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  });
  const bodyText = await response.text();
  const runtimeLatencyMs = Date.now() - runtimeStartedAt;
  details.runtime = {
    url: publicUrl,
    status: response.status,
    ok: response.ok,
    bodyPreview: bodyText.slice(0, 300),
    latencyMs: runtimeLatencyMs,
  };

  let status: TunnelTestStatus;
  let message: string;

  if (response.status >= 200 && response.status < 400) {
    status = connectionCount > 0 || tunnelStatus === "healthy" ? "passed" : "warning";
    message = "Tunnel runtime probe reached the public hostname successfully.";
  } else if (response.status === 404) {
    status = "warning";
    message =
      "Tunnel public hostname is reachable, but the probe path returned 404. The route is alive, but the target endpoint may not be OpenAI-compatible.";
  } else if (response.status === 401 || response.status === 403) {
    status = "failed";
    message =
      "Tunnel runtime probe was blocked by Access or upstream auth. Check service token headers and Access application settings.";
  } else {
    status = "failed";
    message = `Tunnel runtime probe failed with status ${response.status}.`;
  }

  return {
    status,
    message,
    latencyMs: Date.now() - startedAt,
    publicHostname: record.publicHostname,
    tunnelId: record.cloudflareTunnelId,
    details,
    testedAt: nowIso(),
  };
}
