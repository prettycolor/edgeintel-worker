import { describe, expect, it } from "vitest";
import type { ScanResultBundle } from "../src/types";
import { deriveRecommendations } from "../src/lib/recommendations";

const bundle: ScanResultBundle = {
  domain: "example.com",
  scannedAt: new Date().toISOString(),
  dns: {
    nameservers: [{ name: "example.com", type: "NS", data: "ns1.example.net" }],
    a: [{ name: "example.com", type: "A", data: "192.0.2.1" }],
    aaaa: [],
    cname: [],
    mx: [],
    txt: [],
  },
  http: {
    attemptedUrl: "https://example.com",
    finalUrl: "https://example.com/login",
    status: 200,
    ok: true,
    redirectChain: [],
    headers: {},
    htmlPreview: null,
    pageTitle: "Example",
    apiHints: ["/api/v1/orders"],
    authHints: ["login"],
    staticAssetHints: ["/assets/app.js"],
  },
  summary: {
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
  },
  findings: [
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
  ],
  recommendations: [],
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
