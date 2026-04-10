import { describe, expect, it } from "vitest";
import { buildCommercialBrief } from "../src/lib/commercial-brief";
import type {
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
} from "../src/types";

const run: PersistedScanRun = {
  id: "run-brief-1",
  jobId: "job-brief-1",
  domain: "example.com",
  status: "completed",
  sourceUrl: "https://example.com",
  finalUrl: "https://example.com/login",
  scanSummaryJson: JSON.stringify({
    domain: "example.com",
    dnsProvider: {
      provider: "AWS",
      confidence: 84,
      evidence: ["ns:awsdns-01.com"],
      category: "Cloud/VPS",
      methods: ["nameserver"],
      providerType: "cloud",
    },
    edgeProvider: {
      provider: "Fastly",
      confidence: 88,
      evidence: ["header:x-served-by"],
      category: "CDN/DNS",
      methods: ["header"],
      providerType: "cloud",
    },
    wafProvider: {
      provider: null,
      confidence: 0,
      evidence: [],
    },
    originProvider: {
      provider: "AWS",
      confidence: 82,
      evidence: ["hint:ec2.amazonaws.com"],
      category: "Cloud/VPS",
      methods: ["hint"],
      providerType: "cloud",
    },
    originHints: ["ec2.amazonaws.com", "server: nginx"],
    apiSurfaceDetected: true,
    authSurfaceDetected: true,
    cacheSignals: [],
    missingSecurityHeaders: ["strict-transport-security", "content-security-policy"],
    finalUrl: "https://example.com/login",
  }),
  rawResultJson: JSON.stringify({
    dns: { a: [{ data: "192.0.2.10" }], aaaa: [] },
    http: {
      redirectChain: [{}, {}, {}],
      staticAssetHints: ["/app.js", "/vendor.js", "/styles.css", "/image.png"],
    },
  }),
  failureReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

const artifacts: PersistedArtifact[] = [
  {
    id: "artifact-brief-1",
    scanRunId: "run-brief-1",
    kind: "artifact-manifest",
    objectKey: "artifacts/example.com/run-brief-1/artifact-manifest.json",
    contentType: "application/json; charset=utf-8",
    metadataJson: JSON.stringify({ captures: [] }),
    createdAt: new Date().toISOString(),
  },
];

const recommendations: PersistedRecommendation[] = [
  {
    id: "rec-commercial-1",
    scanRunId: "run-brief-1",
    productCode: "WAF",
    title: "Adopt Cloudflare WAF",
    rationale: "Edge controls are fragmented.",
    priority: "critical",
    confidence: 91,
    phase: 1,
    sequence: 20,
    blockedByJson: JSON.stringify(["cloudflare_proxy_adoption"]),
    evidenceJson: JSON.stringify(["EDGE_NOT_ON_CLOUDFLARE", "AUTH_SURFACE_DETECTED"]),
    expectedImpact: "Reduce edge exposure.",
    technicalSummary: "Enable managed rules and auth-specific expressions.",
    executiveSummary: "Fastest path to a tighter edge posture.",
    prerequisitesJson: JSON.stringify(["Proxy traffic through Cloudflare first."]),
    exportJson: JSON.stringify({ product: "waf" }),
    createdAt: new Date().toISOString(),
  },
  {
    id: "rec-commercial-2",
    scanRunId: "run-brief-1",
    productCode: "SMART_ROUTING",
    title: "Enable Smart Routing",
    rationale: "Origin path quality can improve after proxy adoption.",
    priority: "high",
    confidence: 77,
    phase: 4,
    sequence: 10,
    blockedByJson: JSON.stringify(["cloudflare_proxy_adoption"]),
    evidenceJson: JSON.stringify(["CACHE_POLICY_WEAK"]),
    expectedImpact: "Improve latency and route quality.",
    technicalSummary: "Baseline first, then enable Smart Routing.",
    executiveSummary: "Clean performance upside after edge adoption.",
    prerequisitesJson: JSON.stringify(["Adopt Cloudflare proxy first."]),
    exportJson: JSON.stringify({ product: "smart_routing" }),
    createdAt: new Date().toISOString(),
  },
];

describe("commercial brief", () => {
  it("builds an SE-grade motion summary from persisted scan context", () => {
    const brief = buildCommercialBrief({
      run,
      findings: [
        {
          code: "EDGE_NOT_ON_CLOUDFLARE",
          severity: "medium",
        },
        {
          code: "CACHE_POLICY_WEAK",
          severity: "medium",
        },
        {
          code: "AUTH_SURFACE_DETECTED",
          severity: "medium",
        },
      ],
      artifacts,
      recommendations,
    });

    expect(brief.cloudflareFit.score).toBeGreaterThan(60);
    expect(brief.accessHardening.score).toBeLessThan(brief.cloudflareFit.score);
    expect(brief.originExposure.risk).toBe("high");
    expect(brief.expansionCandidates[0]?.productCode).toBe("WAF");
    expect(brief.markdown).toContain("Why This Is A Cloudflare Motion");
    expect(brief.markdown).toContain("WAF");
  });
});
