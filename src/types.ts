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

export interface ScanRequestBody {
  domain?: string;
  domains?: string[];
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
}

export interface ScanSummary {
  domain: string;
  dnsProvider: ProviderSignal;
  edgeProvider: ProviderSignal;
  wafProvider: ProviderSignal;
  originHints: string[];
  apiSurfaceDetected: boolean;
  authSurfaceDetected: boolean;
  cacheSignals: string[];
  missingSecurityHeaders: string[];
  finalUrl: string | null;
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
