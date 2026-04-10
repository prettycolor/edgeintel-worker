export type ProviderKind =
  | "hosted-api-key"
  | "hosted-oauth"
  | "local-direct"
  | "local-gateway";

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

export interface ProviderSettingView {
  id: string;
  kind: ProviderKind;
  providerCode: string;
  displayName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  usesAiGateway: boolean;
  oauthConnected: boolean;
  status: ProviderStatus;
  secretConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: ProviderTestStatus | null;
  lastTestResult: ProviderConnectionTestResult | null;
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

export interface ControlPlaneHealthSnapshot {
  workerPackage: string;
  workspaceMode: "monorepo";
  providerRouteCount: number;
  tunnelRouteCount: number;
}
