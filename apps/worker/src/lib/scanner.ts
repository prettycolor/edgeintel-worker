import type {
  DnsProfile,
  Finding,
  HttpProbe,
  Recommendation,
  ScanModuleResult,
  ScanResultBundle,
  ScanSummary,
} from "../types";
import { resolveDnsProfile } from "./dns";
import { deriveFindings } from "./findings";
import { probeDomainSurface } from "./http";
import { buildScanSummary } from "./provider-attribution";
import { deriveRecommendations } from "./recommendations";
import { nowIso } from "./utils";

type ScanModuleName = keyof ScanResultBundle["modules"];

function emptyDnsProfile(): DnsProfile {
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
  };
}

function emptyHttpProbe(domain: string): HttpProbe {
  return {
    attemptedUrl: `https://${domain}`,
    finalUrl: null,
    status: null,
    ok: false,
    protocolUsed: "unknown",
    redirectChain: [],
    headers: {},
    htmlPreview: null,
    pageTitle: null,
    apiHints: [],
    authHints: [],
    staticAssetHints: [],
    contentType: null,
    contentLength: null,
    attempts: [],
    surfaceClassification: {
      isHtml: false,
      isDenied: false,
      redirectCount: 0,
      hasApiHints: false,
      hasAuthHints: false,
    },
    errors: [],
    error: "HTTP module did not execute successfully.",
  };
}

async function runModule<T>(
  execute: () => Promise<T>,
  fallback: T,
): Promise<ScanModuleResult<T>> {
  const startedAt = nowIso();
  const startedAtMs = Date.now();

  try {
    const data = await execute();
    return {
      ok: true,
      attempts: 1,
      startedAt,
      completedAt: nowIso(),
      durationMs: Date.now() - startedAtMs,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      attempts: 1,
      startedAt,
      completedAt: nowIso(),
      durationMs: Date.now() - startedAtMs,
      error: error instanceof Error ? error.message : "Module failed",
      data: fallback,
    };
  }
}

export function getFailedScanModules(bundle: ScanResultBundle): ScanModuleName[] {
  return Object.entries(bundle.modules)
    .filter(([, result]) => !result.ok)
    .map(([name]) => name as ScanModuleName);
}

export function bundleHasModuleFailures(bundle: ScanResultBundle): boolean {
  return getFailedScanModules(bundle).length > 0;
}

export function summarizeModuleFailures(bundle: ScanResultBundle): string | null {
  const failedModules = getFailedScanModules(bundle);
  if (failedModules.length === 0) {
    return null;
  }

  return `Partial module failures recorded for: ${failedModules.join(", ")}.`;
}

export async function performEdgeScan(domain: string): Promise<ScanResultBundle> {
  const [dnsModule, httpModule] = await Promise.all([
    runModule(() => resolveDnsProfile(domain), emptyDnsProfile()),
    runModule(() => probeDomainSurface(domain), emptyHttpProbe(domain)),
  ]);

  const summaryModule = await runModule<ScanSummary>(
    async () => buildScanSummary(domain, dnsModule.data, httpModule.data),
    buildScanSummary(domain, emptyDnsProfile(), emptyHttpProbe(domain)),
  );

  const findingsModule = await runModule<Finding[]>(
    async () =>
      deriveFindings(domain, dnsModule.data, httpModule.data, summaryModule.data),
    [],
  );

  const recommendationsModule = await runModule<Recommendation[]>(
    async () =>
      deriveRecommendations({
        domain,
        scannedAt: nowIso(),
        dns: dnsModule.data,
        http: httpModule.data,
        summary: summaryModule.data,
        findings: findingsModule.data,
        recommendations: [],
        modules: {
          dns: dnsModule,
          http: httpModule,
          summary: summaryModule,
          findings: findingsModule,
          recommendations: {
            ok: true,
            attempts: 1,
            startedAt: nowIso(),
            completedAt: nowIso(),
            durationMs: 0,
            data: [],
          },
        },
      }),
    [],
  );

  return {
    domain,
    scannedAt: nowIso(),
    dns: dnsModule.data,
    http: httpModule.data,
    summary: summaryModule.data,
    findings: findingsModule.data,
    recommendations: recommendationsModule.data,
    modules: {
      dns: dnsModule,
      http: httpModule,
      summary: summaryModule,
      findings: findingsModule,
      recommendations: recommendationsModule,
    },
  };
}
