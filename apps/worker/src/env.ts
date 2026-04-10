import type { JobCoordinator } from "./durable-objects/job-coordinator";
import type { EdgeIntelScanWorkflow } from "./workflows/scan-workflow";
import type { ArtifactQueueMessage, ScanQueueMessage, ScanWorkflowParams } from "./types";

// Wrangler generates the canonical binding shape in worker-configuration.d.ts.
// We narrow queue payloads and optional local secrets here for internal use.
export type Env = Omit<
  Cloudflare.Env,
  | "SCAN_QUEUE"
  | "ARTIFACT_QUEUE"
  | "SCAN_WORKFLOW"
  | "JOB_COORDINATOR"
  | "SCAN_BATCH_LIMIT"
  | "SCAN_QUEUE_NAME"
  | "ARTIFACT_QUEUE_NAME"
  | "AI"
  | "AI_GATEWAY_BASE_URL"
  | "AI_GATEWAY_ID"
  | "AI_GATEWAY_MODEL"
  | "AI_GATEWAY_PROVIDER"
  | "AI_INFERENCE_DEFAULT_ROUTE"
  | "BROWSER_RENDERING_REST_BASE_URL"
> & {
  AI: Ai;
  SCAN_QUEUE: Queue<ScanQueueMessage>;
  ARTIFACT_QUEUE: Queue<ArtifactQueueMessage>;
  SCAN_WORKFLOW: Workflow<ScanWorkflowParams>;
  JOB_COORDINATOR: DurableObjectNamespace<JobCoordinator>;
  SCAN_BATCH_LIMIT: string;
  SCAN_QUEUE_NAME: string;
  ARTIFACT_QUEUE_NAME: string;
  AI_GATEWAY_BASE_URL: string;
  AI_GATEWAY_ID: string;
  AI_GATEWAY_MODEL: string;
  AI_GATEWAY_PROVIDER: string;
  AI_INFERENCE_DEFAULT_ROUTE: string;
  BROWSER_RENDERING_REST_BASE_URL: string;
  AI_GATEWAY_TOKEN?: string;
  AI_UPSTREAM_API_KEY?: string;
  BROWSER_RENDERING_API_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_ALLOW_DEV_BYPASS?: string;
  PAIRING_TOKEN_TTL_SECONDS?: string;
  CONNECTOR_TOKEN_TTL_SECONDS?: string;
  PROVIDER_SECRET_ENCRYPTION_KEY?: string;
  LOCAL_MODEL_GATEWAY_URL?: string;
  LOCAL_MODEL_MODEL?: string;
  LOCAL_MODEL_API_KEY?: string;
  LOCAL_MODEL_ACCESS_CLIENT_ID?: string;
  LOCAL_MODEL_ACCESS_CLIENT_SECRET?: string;
  LOCAL_MODEL_AI_GATEWAY_PROVIDER?: string;
};

export type WorkflowClass = typeof EdgeIntelScanWorkflow;
