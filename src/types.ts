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
  | "failed";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type ExportFormat = "markdown" | "json" | "terraform" | "cf-api";

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

export interface DnsProfile {
  nameservers: DnsRecord[];
  a: DnsRecord[];
  aaaa: DnsRecord[];
  cname: DnsRecord[];
  mx: DnsRecord[];
  txt: DnsRecord[];
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
  redirectChain: RedirectHop[];
  headers: Record<string, string>;
  htmlPreview: string | null;
  pageTitle: string | null;
  apiHints: string[];
  authHints: string[];
  staticAssetHints: string[];
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
  expectedImpact: string;
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
}

export interface PersistedJobState {
  jobId: string;
  status: ScanJobStatus;
  totalRuns: number;
  completedRuns: number;
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
  expectedImpact: string;
  prerequisitesJson: string;
  exportJson: string;
  createdAt: string;
}
