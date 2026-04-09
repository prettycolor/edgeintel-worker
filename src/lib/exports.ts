import type {
  ExportFormat,
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
  ScanResultBundle,
} from "../types";
import { getFailedScanModules } from "./scanner";
import { nowIso, safeJsonParse } from "./utils";

interface ExportContext {
  run: PersistedScanRun;
  findings: Array<Record<string, unknown>>;
  artifacts: PersistedArtifact[];
  recommendations: PersistedRecommendation[];
}

const EXPORT_SCHEMA_VERSION = "edgeintel.export.v1.5";
const FINDING_SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

function parseSummary(context: ExportContext): Record<string, unknown> {
  return safeJsonParse<Record<string, unknown>>(context.run.scanSummaryJson, {});
}

function parseResultBundle(context: ExportContext): ScanResultBundle | null {
  return safeJsonParse<ScanResultBundle | null>(context.run.rawResultJson, null);
}

function parseRecommendationList<T>(
  recommendation: PersistedRecommendation,
  key: "blockedByJson" | "evidenceJson" | "prerequisitesJson",
): T[] {
  return safeJsonParse<T[]>(recommendation[key], []);
}

function buildExportManifest(
  context: ExportContext,
  format: ExportFormat,
): Record<string, unknown> {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: nowIso(),
    format,
    scanRunId: context.run.id,
    jobId: context.run.jobId,
    domain: context.run.domain,
    artifactCount: context.artifacts.length,
    findingCount: context.findings.length,
    recommendationCount: context.recommendations.length,
  };
}

function recommendationRolloutKey(recommendation: PersistedRecommendation): string {
  return `${recommendation.phase}.${recommendation.sequence}`;
}

function sortRecommendations(
  recommendations: PersistedRecommendation[],
): PersistedRecommendation[] {
  return [...recommendations].sort((left, right) => {
    if (left.phase !== right.phase) return left.phase - right.phase;
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return right.confidence - left.confidence;
  });
}

function groupedFindings(context: ExportContext): Array<{
  severity: string;
  findings: Array<Record<string, unknown>>;
}> {
  return FINDING_SEVERITY_ORDER.map((severity) => ({
    severity,
    findings: context.findings.filter(
      (finding) => String(finding.severity ?? "info") === severity,
    ),
  })).filter((group) => group.findings.length > 0);
}

function renderPostureBlock(context: ExportContext): string {
  const summary = parseSummary(context);
  const resultBundle = parseResultBundle(context);
  const failedModules = resultBundle ? getFailedScanModules(resultBundle) : [];

  const dnsProvider =
    typeof summary.dnsProvider === "object" && summary.dnsProvider
      ? String((summary.dnsProvider as Record<string, unknown>).provider ?? "unknown")
      : "unknown";
  const edgeProvider =
    typeof summary.edgeProvider === "object" && summary.edgeProvider
      ? String((summary.edgeProvider as Record<string, unknown>).provider ?? "unknown")
      : "unknown";
  const wafProvider =
    typeof summary.wafProvider === "object" && summary.wafProvider
      ? String((summary.wafProvider as Record<string, unknown>).provider ?? "unknown")
      : "unknown";

  return [
    "## Detected Posture",
    "",
    `- Scan Status: ${context.run.status}`,
    `- Final URL: ${context.run.finalUrl ?? "unknown"}`,
    `- DNS Provider: ${dnsProvider}`,
    `- Edge Provider: ${edgeProvider}`,
    `- WAF Provider: ${wafProvider}`,
    `- Partial Module Failures: ${
      failedModules.length > 0 ? failedModules.join(", ") : "none"
    }`,
    "",
  ].join("\n");
}

function buildExecutiveSummary(context: ExportContext): string {
  const summary = parseSummary(context);
  const edgeProvider =
    typeof summary.edgeProvider === "object" &&
    summary.edgeProvider &&
    "provider" in summary.edgeProvider
      ? String((summary.edgeProvider as Record<string, unknown>).provider ?? "unknown")
      : "unknown";

  const topRecommendations = sortRecommendations(context.recommendations)
    .slice(0, 3)
    .map((recommendation) => recommendation.productCode);

  return [
    `# EdgeIntel Report: ${context.run.domain}`,
    "",
    "## Executive Summary",
    "",
    `- Scan Run: ${context.run.id}`,
    `- Generated From Persisted Findings: yes`,
    `- Current Status: ${context.run.status}`,
    `- Observed Edge Provider: ${edgeProvider}`,
    `- Top Cloudflare Motions: ${
      topRecommendations.length > 0 ? topRecommendations.join(", ") : "none"
    }`,
    "",
  ].join("\n");
}

function renderFindingsMarkdown(context: ExportContext): string {
  const sections = groupedFindings(context).map((group) => [
    `### ${group.severity[0]?.toUpperCase()}${group.severity.slice(1)}`,
    "",
    group.findings
      .map((finding) => {
        const title = String(finding.title ?? "Untitled finding");
        const detail = String(finding.detail ?? "");
        const code = String(finding.code ?? "UNKNOWN");
        return `- [${code}] ${title}: ${detail}`;
      })
      .join("\n"),
    "",
  ].join("\n"));

  return [
    "## Findings By Severity",
    "",
    sections.length > 0 ? sections.join("\n") : "- No findings recorded.",
    "",
  ].join("\n");
}

function renderRecommendationMarkdown(recommendation: PersistedRecommendation): string {
  const prerequisites = parseRecommendationList<string>(
    recommendation,
    "prerequisitesJson",
  );
  const blockedBy = parseRecommendationList<string>(recommendation, "blockedByJson");
  const evidenceRefs = parseRecommendationList<string>(recommendation, "evidenceJson");

  return [
    `### ${recommendation.title}`,
    "",
    `- Product: ${recommendation.productCode}`,
    `- Rollout Phase: ${recommendationRolloutKey(recommendation)}`,
    `- Priority: ${recommendation.priority}`,
    `- Confidence: ${recommendation.confidence}`,
    `- Expected Impact: ${recommendation.expectedImpact}`,
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

function renderRecommendationsSection(context: ExportContext): string {
  const recommendations = sortRecommendations(context.recommendations);
  return [
    "## Recommended Cloudflare Products",
    "",
    recommendations.length > 0
      ? recommendations.map(renderRecommendationMarkdown).join("\n")
      : "No recommendations generated.",
    "",
  ].join("\n");
}

function renderRolloutOrder(context: ExportContext): string {
  const recommendations = sortRecommendations(context.recommendations);
  return [
    "## Rollout Order",
    "",
    recommendations.length > 0
      ? recommendations
          .map(
            (recommendation, index) =>
              `${index + 1}. Phase ${recommendationRolloutKey(recommendation)} - ${
                recommendation.productCode
              }: ${recommendation.title}`,
          )
          .join("\n")
      : "No rollout steps available.",
    "",
  ].join("\n");
}

function renderArtifactIndex(context: ExportContext): string {
  return [
    "## Artifacts Index",
    "",
    context.artifacts.length > 0
      ? context.artifacts
          .map(
            (artifact) =>
              `- ${artifact.kind}: ${artifact.objectKey} (${artifact.contentType})`,
          )
          .join("\n")
      : "- No artifacts captured.",
    "",
  ].join("\n");
}

function renderExportManifestMarkdown(
  context: ExportContext,
  format: ExportFormat,
): string {
  const manifest = buildExportManifest(context, format);
  return [
    "## Export Manifest",
    "",
    `- Schema Version: ${manifest.schemaVersion}`,
    `- Generated At: ${manifest.generatedAt}`,
    `- Scan Run ID: ${manifest.scanRunId}`,
    `- Artifact Count: ${manifest.artifactCount}`,
    `- Recommendation Count: ${manifest.recommendationCount}`,
    "",
  ].join("\n");
}

export function renderMarkdownExport(context: ExportContext): string {
  return [
    buildExecutiveSummary(context),
    renderPostureBlock(context),
    renderFindingsMarkdown(context),
    renderRecommendationsSection(context),
    renderRolloutOrder(context),
    renderArtifactIndex(context),
    renderExportManifestMarkdown(context, "markdown"),
  ].join("\n");
}

export function renderTerraformExport(context: ExportContext): string {
  const recommendations = sortRecommendations(context.recommendations);

  const blocks = recommendations.map((recommendation) => {
    switch (recommendation.productCode) {
      case "WAF":
        return `
# Phase ${recommendationRolloutKey(recommendation)}: ${recommendation.title}
# ${recommendation.technicalSummary}
resource "cloudflare_ruleset" "edgeintel_waf" {
  zone_id = var.zone_id
  name    = "EdgeIntel recommended WAF rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"
}
`;
      case "TURNSTILE":
        return `
# Phase ${recommendationRolloutKey(recommendation)}: ${recommendation.title}
# Turnstile widget creation is account-scoped and should be wired into the application flows after widget creation.
`;
      case "LOAD_BALANCING":
        return `
# Phase ${recommendationRolloutKey(recommendation)}: ${recommendation.title}
# ${recommendation.technicalSummary}
resource "cloudflare_load_balancer" "edgeintel_lb" {
  zone_id          = var.zone_id
  default_pools    = []
  fallback_pool_id = ""
  name             = "edgeintel-origin-balancer"
}
`;
      case "CACHE_RULES":
        return `
# Phase ${recommendationRolloutKey(recommendation)}: ${recommendation.title}
# ${recommendation.technicalSummary}
resource "cloudflare_ruleset" "edgeintel_cache" {
  zone_id = var.zone_id
  name    = "EdgeIntel cache rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"
}
`;
      default:
        return `
# Phase ${recommendationRolloutKey(recommendation)}: ${recommendation.productCode}
# ${recommendation.title}
# ${recommendation.technicalSummary}
`;
    }
  });

  return [
    `# ${EXPORT_SCHEMA_VERSION}`,
    `# Scan Run: ${context.run.id}`,
    `# Domain: ${context.run.domain}`,
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
  const recommendations = sortRecommendations(context.recommendations);

  const groupedByProduct = Object.fromEntries(
    recommendations.map((recommendation) => [
      recommendation.productCode,
      {
        title: recommendation.title,
        rollout: {
          phase: recommendation.phase,
          sequence: recommendation.sequence,
          blockedBy: parseRecommendationList<string>(
            recommendation,
            "blockedByJson",
          ),
        },
        summaries: {
          executive: recommendation.executiveSummary,
          technical: recommendation.technicalSummary,
        },
        evidenceRefs: parseRecommendationList<string>(
          recommendation,
          "evidenceJson",
        ),
        expectedImpact: recommendation.expectedImpact,
        payload: safeJsonParse<Record<string, unknown>>(
          recommendation.exportJson,
          {},
        ),
      },
    ]),
  );

  return JSON.stringify(
    {
      manifest: buildExportManifest(context, "cf-api"),
      recommendationsByProduct: groupedByProduct,
    },
    null,
    2,
  );
}

export function renderJsonExport(context: ExportContext): string {
  return JSON.stringify(
    {
      manifest: buildExportManifest(context, "json"),
      run: context.run,
      findings: context.findings,
      artifacts: context.artifacts,
      recommendations: sortRecommendations(context.recommendations).map(
        (recommendation) => ({
          id: recommendation.id,
          scanRunId: recommendation.scanRunId,
          productCode: recommendation.productCode,
          title: recommendation.title,
          rationale: recommendation.rationale,
          priority: recommendation.priority,
          confidence: recommendation.confidence,
          phase: recommendation.phase,
          sequence: recommendation.sequence,
          expectedImpact: recommendation.expectedImpact,
          technicalSummary: recommendation.technicalSummary,
          executiveSummary: recommendation.executiveSummary,
          blockedBy: parseRecommendationList(recommendation, "blockedByJson"),
          evidenceRefs: parseRecommendationList(recommendation, "evidenceJson"),
          prerequisites: parseRecommendationList(
            recommendation,
            "prerequisitesJson",
          ),
          exportPayload: safeJsonParse(recommendation.exportJson, {}),
          createdAt: recommendation.createdAt,
        }),
      ),
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
