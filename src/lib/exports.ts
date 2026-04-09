import type {
  ExportFormat,
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
  ScanResultBundle,
} from "../types";
import { getFailedScanModules } from "./scanner";
import { safeJsonParse } from "./utils";

interface ExportContext {
  run: PersistedScanRun;
  findings: Array<Record<string, unknown>>;
  artifacts: PersistedArtifact[];
  recommendations: PersistedRecommendation[];
}

function buildExecutiveSummary(context: ExportContext): string {
  const summary = safeJsonParse<Record<string, unknown>>(context.run.scanSummaryJson, {});
  const resultBundle = safeJsonParse<ScanResultBundle | null>(
    context.run.rawResultJson,
    null,
  );
  const edgeProvider =
    typeof summary.edgeProvider === "object" &&
    summary.edgeProvider &&
    "provider" in summary.edgeProvider
      ? String((summary.edgeProvider as Record<string, unknown>).provider ?? "unknown")
      : "unknown";
  const failedModules = resultBundle ? getFailedScanModules(resultBundle) : [];

  return [
    `# EdgeIntel Report: ${context.run.domain}`,
    "",
    `Status: ${context.run.status}`,
    failedModules.length > 0
      ? `Partial module failures: ${failedModules.join(", ")}`
      : "Partial module failures: none",
    `Observed edge provider: ${edgeProvider}`,
    `Artifacts captured: ${context.artifacts.length}`,
    `Recommendations generated: ${context.recommendations.length}`,
    "",
  ].join("\n");
}

function renderRecommendationMarkdown(recommendation: PersistedRecommendation): string {
  const prerequisites = safeJsonParse<string[]>(
    recommendation.prerequisitesJson,
    [],
  );
  const blockedBy = safeJsonParse<string[]>(recommendation.blockedByJson, []);
  const evidenceRefs = safeJsonParse<string[]>(recommendation.evidenceJson, []);

  return [
    `## ${recommendation.title}`,
    "",
    `- Product: ${recommendation.productCode}`,
    `- Rollout Phase: ${recommendation.phase}.${recommendation.sequence}`,
    `- Priority: ${recommendation.priority}`,
    `- Confidence: ${recommendation.confidence}`,
    `- Expected Impact: ${recommendation.expectedImpact}`,
    `- Rationale: ${recommendation.rationale}`,
    `- Executive Summary: ${recommendation.executiveSummary}`,
    `- Technical Summary: ${recommendation.technicalSummary}`,
    `- Evidence Refs: ${evidenceRefs.length > 0 ? evidenceRefs.join("; ") : "None"}`,
    `- Blocked By: ${blockedBy.length > 0 ? blockedBy.join("; ") : "None"}`,
    `- Prerequisites: ${
      prerequisites.length > 0 ? prerequisites.join("; ") : "None"
    }`,
    "",
  ].join("\n");
}

export function renderMarkdownExport(context: ExportContext): string {
  const findingsSection = context.findings
    .map((finding) => {
      const title = String(finding.title ?? "Untitled finding");
      const severity = String(finding.severity ?? "info");
      const detail = String(finding.detail ?? "");
      return `- [${severity}] ${title}: ${detail}`;
    })
    .join("\n");

  const recommendationsSection = context.recommendations
    .map(renderRecommendationMarkdown)
    .join("\n");

  return [
    buildExecutiveSummary(context),
    "## Findings",
    "",
    findingsSection || "- No findings recorded.",
    "",
    "## Recommendations",
    "",
    recommendationsSection || "No recommendations generated.",
    "",
  ].join("\n");
}

export function renderTerraformExport(context: ExportContext): string {
  const blocks = context.recommendations.map((recommendation) => {
    switch (recommendation.productCode) {
      case "WAF":
      return `
resource "cloudflare_ruleset" "edgeintel_waf" {
  zone_id = var.zone_id
  name    = "EdgeIntel recommended WAF rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
}

# Suggested rollout sequence: phase ${recommendation.phase}.${recommendation.sequence}
# ${recommendation.technicalSummary}
`;
      case "TURNSTILE":
      return `
# Turnstile widget creation is account-scoped.
# Create a widget for the detected auth flows and wire it into the application forms.
# Suggested rollout sequence: phase ${recommendation.phase}.${recommendation.sequence}
`;
      case "LOAD_BALANCING":
      return `
resource "cloudflare_load_balancer" "edgeintel_lb" {
  zone_id          = var.zone_id
  default_pools    = []
  fallback_pool_id = ""
  name             = "edgeintel-origin-balancer"
}

# ${recommendation.technicalSummary}
`;
      case "CACHE_RULES":
      return `
resource "cloudflare_ruleset" "edgeintel_cache" {
  zone_id = var.zone_id
  name    = "EdgeIntel cache rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"
}

# ${recommendation.technicalSummary}
`;
      default:
        return `
# ${recommendation.productCode}
# ${recommendation.title}
# ${recommendation.rationale}
`;
    }
  });

  return [
    'terraform {',
    '  required_providers {',
    '    cloudflare = {',
    '      source = "cloudflare/cloudflare"',
    "    }",
    "  }",
    "}",
    "",
    'variable "zone_id" {',
    "  type = string",
    "}",
    "",
    blocks.join("\n"),
  ].join("\n");
}

export function renderApiPayloadExport(context: ExportContext): string {
  const payload = context.recommendations.map((recommendation) => ({
    productCode: recommendation.productCode,
    title: recommendation.title,
    phase: recommendation.phase,
    sequence: recommendation.sequence,
    blockedBy: safeJsonParse<string[]>(recommendation.blockedByJson, []),
    evidenceRefs: safeJsonParse<string[]>(recommendation.evidenceJson, []),
    executiveSummary: recommendation.executiveSummary,
    technicalSummary: recommendation.technicalSummary,
    expectedImpact: recommendation.expectedImpact,
    payload: safeJsonParse<Record<string, unknown>>(recommendation.exportJson, {}),
  }));
  return JSON.stringify(payload, null, 2);
}

export function renderJsonExport(context: ExportContext): string {
  return JSON.stringify(
    {
      run: context.run,
      findings: context.findings,
      artifacts: context.artifacts,
      recommendations: context.recommendations.map((recommendation) => ({
        ...recommendation,
        blockedBy: safeJsonParse(recommendation.blockedByJson, []),
        evidenceRefs: safeJsonParse(recommendation.evidenceJson, []),
        prerequisites: safeJsonParse(recommendation.prerequisitesJson, []),
        exportPayload: safeJsonParse(recommendation.exportJson, {}),
      })),
    },
    null,
    2,
  );
}

export function exportContentType(format: ExportFormat): string {
  switch (format) {
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "terraform":
      return "text/plain; charset=utf-8";
    case "cf-api":
    case "json":
      return "application/json; charset=utf-8";
  }
}
