import { describe, expect, it } from "vitest";
import { renderMarkdownExport } from "../src/lib/exports";
import {
  bundleHasModuleFailures,
  getFailedScanModules,
  summarizeModuleFailures,
} from "../src/lib/scanner";
import type { ScanResultBundle } from "../src/types";

function createBundle(): ScanResultBundle {
  const scannedAt = new Date().toISOString();

  return {
    domain: "example.com",
    scannedAt,
    dns: {
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
    },
    http: {
      attemptedUrl: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      ok: true,
      protocolUsed: "https",
      redirectChain: [],
      headers: {},
      htmlPreview: "<html><title>Example</title></html>",
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
    },
    summary: {
      domain: "example.com",
      dnsProvider: { provider: "Cloudflare", confidence: 90, evidence: [] },
      edgeProvider: { provider: "Cloudflare", confidence: 90, evidence: [] },
      wafProvider: { provider: "Cloudflare", confidence: 80, evidence: [] },
      originHints: [],
      apiSurfaceDetected: false,
      authSurfaceDetected: false,
      cacheSignals: [],
      missingSecurityHeaders: [],
      finalUrl: "https://example.com",
    },
    findings: [],
    recommendations: [],
    modules: {
      dns: {
        ok: true,
        attempts: 1,
        startedAt: scannedAt,
        completedAt: scannedAt,
        durationMs: 5,
        data: {
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
        },
      },
      http: {
        ok: true,
        attempts: 1,
        startedAt: scannedAt,
        completedAt: scannedAt,
        durationMs: 5,
        data: {
          attemptedUrl: "https://example.com",
          finalUrl: "https://example.com",
          status: 200,
          ok: true,
          protocolUsed: "https",
          redirectChain: [],
          headers: {},
          htmlPreview: "<html><title>Example</title></html>",
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
        },
      },
      summary: {
        ok: false,
        attempts: 1,
        startedAt: scannedAt,
        completedAt: scannedAt,
        durationMs: 5,
        error: "summary failed",
        data: {
          domain: "example.com",
          dnsProvider: { provider: "Cloudflare", confidence: 90, evidence: [] },
          edgeProvider: { provider: "Cloudflare", confidence: 90, evidence: [] },
          wafProvider: { provider: "Cloudflare", confidence: 80, evidence: [] },
          originHints: [],
          apiSurfaceDetected: false,
          authSurfaceDetected: false,
          cacheSignals: [],
          missingSecurityHeaders: [],
          finalUrl: "https://example.com",
        },
      },
      findings: {
        ok: true,
        attempts: 1,
        startedAt: scannedAt,
        completedAt: scannedAt,
        durationMs: 5,
        data: [],
      },
      recommendations: {
        ok: true,
        attempts: 1,
        startedAt: scannedAt,
        completedAt: scannedAt,
        durationMs: 5,
        data: [],
      },
    },
  };
}

describe("scan module status", () => {
  it("surfaces partial module failures as first-class scan metadata", () => {
    const bundle = createBundle();

    expect(bundleHasModuleFailures(bundle)).toBe(true);
    expect(getFailedScanModules(bundle)).toEqual(["summary"]);
    expect(summarizeModuleFailures(bundle)).toBe(
      "Partial module failures recorded for: summary.",
    );
  });

  it("includes partial module failures in markdown exports", () => {
    const bundle = createBundle();
    const markdown = renderMarkdownExport({
      run: {
        id: "run-1",
        jobId: "job-1",
        domain: bundle.domain,
        status: "completed_with_failures",
        sourceUrl: "https://example.com",
        finalUrl: "https://example.com",
        scanSummaryJson: JSON.stringify(bundle.summary),
        rawResultJson: JSON.stringify(bundle),
        failureReason: "Partial module failures recorded for: summary.",
        createdAt: bundle.scannedAt,
        updatedAt: bundle.scannedAt,
        startedAt: bundle.scannedAt,
        completedAt: bundle.scannedAt,
      },
      findings: [],
      artifacts: [],
      recommendations: [],
    });

    expect(markdown).toContain("Status: completed_with_failures");
    expect(markdown).toContain("Partial Module Failures: summary");
  });
});
