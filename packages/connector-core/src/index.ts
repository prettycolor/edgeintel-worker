import type {
  PairingExchangeResponse,
  TunnelConnectorStatus,
} from "@edgeintel/shared-contracts";
import { spawnSync } from "node:child_process";

export interface ConnectorCliConfig {
  apiBase: string;
  pairingId: string;
  pairingToken: string;
  cloudflaredBin: string;
  connectorName: string;
  connectorVersion?: string | null;
  once: boolean;
  dryRun: boolean;
  heartbeatIntervalMs: number;
}

export interface LocalServiceProbeResult {
  url: string;
  reachable: boolean;
  status: number | null;
  latencyMs: number;
  testedAt: string;
  error?: string;
}

export interface ConnectorHeartbeatPayload {
  connectorStatus: TunnelConnectorStatus;
  version: string | null;
  localServiceReachable: boolean;
  model: string | null;
  note: string;
}

export function normalizeApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, "");
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): ConnectorCliConfig {
  const args: ConnectorCliConfig = {
    apiBase: env.EDGEINTEL_API_BASE || "",
    pairingId: env.EDGEINTEL_PAIRING_ID || "",
    pairingToken: env.EDGEINTEL_PAIRING_TOKEN || "",
    cloudflaredBin: env.EDGEINTEL_CLOUDFLARED_BIN || "cloudflared",
    connectorName: env.EDGEINTEL_CONNECTOR_NAME || "edgeintel-connector-cli",
    connectorVersion: env.EDGEINTEL_CONNECTOR_VERSION || null,
    once: false,
    dryRun: false,
    heartbeatIntervalMs: Number(env.EDGEINTEL_HEARTBEAT_MS || "30000"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--api-base" && next) {
      args.apiBase = next;
      index += 1;
      continue;
    }

    if (arg === "--pairing-id" && next) {
      args.pairingId = next;
      index += 1;
      continue;
    }

    if (arg === "--pairing-token" && next) {
      args.pairingToken = next;
      index += 1;
      continue;
    }

    if (arg === "--cloudflared-bin" && next) {
      args.cloudflaredBin = next;
      index += 1;
      continue;
    }

    if (arg === "--connector-name" && next) {
      args.connectorName = next;
      index += 1;
      continue;
    }

    if (arg === "--connector-version" && next) {
      args.connectorVersion = next;
      index += 1;
      continue;
    }

    if (arg === "--once") {
      args.once = true;
      continue;
    }

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

export function requireConnectorConfig(config: ConnectorCliConfig): void {
  if (!config.apiBase) {
    throw new Error("Missing --api-base or EDGEINTEL_API_BASE.");
  }
  if (!config.pairingId) {
    throw new Error("Missing --pairing-id or EDGEINTEL_PAIRING_ID.");
  }
  if (!config.pairingToken) {
    throw new Error("Missing --pairing-token or EDGEINTEL_PAIRING_TOKEN.");
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export function getCloudflaredVersion(bin: string): string | null {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || result.stderr.trim() || "unknown";
}

export async function probeLocalService(url: string): Promise<LocalServiceProbeResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
    });
    return {
      url,
      reachable: response.status < 500,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      testedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Local probe failed.",
    };
  }
}

export async function exchangePairing(input: {
  apiBase: string;
  pairingId: string;
  pairingToken: string;
  connectorName: string;
  connectorVersion?: string | null;
  note?: string | null;
}): Promise<PairingExchangeResponse> {
  const apiBase = normalizeApiBase(input.apiBase);
  const payload = await fetchJson<PairingExchangeResponse>(
    `${apiBase}/api/pairings/${encodeURIComponent(input.pairingId)}/exchange`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pairingToken: input.pairingToken,
        connectorName: input.connectorName,
        connectorVersion: input.connectorVersion ?? null,
        note: input.note ?? null,
      }),
    },
  );

  if (!payload.bootstrap?.tunnelTokenPresent) {
    throw new Error("Pairing exchange did not return a tunnel token.");
  }

  if (!payload.connectorSession?.token) {
    throw new Error("Pairing exchange did not return a connector bearer token.");
  }

  return payload;
}

export async function sendHeartbeat(input: {
  apiBase: string;
  tunnelId: string;
  pairingId: string;
  connectorToken: string;
  payload: ConnectorHeartbeatPayload;
}): Promise<void> {
  const apiBase = normalizeApiBase(input.apiBase);
  await fetchJson(
    `${apiBase}/api/tunnels/${encodeURIComponent(input.tunnelId)}/heartbeat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.connectorToken}`,
        "X-EdgeIntel-Pairing-Id": input.pairingId,
      },
      body: JSON.stringify(input.payload),
    },
  );
}

export function buildHeartbeatPayload(input: {
  probe: LocalServiceProbeResult;
  cloudflaredVersion: string | null;
  model: string | null;
  noteWhenReachable?: string;
  noteWhenUnreachable?: string;
}): ConnectorHeartbeatPayload {
  const reachable = input.probe.reachable;
  return {
    connectorStatus: reachable ? "connected" : "degraded",
    version: input.cloudflaredVersion,
    localServiceReachable: reachable,
    model: input.model,
    note: reachable
      ? input.noteWhenReachable ?? "Local service reachable."
      : input.noteWhenUnreachable ?? input.probe.error ?? "Local service probe failed.",
  };
}
