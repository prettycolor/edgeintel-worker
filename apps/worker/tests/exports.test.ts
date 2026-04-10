import { describe, expect, it } from "vitest";
import {
  renderApiPayloadExport,
  renderJsonExport,
  renderMarkdownExport,
} from "../src/lib/exports";
import type {
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
} from "../src/types";

const run: PersistedScanRun = {
  id: "run-1",
  jobId: "job-1",
  domain: "example.com",
  status: "completed_with_failures",
  sourceUrl: "https://example.com",
  finalUrl: "https://example.com/login",
  scanSummaryJson: JSON.stringify({
    edgeProvider: { provider: "Fastly" },
    dnsProvider: { provider: "AWS Route 53" },
    wafProvider: { provider: null },
  }),
  rawResultJson: JSON.stringify({
    modules: {
      dns: { ok: true },
      http: { ok: true },
      summary: { ok: false },
      findings: { ok: true },
      recommendations: { ok: true },
    },
  }),
  failureReason: "Partial module failures recorded for: summary.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

const artifacts: PersistedArtifact[] = [
  {
    id: "artifact-1",
    scanRunId: "run-1",
    kind: "artifact-manifest",
    objectKey: "artifacts/example.com/run-1/artifact-manifest.json",
    contentType: "application/json; charset=utf-8",
    metadataJson: JSON.stringify({ capturedAt: new Date().toISOString() }),
    createdAt: new Date().toISOString(),
  },
];

const recommendations: PersistedRecommendation[] = [
  {
    id: "rec-1",
    scanRunId: "run-1",
    productCode: "WAF",
    title: "Adopt Cloudflare WAF",
    rationale: "Edge controls are missing.",
    priority: "critical",
    confidence: 90,
    phase: 1,
    sequence: 20,
    blockedByJson: JSON.stringify(["cloudflare_proxy_adoption"]),
    evidenceJson: JSON.stringify(["EDGE_NOT_ON_CLOUDFLARE", "AUTH_SURFACE_DETECTED"]),
    expectedImpact: "Reduce edge attack surface.",
    technicalSummary: "Enable managed rules, then custom auth route rules.",
    executiveSummary: "Fastest posture improvement at the edge.",
    prerequisitesJson: JSON.stringify([
      "Proxy the target hostnames through Cloudflare before enabling edge-enforced controls.",
    ]),
    exportJson: JSON.stringify({
      product: "waf",
      customRules: [{ action: "managed_challenge" }],
    }),
    createdAt: new Date().toISOString(),
  },
  {
    id: "rec-2",
    scanRunId: "run-1",
    productCode: "TURNSTILE",
    title: "Add Turnstile",
    rationale: "Auth flows are visible.",
    priority: "high",
    confidence: 82,
    phase: 2,
    sequence: 10,
    blockedByJson: JSON.stringify([]),
    evidenceJson: JSON.stringify(["AUTH_SURFACE_DETECTED"]),
    expectedImpact: "Reduce interactive form abuse.",
    technicalSummary: "Protect login and reset flows first.",
    executiveSummary: "Low-friction abuse reduction.",
    prerequisitesJson: JSON.stringify([]),
    exportJson: JSON.stringify({
      product: "turnstile",
      candidateFlows: ["/login"],
    }),
    createdAt: new Date().toISOString(),
  },
];

const context = {
  run,
  findings: [
    {
      id: "finding-1",
      severity: "high",
      code: "EDGE_NOT_ON_CLOUDFLARE",
      title: "Edge missing",
      detail: "The site is not on Cloudflare edge.",
    },
    {
      id: "finding-2",
      severity: "medium",
      code: "AUTH_SURFACE_DETECTED",
      title: "Auth surface detected",
      detail: "Login flow detected.",
    },
  ],
  artifacts,
  recommendations,
};

describe("exports", () => {
  it("renders markdown with posture, rollout, artifacts, and manifest sections", () => {
    const markdown = renderMarkdownExport(context);

    expect(markdown).toContain("## Executive Summary");
    expect(markdown).toContain("## Detected Posture");
    expect(markdown).toContain("## Findings By Severity");
    expect(markdown).toContain("## Recommended Cloudflare Products");
    expect(markdown).toContain("## Rollout Order");
    expect(markdown).toContain("## Artifacts Index");
    expect(markdown).toContain("## Export Manifest");
    expect(markdown).toContain("Phase 1.20 - WAF");
  });

  it("renders grouped API payload exports with manifest metadata", () => {
    const payload = JSON.parse(renderApiPayloadExport(context)) as {
      manifest: { schemaVersion: string };
      recommendationsByProduct: Record<string, unknown>;
    };

    expect(payload.manifest.schemaVersion).toBe("edgeintel.export.v1.5");
    expect(payload.recommendationsByProduct.WAF).toBeDefined();
    expect(payload.recommendationsByProduct.TURNSTILE).toBeDefined();
  });

  it("renders json exports with manifest and normalized recommendation fields", () => {
    const payload = JSON.parse(renderJsonExport(context)) as {
      manifest: { scanRunId: string };
      recommendations: Array<{
        blockedBy: string[];
        evidenceRefs: string[];
        blockedByJson?: string;
      }>;
    };

    expect(payload.manifest.scanRunId).toBe("run-1");
    expect(payload.recommendations[0]?.blockedBy).toContain(
      "cloudflare_proxy_adoption",
    );
    expect(payload.recommendations[0]?.evidenceRefs).toContain(
      "EDGE_NOT_ON_CLOUDFLARE",
    );
    expect(payload.recommendations[0]?.blockedByJson).toBeUndefined();
  });
});
