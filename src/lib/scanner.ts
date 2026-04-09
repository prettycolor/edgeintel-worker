import type { ScanResultBundle } from "../types";
import { resolveDnsProfile } from "./dns";
import { deriveFindings } from "./findings";
import { probeDomainSurface } from "./http";
import { buildScanSummary } from "./provider-attribution";
import { deriveRecommendations } from "./recommendations";
import { nowIso } from "./utils";

export async function performEdgeScan(domain: string): Promise<ScanResultBundle> {
  const [dns, http] = await Promise.all([
    resolveDnsProfile(domain),
    probeDomainSurface(domain),
  ]);

  const summary = buildScanSummary(domain, dns, http);
  const findings = deriveFindings(domain, dns, http, summary);

  const preliminaryBundle: ScanResultBundle = {
    domain,
    scannedAt: nowIso(),
    dns,
    http,
    summary,
    findings,
    recommendations: [],
  };

  return {
    ...preliminaryBundle,
    recommendations: deriveRecommendations(preliminaryBundle),
  };
}
