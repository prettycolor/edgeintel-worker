import { describe, expect, it } from "vitest";
import type {
  DnsProfile,
  Finding,
  HttpProbe,
  Recommendation,
  ScanModuleResult,
  ScanResultBundle,
  ScanSummary,
} from "../src/types";
import { deriveRecommendations } from "../src/lib/recommendations";

function moduleResult<T>(data: T): ScanModuleResult<T> {
  return {
    ok: true,
    attempts: 1,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 10,
    data,
  };
}

const dns: DnsProfile = {
  nameservers: [{ name: "example.com", type: "NS", data: "ns1.example.net" }],
  a: [{ name: "example.com", type: "A", data: "192.0.2.1" }],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],
  evidence: {
    queryResults: [],
    observedRecordTypes: ["NS", "A"],
    ttlSummary: {
      min: 300,
      max: 300,
      average: 300,
    },
  },
};

const http: HttpProbe = {
  attemptedUrl: "https://example.com",
  finalUrl: "https://example.com/login",
  status: 200,
  ok: true,
  protocolUsed: "https",
  redirectChain: [],
  headers: {},
  htmlPreview: null,
  pageTitle: "Example",
  apiHints: ["/api/v1/orders"],
  authHints: ["login"],
  staticAssetHints: ["/assets/app.js"],
  contentType: "text/html; charset=utf-8",
  contentLength: 1024,
  attempts: [
    {
      url: "https://example.com",
      scheme: "https",
      durationMs: 120,
      status: 200,
      ok: true,
      finalUrl: "https://example.com/login",
    },
  ],
  surfaceClassification: {
    isHtml: true,
    isDenied: false,
    redirectCount: 0,
    hasApiHints: true,
    hasAuthHints: true,
  },
  errors: [],
};

const summary: ScanSummary = {
  domain: "example.com",
  dnsProvider: { provider: "Route 53", confidence: 80, evidence: [] },
  edgeProvider: { provider: null, confidence: 0, evidence: [] },
  wafProvider: { provider: null, confidence: 0, evidence: [] },
  originHints: [],
  apiSurfaceDetected: true,
  authSurfaceDetected: true,
  cacheSignals: [],
  missingSecurityHeaders: [
    "strict-transport-security",
    "content-security-policy",
  ],
  finalUrl: "https://example.com/login",
};

const findings: Finding[] = [
  {
    id: "f1",
    category: "edge",
    severity: "medium",
    code: "EDGE_NOT_ON_CLOUDFLARE",
    title: "Edge missing",
    detail: "Edge is not on Cloudflare",
    evidence: {},
  },
  {
    id: "f2",
    category: "surface",
    severity: "medium",
    code: "AUTH_SURFACE_DETECTED",
    title: "Auth surface",
    detail: "Auth detected",
    evidence: {},
  },
  {
    id: "f3",
    category: "surface",
    severity: "info",
    code: "API_SURFACE_DETECTED",
    title: "API surface",
    detail: "API detected",
    evidence: {},
  },
  {
    id: "f4",
    category: "performance",
    severity: "medium",
    code: "CACHE_POLICY_WEAK",
    title: "Cache weak",
    detail: "Cache weak",
    evidence: {},
  },
];

const recommendations: Recommendation[] = [];

const bundle: ScanResultBundle = {
  domain: "example.com",
  scannedAt: new Date().toISOString(),
  dns,
  http,
  summary,
  findings,
  recommendations,
  modules: {
    dns: moduleResult(dns),
    http: moduleResult(http),
    summary: moduleResult(summary),
    findings: moduleResult(findings),
    recommendations: moduleResult(recommendations),
  },
};

describe("recommendation engine", () => {
  it("maps posture into Cloudflare product recommendations", () => {
    const recommendations = deriveRecommendations(bundle);
    const codes = recommendations.map((recommendation) => recommendation.productCode);

    expect(codes).toContain("WAF");
    expect(codes).toContain("BOT_MANAGEMENT");
    expect(codes).toContain("TURNSTILE");
    expect(codes).toContain("API_SHIELD");
    expect(codes).toContain("CACHE_RULES");
  });
});
