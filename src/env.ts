import type { JobCoordinator } from "./durable-objects/job-coordinator";
import type { EdgeIntelScanWorkflow } from "./workflows/scan-workflow";
import type {
  ArtifactQueueMessage,
  ScanQueueMessage,
  ScanWorkflowParams,
} from "./types";

export interface Env {
  EDGE_DB: D1Database;
  EDGE_ARTIFACTS: R2Bucket;
  JOB_COORDINATOR: DurableObjectNamespace<JobCoordinator>;
  SCAN_QUEUE: Queue<ScanQueueMessage>;
  ARTIFACT_QUEUE: Queue<ArtifactQueueMessage>;
  SCAN_WORKFLOW: Workflow<ScanWorkflowParams>;
  BROWSER?: Fetcher;
  SCAN_BATCH_LIMIT: string;
  SCAN_QUEUE_NAME: string;
  ARTIFACT_QUEUE_NAME: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_MODEL?: string;
  AI_GATEWAY_PROVIDER?: string;
  BROWSER_RENDERING_REST_BASE_URL?: string;
  BROWSER_RENDERING_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}

export type WorkflowClass = typeof EdgeIntelScanWorkflow;
