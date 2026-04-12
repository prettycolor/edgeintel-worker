export type ScanJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_failures"
  | "failed";

export type ScanRunStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_failures"
  | "failed";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type ExportFormat = "markdown" | "json" | "terraform" | "cf-api";
export type RecommendationPhase = 1 | 2 | 3 | 4;
export type InferenceRoute = "hosted" | "local-direct" | "local-gateway";
export type AiBriefProfile = "executive" | "technical" | "upgrade-planner";
export type InferenceTransport =
  | "ai-gateway-binding"
  | "ai-gateway-fetch"
  | "direct-openai-compatible";
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
export type OperatorSessionMode = "access" | "dev-bypass";
export type HostnameValidationStatus = "valid" | "warning" | "invalid";
export type TunnelEventLevel = "info" | "warning" | "error";

export interface ScanRequestBody {
  domain?: string;
  domains?: string[];
}

export interface DomainWatchRequestBody {
  intervalHours?: number;
}

export interface AiBriefRequestBody {
  route?: InferenceRoute;
  profile?: AiBriefProfile;
  provider?: string;
  model?: string;
  instruction?: string;
}

export interface ProviderSecretPayload {
  apiKey?: string;
  gatewayToken?: string;
  accessClientId?: string;
  accessClientSecret?: string;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  [key: string]: string | undefined;
}

export interface ProviderSettingsRequestBody {
  kind?: ProviderKind;
  providerCode?: string;
  displayName?: string;
  baseUrl?: string | null;
  defaultModel?: string | null;
  authStrategy?: ProviderAuthStrategy;
  usesAiGateway?: boolean;
  oauthConnected?: boolean;
  status?: ProviderStatus;
  metadata?: Record<string, unknown>;
  secret?: ProviderSecretPayload | null;
}

export interface ProviderTestRequestBody {
  persistResult?: boolean;
}

export interface TunnelSecretPayload {
  tunnelToken?: string;
  accessClientId?: string;
  accessClientSecret?: string;
  [key: string]: string | undefined;
}

export interface TunnelSettingsRequestBody {
  providerSettingId?: string | null;
  cloudflareZoneId?: string | null;
  publicHostname?: string;
  tunnelName?: string;
  localServiceUrl?: string;
  accessProtected?: boolean;
  status?: TunnelStatus;
  connectorStatus?: TunnelConnectorStatus;
  metadata?: Record<string, unknown>;
}

export interface TunnelTestRequestBody {
  persistResult?: boolean;
  includeRuntimeProbe?: boolean;
}

export interface TunnelHeartbeatRequestBody {
  connectorStatus?: TunnelConnectorStatus;
  version?: string;
  localServiceReachable?: boolean;
  model?: string | null;
  note?: string | null;
}

export interface PairingCreateRequestBody {
  tunnelId?: string;
  expiresInSeconds?: number | null;
  label?: string | null;
  note?: string | null;
}

export interface PairingExchangeRequestBody {
  pairingToken?: string;
  connectorName?: string | null;
  connectorVersion?: string | null;
  note?: string | null;
}

export interface HostnameValidationRequestBody {
  publicHostname?: string;
  cloudflareZoneId?: string | null;
  tunnelId?: string | null;
}

export interface ScanTarget {
  domain: string;
  scanRunId: string;
}

export interface ScanWorkflowParams {
  jobId: string;
  targets: ScanTarget[];
}

export interface ScanQueueMessage {
  jobId: string;
  scanRunId: string;
  domain: string;
  queuedAt: string;
}

export interface ArtifactQueueMessage {
  jobId: string;
  scanRunId: string;
  domain: string;
  finalUrl: string | null;
  queuedAt: string;
}

export interface DnsRecord {
  name: string;
  type: string;
  data: string;
  ttl?: number;
}

export interface DnsQueryEvidence {
  type: string;
  ok: boolean;
  recordCount: number;
  durationMs: number;
  attempts: number;
  error?: string;
}

export interface TtlSummary {
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface DnsEvidence {
  queryResults: DnsQueryEvidence[];
  observedRecordTypes: string[];
  ttlSummary: TtlSummary;
}

export interface DnsProfile {
  nameservers: DnsRecord[];
  a: DnsRecord[];
  aaaa: DnsRecord[];
  cname: DnsRecord[];
  mx: DnsRecord[];
  txt: DnsRecord[];
  evidence: DnsEvidence;
}

export interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

export interface HttpProbe {
  attemptedUrl: string;
  finalUrl: string | null;
  status: number | null;
  ok: boolean;
  protocolUsed: "https" | "http" | "unknown";
  redirectChain: RedirectHop[];
  headers: Record<string, string>;
  htmlPreview: string | null;
  pageTitle: string | null;
  apiHints: string[];
  authHints: string[];
  staticAssetHints: string[];
  contentType: string | null;
  contentLength: number | null;
  attempts: Array<{
    url: string;
    scheme: "https" | "http";
    durationMs: number;
    status: number | null;
    ok: boolean;
    finalUrl: string | null;
    error?: string;
  }>;
  surfaceClassification: {
    isHtml: boolean;
    isDenied: boolean;
    redirectCount: number;
    hasApiHints: boolean;
    hasAuthHints: boolean;
  };
  errors: string[];
  error?: string;
}

export interface ProviderSignal {
  provider: string | null;
  confidence: number;
  evidence: string[];
  category?: string | null;
  methods?: string[];
  providerType?: "cloud" | "shared" | "dedicated" | "unknown";
  liveDashboard?: boolean;
}

export interface ScanSummary {
  domain: string;
  dnsProvider: ProviderSignal;
  edgeProvider: ProviderSignal;
  wafProvider: ProviderSignal;
  originProvider?: ProviderSignal;
  originHints: string[];
  apiSurfaceDetected: boolean;
  authSurfaceDetected: boolean;
  cacheSignals: string[];
  missingSecurityHeaders: string[];
  finalUrl: string | null;
}

export interface CommercialScorecard {
  score: number;
  status: "strong" | "moderate" | "weak";
  summary: string;
}

export interface CommercialMotion {
  productCode: string;
  title: string;
  reason: string;
  priority: RecommendationPriority;
  phase: RecommendationPhase;
  evidenceRefs: string[];
}

export interface CommercialBriefView {
  domain: string;
  generatedAt: string;
  posture: {
    finalUrl: string | null;
    dnsProvider: ProviderSignal;
    edgeProvider: ProviderSignal;
    wafProvider: ProviderSignal;
    originProvider: ProviderSignal | null;
    authSurfaceDetected: boolean;
    apiSurfaceDetected: boolean;
    missingSecurityHeaders: string[];
  };
  cloudflareFit: CommercialScorecard;
  accessHardening: CommercialScorecard;
  latencyOpportunity: CommercialScorecard;
  resilienceOpportunity: CommercialScorecard;
  originExposure: {
    risk: "low" | "medium" | "high";
    confidence: number;
    summary: string;
    hints: string[];
  };
  whyNow: string[];
  customerNarrative: string;
  operatorNarrative: string;
  migrationNarrative: string;
  expansionCandidates: CommercialMotion[];
  markdown: string;
}

export interface ScanModuleResult<T> {
  ok: boolean;
  attempts: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
  data: T;
}

export interface Finding {
  id: string;
  category: string;
  severity: Severity;
  code: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  productCode: string;
  title: string;
  rationale: string;
  priority: RecommendationPriority;
  confidence: number;
  phase: RecommendationPhase;
  sequence: number;
  blockedBy: string[];
  evidenceRefs: string[];
  expectedImpact: string;
  technicalSummary: string;
  executiveSummary: string;
  prerequisites: string[];
  exportPayload: Record<string, unknown>;
}

export interface ArtifactDescriptor {
  id: string;
  kind: string;
  objectKey: string;
  contentType: string;
  metadata: Record<string, unknown>;
}

export interface InferenceCapability {
  route: InferenceRoute;
  available: boolean;
  transport: InferenceTransport | null;
  provider: string | null;
  model: string | null;
  accessProtected: boolean;
  requiresConfiguredSecrets: string[];
  notes: string[];
}

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

export interface TunnelConnectionTestResult {
  status: TunnelTestStatus;
  message: string;
  latencyMs: number;
  publicHostname: string | null;
  tunnelId: string | null;
  details: Record<string, unknown>;
  testedAt: string;
}

export interface ScanResultBundle {
  domain: string;
  scannedAt: string;
  dns: DnsProfile;
  http: HttpProbe;
  summary: ScanSummary;
  findings: Finding[];
  recommendations: Recommendation[];
  modules: {
    dns: ScanModuleResult<DnsProfile>;
    http: ScanModuleResult<HttpProbe>;
    summary: ScanModuleResult<ScanSummary>;
    findings: ScanModuleResult<Finding[]>;
    recommendations: ScanModuleResult<Recommendation[]>;
  };
}

export interface PersistedJobState {
  jobId: string;
  status: ScanJobStatus;
  totalRuns: number;
  completedRuns: number;
  degradedRuns: number;
  failedRuns: number;
  progress: number;
  domains: Array<{
    scanRunId: string;
    domain: string;
    status: ScanRunStatus;
    finalUrl: string | null;
    error?: string;
  }>;
  updatedAt: string;
}

export interface PersistedScanRun {
  id: string;
  jobId: string;
  domain: string;
  status: ScanRunStatus;
  sourceUrl: string | null;
  finalUrl: string | null;
  scanSummaryJson: string | null;
  rawResultJson: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PersistedArtifact {
  id: string;
  scanRunId: string;
  kind: string;
  objectKey: string;
  contentType: string;
  metadataJson: string;
  createdAt: string;
}

export interface PersistedRecommendation {
  id: string;
  scanRunId: string;
  productCode: string;
  title: string;
  rationale: string;
  priority: RecommendationPriority;
  confidence: number;
  phase: RecommendationPhase;
  sequence: number;
  blockedByJson: string;
  evidenceJson: string;
  expectedImpact: string;
  technicalSummary: string;
  executiveSummary: string;
  prerequisitesJson: string;
  exportJson: string;
  createdAt: string;
}

export interface PersistedDomainWatch {
  domain: string;
  intervalHours: number;
  active: boolean;
  lastEnqueuedAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedProviderSetting {
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
  secretEnvelopeJson: string | null;
  lastTestedAt: string | null;
  lastTestStatus: ProviderTestStatus | null;
  lastTestResultJson: string | null;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorSession {
  mode: OperatorSessionMode;
  subject: string;
  email: string | null;
  name: string | null;
  issuer: string;
  audience: string[];
  groups: string[];
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface PersistedTunnelRecord {
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
  secretEnvelopeJson: string | null;
  connectorStatus: TunnelConnectorStatus;
  status: TunnelStatus;
  lastConnectorHeartbeatAt: string | null;
  lastTunnelHealthAt: string | null;
  lastTestedAt: string | null;
  lastTestStatus: TunnelTestStatus | null;
  lastTestResultJson: string | null;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
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

export interface PersistedPairingSession {
  id: string;
  tunnelId: string;
  issuedBySubject: string;
  issuedByEmail: string | null;
  status: PairingSessionStatus;
  pairingTokenHash: string;
  connectorTokenHash: string | null;
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
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedExportRecord {
  id: string;
  scanRunId: string;
  format: ExportFormat;
  status: string;
  objectKey: string;
  contentType: string;
  payloadJson: string;
  createdAt: string;
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
  status: HostnameValidationStatus;
  hostname: string;
  zone: CloudflareZoneView | null;
  matchedBy: "provided-zone" | "suffix-match" | "default-zone" | "none";
  suggestedZoneId: string | null;
  suggestedTunnelName: string;
  conflicts: HostnameConflictView[];
  existingTunnelRecordConflict: boolean;
  message: string;
}

export interface PersistedTunnelEvent {
  id: string;
  tunnelId: string;
  kind: string;
  level: TunnelEventLevel;
  summary: string;
  detailJson: string;
  createdAt: string;
}

export interface TunnelEventView {
  id: string;
  tunnelId: string;
  kind: string;
  level: TunnelEventLevel;
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface PersistedTunnelTestRun {
  id: string;
  tunnelId: string;
  status: TunnelTestStatus;
  resultJson: string;
  testedAt: string;
  createdAt: string;
}
