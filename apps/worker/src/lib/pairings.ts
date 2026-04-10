import { timingSafeEqual } from "node:crypto";
import type { Env } from "../env";
import type {
  ConnectorSessionView,
  PairingSecretView,
  PairingSessionView,
  PersistedPairingSession,
  PersistedTunnelRecord,
  TunnelSecretPayload,
} from "../types";
import { buildTunnelConnectorBootstrap } from "./tunnels";
import { safeJsonParse } from "./utils";

const DEFAULT_PAIRING_TTL_SECONDS = 15 * 60;
const DEFAULT_CONNECTOR_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_PAIRING_TTL_SECONDS = 60;
const MAX_PAIRING_TTL_SECONDS = 24 * 60 * 60;
const MIN_CONNECTOR_TTL_SECONDS = 60 * 60;
const MAX_CONNECTOR_TTL_SECONDS = 90 * 24 * 60 * 60;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function digestToken(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function randomOpaqueToken(byteLength = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Buffer.from(bytes).toString("base64url");
}

export async function hashOpaqueToken(value: string): Promise<string> {
  const digest = await digestToken(value);
  return Buffer.from(digest).toString("base64url");
}

export async function verifyOpaqueToken(
  token: string,
  expectedHash: string | null | undefined,
): Promise<boolean> {
  if (!expectedHash) return false;
  const actual = Buffer.from(await digestToken(token));
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

export async function issuePairingSecret(
  env: Env,
  requestedSeconds?: number | null,
): Promise<{
  pairingToken: string;
  pairingTokenHash: string;
  expiresAt: string;
}> {
  const ttlSeconds = clamp(
    requestedSeconds ?? Number(env.PAIRING_TOKEN_TTL_SECONDS ?? DEFAULT_PAIRING_TTL_SECONDS),
    MIN_PAIRING_TTL_SECONDS,
    MAX_PAIRING_TTL_SECONDS,
    DEFAULT_PAIRING_TTL_SECONDS,
  );
  const pairingToken = randomOpaqueToken(24);
  return {
    pairingToken,
    pairingTokenHash: await hashOpaqueToken(pairingToken),
    expiresAt: addSeconds(ttlSeconds),
  };
}

export async function issueConnectorSession(
  env: Env,
): Promise<{
  connectorToken: string;
  connectorTokenHash: string;
  expiresAt: string;
}> {
  const ttlSeconds = clamp(
    Number(env.CONNECTOR_TOKEN_TTL_SECONDS ?? DEFAULT_CONNECTOR_TTL_SECONDS),
    MIN_CONNECTOR_TTL_SECONDS,
    MAX_CONNECTOR_TTL_SECONDS,
    DEFAULT_CONNECTOR_TTL_SECONDS,
  );
  const connectorToken = randomOpaqueToken(32);
  return {
    connectorToken,
    connectorTokenHash: await hashOpaqueToken(connectorToken),
    expiresAt: addSeconds(ttlSeconds),
  };
}

export function serializePairingSession(
  record: PersistedPairingSession,
): PairingSessionView {
  return {
    id: record.id,
    tunnelId: record.tunnelId,
    issuedBySubject: record.issuedBySubject,
    issuedByEmail: record.issuedByEmail,
    status: record.status,
    connectorName: record.connectorName,
    connectorVersion: record.connectorVersion,
    exchangeCount: record.exchangeCount,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    exchangedAt: record.exchangedAt,
    connectorExpiresAt: record.connectorExpiresAt,
    lastSeenAt: record.lastSeenAt,
    revokedAt: record.revokedAt,
    expiredAt: record.expiredAt,
    metadata: safeJsonParse<Record<string, unknown>>(record.metadataJson, {}),
  };
}

export function buildPairingSecretView(
  request: Request,
  tunnel: Pick<PersistedTunnelRecord, "id" | "publicHostname">,
  pairing: Pick<PersistedPairingSession, "id" | "expiresAt">,
  pairingToken: string,
): PairingSecretView {
  const origin = new URL(request.url).origin;
  return {
    pairingId: pairing.id,
    pairingToken,
    tunnelId: tunnel.id,
    publicHostname: tunnel.publicHostname,
    apiBase: origin,
    exchangeEndpoint: `${origin}/api/pairings/${pairing.id}/exchange`,
    expiresAt: pairing.expiresAt,
    instructions: [
      "Paste this one-time pairing token into the EdgeIntel connector or desktop app.",
      "The connector exchanges it for scoped tunnel bootstrap and its own bearer token.",
      "This token cannot be recovered after you close the pairing sheet.",
    ],
  };
}

export function buildConnectorSessionView(
  pairingId: string,
  token: string,
  expiresAt: string,
): ConnectorSessionView {
  return {
    type: "bearer",
    pairingId,
    token,
    expiresAt,
  };
}

export function buildConnectorBootstrapResponse(
  record: Pick<
    PersistedTunnelRecord,
    | "publicHostname"
    | "localServiceUrl"
    | "cloudflareTunnelId"
    | "cloudflareTunnelName"
  >,
  secrets: TunnelSecretPayload | null,
) {
  return buildTunnelConnectorBootstrap(record, secrets);
}
