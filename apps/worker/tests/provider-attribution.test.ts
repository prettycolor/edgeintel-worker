import { describe, expect, it } from "vitest";
import { buildScanSummary } from "../src/lib/provider-attribution";
import type { DnsProfile, HttpProbe } from "../src/types";

function dnsProfile(overrides: Partial<DnsProfile> = {}): DnsProfile {
  return {
    nameservers: [],
    a: [],
    aaaa: [],
    cname: [],
    mx: [],
    txt: [],
    evidence: {
      queryResults: [],
      observedRecordTypes: [],
      ttlSummary: {
        min: null,
        max: null,
        average: null,
      },
    },
    ...overrides,
  };
}

function httpProbe(overrides: Partial<HttpProbe> = {}): HttpProbe {
  return {
    attemptedUrl: "https://example.com",
    finalUrl: "https://example.com",
    status: 200,
    ok: true,
    protocolUsed: "https",
    redirectChain: [],
    headers: {},
    htmlPreview: "<html></html>",
    pageTitle: "Example",
    apiHints: [],
    authHints: [],
    staticAssetHints: [],
    contentType: "text/html; charset=utf-8",
    contentLength: 128,
    attempts: [],
    surfaceClassification: {
      isHtml: true,
      isDenied: false,
      redirectCount: 0,
      hasApiHints: false,
      hasAuthHints: false,
    },
    errors: [],
    ...overrides,
  };
}

describe("provider attribution", () => {
  it("keeps DNS provider hints from being misreported as edge attribution", () => {
    const summary = buildScanSummary(
      "example.com",
      dnsProfile({
        nameservers: [
          { name: "example.com", type: "NS", data: "ns01.domaincontrol.com" },
          { name: "example.com", type: "NS", data: "ns02.domaincontrol.com" },
        ],
      }),
      httpProbe(),
    );

    expect(summary.dnsProvider.provider).toBe("GoDaddy");
    expect(summary.edgeProvider.provider).toBeNull();
  });

  it("detects Cloudflare edge and WAF from request headers", () => {
    const summary = buildScanSummary(
      "example.com",
      dnsProfile(),
      httpProbe({
        headers: {
          "cf-ray": "abc123",
          "cf-cache-status": "HIT",
          server: "cloudflare",
        },
      }),
    );

    expect(summary.edgeProvider.provider).toBe("Cloudflare");
    expect(summary.edgeProvider.methods).toContain("header");
    expect(summary.wafProvider.provider).toBe("Cloudflare");
  });

  it("surfaces origin provider hints separately from edge attribution", () => {
    const summary = buildScanSummary(
      "example.com",
      dnsProfile({
        cname: [
          {
            name: "example.com",
            type: "CNAME",
            data: "environment.wpenginepowered.com",
          },
        ],
      }),
      httpProbe({
        headers: {
          server: "nginx",
          "x-powered-by": "WP Engine",
        },
      }),
    );

    expect(summary.originProvider?.provider).toBe("WP Engine");
    expect(summary.originProvider?.confidence).toBeGreaterThanOrEqual(62);
  });
});
