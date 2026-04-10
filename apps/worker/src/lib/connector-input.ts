import type {
  PairingCreateRequestBody,
  PairingExchangeRequestBody,
  TunnelConnectorStatus,
  TunnelHeartbeatRequestBody,
} from "../types";

const VALID_CONNECTOR_STATUSES: TunnelConnectorStatus[] = [
  "unpaired",
  "awaiting_connector",
  "connected",
  "degraded",
  "offline",
];

const MAX_PAIRING_TOKEN_LENGTH = 2048;
const MAX_CONNECTOR_NAME_LENGTH = 96;
const MAX_CONNECTOR_VERSION_LENGTH = 64;
const MAX_CONNECTOR_MODEL_LENGTH = 160;
const MAX_NOTE_LENGTH = 280;
const MAX_LABEL_LENGTH = 96;
const MAX_TUNNEL_ID_LENGTH = 128;

function sanitizeOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string when provided.`);
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new Error(`${field} contains unsupported control characters.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

export function normalizePairingCreateInput(body: PairingCreateRequestBody): {
  tunnelId: string;
  expiresInSeconds: number | null;
  label: string | null;
  note: string | null;
} {
  const tunnelId = sanitizeOptionalText(body.tunnelId, "tunnelId", MAX_TUNNEL_ID_LENGTH);
  if (!tunnelId) {
    throw new Error("tunnelId is required.");
  }

  const expiresInSeconds =
    body.expiresInSeconds === null || body.expiresInSeconds === undefined
      ? null
      : typeof body.expiresInSeconds === "number" && Number.isFinite(body.expiresInSeconds)
        ? body.expiresInSeconds
        : (() => {
            throw new Error("expiresInSeconds must be a number when provided.");
          })();

  return {
    tunnelId,
    expiresInSeconds,
    label: sanitizeOptionalText(body.label, "label", MAX_LABEL_LENGTH),
    note: sanitizeOptionalText(body.note, "note", MAX_NOTE_LENGTH),
  };
}

export function normalizePairingExchangeInput(body: PairingExchangeRequestBody): {
  pairingToken: string;
  connectorName: string | null;
  connectorVersion: string | null;
  note: string | null;
} {
  if (typeof body.pairingToken !== "string") {
    throw new Error("pairingToken is required.");
  }

  const pairingToken = body.pairingToken.trim();
  if (!pairingToken) {
    throw new Error("pairingToken is required.");
  }
  if (pairingToken.length > MAX_PAIRING_TOKEN_LENGTH) {
    throw new Error(
      `pairingToken must be ${MAX_PAIRING_TOKEN_LENGTH} characters or fewer.`,
    );
  }

  return {
    pairingToken,
    connectorName: sanitizeOptionalText(
      body.connectorName,
      "connectorName",
      MAX_CONNECTOR_NAME_LENGTH,
    ),
    connectorVersion: sanitizeOptionalText(
      body.connectorVersion,
      "connectorVersion",
      MAX_CONNECTOR_VERSION_LENGTH,
    ),
    note: sanitizeOptionalText(body.note, "note", MAX_NOTE_LENGTH),
  };
}

export function normalizeTunnelHeartbeatInput(body: TunnelHeartbeatRequestBody): {
  connectorStatus: TunnelConnectorStatus;
  version: string | null;
  localServiceReachable: boolean | null;
  model: string | null;
  note: string | null;
} {
  const connectorStatus = body.connectorStatus ?? "connected";
  if (!VALID_CONNECTOR_STATUSES.includes(connectorStatus)) {
    throw new Error(
      "connectorStatus must be one of unpaired, awaiting_connector, connected, degraded, or offline.",
    );
  }

  if (
    body.localServiceReachable !== undefined &&
    body.localServiceReachable !== null &&
    typeof body.localServiceReachable !== "boolean"
  ) {
    throw new Error("localServiceReachable must be a boolean when provided.");
  }

  return {
    connectorStatus,
    version: sanitizeOptionalText(
      body.version,
      "version",
      MAX_CONNECTOR_VERSION_LENGTH,
    ),
    localServiceReachable: body.localServiceReachable ?? null,
    model: sanitizeOptionalText(body.model, "model", MAX_CONNECTOR_MODEL_LENGTH),
    note: sanitizeOptionalText(body.note, "note", MAX_NOTE_LENGTH),
  };
}
