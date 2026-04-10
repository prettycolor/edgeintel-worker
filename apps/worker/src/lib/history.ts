import type { PersistedScanRun } from "../types";
import { safeJsonParse } from "./utils";

interface ScanHistoryMetrics {
  findingCount: number;
  recommendationCount: number;
  moduleFailures: string[];
}

function parseSummary(run: PersistedScanRun): Record<string, unknown> {
  return safeJsonParse<Record<string, unknown>>(run.scanSummaryJson, {});
}

function parseMetrics(run: PersistedScanRun): ScanHistoryMetrics {
  const rawResult = safeJsonParse<Record<string, unknown>>(run.rawResultJson, {});
  const findings = Array.isArray(rawResult.findings) ? rawResult.findings : [];
  const recommendations = Array.isArray(rawResult.recommendations)
    ? rawResult.recommendations
    : [];
  const moduleFailures =
    rawResult.modules && typeof rawResult.modules === "object"
      ? Object.entries(rawResult.modules as Record<string, unknown>)
          .filter(
            ([, value]) =>
              typeof value === "object" &&
              value !== null &&
              "ok" in value &&
              (value as { ok: boolean }).ok === false,
          )
          .map(([name]) => name)
      : [];

  return {
    findingCount: findings.length,
    recommendationCount: recommendations.length,
    moduleFailures,
  };
}

function providerName(summary: Record<string, unknown>, key: string): string | null {
  const candidate = summary[key];
  if (
    typeof candidate === "object" &&
    candidate &&
    "provider" in candidate
  ) {
    return String((candidate as Record<string, unknown>).provider ?? "");
  }
  return null;
}

export function buildHistoryEntries(runs: PersistedScanRun[]) {
  return runs.map((run, index) => {
    const previous = runs[index + 1] ?? null;
    const summary = parseSummary(run);
    const metrics = parseMetrics(run);

    const diffFromPrevious = previous
      ? (() => {
          const previousSummary = parseSummary(previous);
          const previousMetrics = parseMetrics(previous);

          const currentFailures = new Set(metrics.moduleFailures);
          const previousFailures = new Set(previousMetrics.moduleFailures);

          return {
            statusChanged: run.status !== previous.status,
            finalUrlChanged: run.finalUrl !== previous.finalUrl,
            dnsProviderChanged:
              providerName(summary, "dnsProvider") !==
              providerName(previousSummary, "dnsProvider"),
            edgeProviderChanged:
              providerName(summary, "edgeProvider") !==
              providerName(previousSummary, "edgeProvider"),
            findingCountDelta:
              metrics.findingCount - previousMetrics.findingCount,
            recommendationCountDelta:
              metrics.recommendationCount - previousMetrics.recommendationCount,
            newModuleFailures: metrics.moduleFailures.filter(
              (failure) => !previousFailures.has(failure),
            ),
            resolvedModuleFailures: previousMetrics.moduleFailures.filter(
              (failure) => !currentFailures.has(failure),
            ),
          };
        })()
      : null;

    return {
      run,
      summary,
      metrics,
      diffFromPrevious,
    };
  });
}
