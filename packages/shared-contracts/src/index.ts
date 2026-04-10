export type ProviderKind =
  | "hosted-api-key"
  | "hosted-oauth"
  | "local-direct"
  | "local-gateway";
export type ProviderAuthStrategy =
  | "api-key"
  | "oauth"
  | "workers-binding"
  | "none";
export type ProviderSecretField =
  | "apiKey"
  | "gatewayToken"
  | "accessClientId"
  | "accessClientSecret"
  | "oauthAccessToken"
  | "oauthRefreshToken";

export type ProviderStatus = "draft" | "ready" | "error" | "disabled";
export type ProviderTestStatus = "passed" | "failed" | "warning";
export type TunnelStatus = "draft" | "provisioning" | "ready" | "error" | "deleting";
export type TunnelConnectorStatus =
  | "unpaired"
  | "awaiting_connector"
  | "connected"
  | "degraded"
  | "offline";
export type TunnelTestStatus = "passed" | "failed" | "warning";
export type PairingSessionStatus = "pending" | "active" | "revoked" | "expired";
export type DesktopConnectorLifecycle =
  | "unconfigured"
  | "pairing"
  | "paired"
  | "ready"
  | "installing_cloudflared"
  | "starting"
  | "running"
  | "stopping"
  | "error";
export type DesktopCloudflaredStatus = "missing" | "ready" | "installing" | "error";
export type DesktopRuntimeStatus = "stopped" | "running" | "degraded" | "error";
export type DesktopLogLevel = "info" | "warning" | "error";
export type DesktopLogScope =
  | "app"
  | "pairing"
  | "cloudflared"
  | "runtime"
  | "heartbeat"
  | "local-probe"
  | "updater";

export interface ProviderConnectionTestResult {
  status: ProviderTestStatus;
  message: string;
  latencyMs: number;
  transport: string;
  targetUrl: string | null;
  providerCode: string;
  model: string | null;
  details: Record<string, unknown>;
  testedAt: string;
}

export interface TunnelConnectionTestResult {
  status: TunnelTestStatus;
  message: string;
  latencyMs: number;
  publicHostname: string | null;
  tunnelId: string | null;
  details: Record<string, unknown>;
  testedAt: string;
}

export interface ProviderCapabilityAuthOption {
  strategy: ProviderAuthStrategy;
  label: string;
  description: string;
  requiredSecretFields: ProviderSecretField[];
  optionalSecretFields: ProviderSecretField[];
  recommended: boolean;
}

export interface ProviderCapabilityView {
  providerCode: string;
  title: string;
  category: "frontier" | "self-hosted" | "gateway" | "first-party";
  description: string;
  supportedKinds: ProviderKind[];
  recommendedKind: ProviderKind;
  defaultBaseUrl: string | null;
  modelPlaceholder: string | null;
  supportsAiGateway: boolean;
  authOptions: ProviderCapabilityAuthOption[];
  connectionTest: {
    transport: string;
    summary: string;
    billable: boolean;
  };
  notes: string[];
}

export interface ProviderSecretHealthView {
  authStrategy: ProviderAuthStrategy;
  requiredSecretFields: ProviderSecretField[];
  optionalSecretFields: ProviderSecretField[];
  configuredSecretFields: ProviderSecretField[];
  missingRequiredSecretFields: ProviderSecretField[];
  requiresAccessHeaders: boolean;
  accessHeadersConfigured: boolean;
  canRunConnectionTest: boolean;
  summary: string;
}

export interface ProviderSettingView {
  id: string;
  kind: ProviderKind;
  providerCode: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  authStrategy: ProviderAuthStrategy;
  usesAiGateway: boolean;
  oauthConnected: boolean;
  status: ProviderStatus;
  secretConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: ProviderTestStatus | null;
  lastTestResult: ProviderConnectionTestResult | null;
  capability: ProviderCapabilityView;
  secretHealth: ProviderSecretHealthView;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface OperatorSessionView {
  authenticated: boolean;
  authStrategy: "cloudflare-access";
  email: string | null;
  identity: string | null;
  name: string | null;
  groups: string[];
}

export interface PairingSessionView {
  id: string;
  tunnelId: string;
  issuedBySubject: string;
  issuedByEmail: string | null;
  status: PairingSessionStatus;
  connectorName: string | null;
  connectorVersion: string | null;
  exchangeCount: number;
  issuedAt: string;
  expiresAt: string;
  exchangedAt: string | null;
  connectorExpiresAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  expiredAt: string | null;
  metadata: Record<string, unknown>;
}

export interface PairingSecretView {
  pairingId: string;
  pairingToken: string;
  tunnelId: string;
  publicHostname: string;
  apiBase: string;
  exchangeEndpoint: string;
  expiresAt: string;
  instructions: string[];
}

export interface ConnectorSessionView {
  type: "bearer";
  pairingId: string;
  token: string;
  expiresAt: string;
}

export interface CloudflareZoneView {
  id: string;
  name: string;
  status: string | null;
  paused: boolean;
  planName: string | null;
  accountName: string | null;
  isDefault: boolean;
}

export interface HostnameConflictView {
  id: string | null;
  type: string;
  name: string;
  content: string | null;
  proxied: boolean | null;
}

export interface HostnameValidationResult {
  status: "valid" | "warning" | "invalid";
  hostname: string;
  zone: CloudflareZoneView | null;
  matchedBy: "provided-zone" | "suffix-match" | "default-zone" | "none";
  suggestedZoneId: string | null;
  suggestedTunnelName: string;
  conflicts: HostnameConflictView[];
  existingTunnelRecordConflict: boolean;
  message: string;
}

export interface ControlPlaneHealthSnapshot {
  workerPackage: string;
  workspaceMode: "monorepo";
  providerRouteCount: number;
  tunnelRouteCount: number;
}

export interface PairingExchangeResponse {
  pairing: PairingSessionView;
  tunnel: TunnelRecordView;
  bootstrap: TunnelBootstrapPayload;
  connectorSession: ConnectorSessionView;
}

export interface DesktopConnectorSettingsInput {
  apiBase: string;
  pairingId: string;
  pairingToken: string;
  connectorName: string;
  autoLaunchOnLogin: boolean;
}

export interface DesktopCloudflaredState {
  status: DesktopCloudflaredStatus;
  binaryPath: string | null;
  version: string | null;
  source: "managed" | "system" | "homebrew" | null;
  releaseTag: string | null;
  assetName: string | null;
  checksumVerified: boolean;
  message: string | null;
  lastCheckedAt: string | null;
}

export interface DesktopLocalProbeState {
  url: string | null;
  reachable: boolean | null;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
  testedAt: string | null;
}

export interface DesktopTunnelBootstrapView {
  publicHostname: string | null;
  localServiceUrl: string | null;
  cloudflareTunnelId: string | null;
  cloudflareTunnelName: string | null;
  tunnelTokenPresent: boolean;
  accessHeadersPresent: boolean;
  notes: string[];
  command: string | null;
  launchArgs: string[] | null;
  connectorTokenExpiresAt: string | null;
}

export interface DesktopConnectorRuntimeState {
  status: DesktopRuntimeStatus;
  cloudflaredPid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastHeartbeatAt: string | null;
  lastHeartbeatNote: string | null;
}

export interface DesktopConnectorLogEntry {
  id: string;
  timestamp: string;
  level: DesktopLogLevel;
  scope: DesktopLogScope;
  message: string;
  detail: string | null;
}

export interface DesktopConnectorSnapshot {
  lifecycle: DesktopConnectorLifecycle;
  connectorName: string;
  platform: string;
  appVersion: string;
  apiBase: string | null;
  pairingId: string | null;
  pairedAt: string | null;
  autoLaunchOnLogin: boolean;
  publicHostname: string | null;
  pairing: PairingSessionView | null;
  bootstrap: DesktopTunnelBootstrapView | null;
  cloudflared: DesktopCloudflaredState;
  localProbe: DesktopLocalProbeState;
  runtime: DesktopConnectorRuntimeState;
  lastError: string | null;
  logs: DesktopConnectorLogEntry[];
}

export interface DesktopPairingResult {
  snapshot: DesktopConnectorSnapshot;
  pairing: PairingSessionView;
  bootstrap: DesktopTunnelBootstrapView;
  connectorSessionExpiresAt: string | null;
}

export interface DesktopActionResult {
  snapshot: DesktopConnectorSnapshot;
}

export interface DesktopConnectorEventPayload {
  snapshot: DesktopConnectorSnapshot;
}

export interface DesktopConnectorLogEventPayload {
  entry: DesktopConnectorLogEntry;
}

export const EDGEINTEL_DESKTOP_IPC = {
  getSnapshot: "edgeintel-desktop:get-snapshot",
  pairConnector: "edgeintel-desktop:pair-connector",
  refreshCloudflared: "edgeintel-desktop:refresh-cloudflared",
  installCloudflared: "edgeintel-desktop:install-cloudflared",
  testLocalService: "edgeintel-desktop:test-local-service",
  startRuntime: "edgeintel-desktop:start-runtime",
  stopRuntime: "edgeintel-desktop:stop-runtime",
  updatePreferences: "edgeintel-desktop:update-preferences",
  resetConfiguration: "edgeintel-desktop:reset-configuration",
  onSnapshot: "edgeintel-desktop:on-snapshot",
  onLog: "edgeintel-desktop:on-log",
} as const;
