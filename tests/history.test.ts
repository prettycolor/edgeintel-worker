import { describe, expect, it } from "vitest";
import { buildHistoryEntries } from "../src/lib/history";
import type { PersistedScanRun } from "../src/types";

function createRun(
  id: string,
  overrides: Partial<PersistedScanRun> = {},
): PersistedScanRun {
  const timestamp = new Date().toISOString();
  return {
    id,
    jobId: `job-${id}`,
    domain: "example.com",
    status: "completed",
    sourceUrl: "https://example.com",
    finalUrl: "https://example.com",
    scanSummaryJson: JSON.stringify({
      dnsProvider: { provider: "AWS Route 53" },
      edgeProvider: { provider: "Fastly" },
    }),
    rawResultJson: JSON.stringify({
      findings: [{ id: "finding-1" }],
      recommendations: [{ id: "rec-1" }],
      modules: {
        dns: { ok: true },
        http: { ok: true },
        summary: { ok: true },
      },
    }),
    failureReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: timestamp,
    completedAt: timestamp,
    ...overrides,
  };
}

describe("history entries", () => {
  it("builds posture diffs from adjacent runs", () => {
    const latest = createRun("latest", {
      status: "completed_with_failures",
      finalUrl: "https://example.com/login",
      scanSummaryJson: JSON.stringify({
        dnsProvider: { provider: "Cloudflare" },
        edgeProvider: { provider: "Cloudflare" },
      }),
      rawResultJson: JSON.stringify({
        findings: [{ id: "finding-1" }, { id: "finding-2" }],
        recommendations: [{ id: "rec-1" }, { id: "rec-2" }],
        modules: {
          dns: { ok: true },
          http: { ok: true },
          summary: { ok: false },
        },
      }),
    });
    const previous = createRun("previous");

    const history = buildHistoryEntries([latest, previous]);

    expect(history[0]?.metrics.findingCount).toBe(2);
    expect(history[0]?.metrics.recommendationCount).toBe(2);
    expect(history[0]?.metrics.moduleFailures).toEqual(["summary"]);
    expect(history[0]?.diffFromPrevious).toMatchObject({
      statusChanged: true,
      finalUrlChanged: true,
      dnsProviderChanged: true,
      edgeProviderChanged: true,
      findingCountDelta: 1,
      recommendationCountDelta: 1,
      newModuleFailures: ["summary"],
      resolvedModuleFailures: [],
    });
  });
});
