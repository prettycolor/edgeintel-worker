import type {
  CommercialBriefView,
  CommercialMotion,
  CommercialScorecard,
  PersistedArtifact,
  PersistedRecommendation,
  PersistedScanRun,
  ProviderSignal,
  RecommendationPriority,
  ScanResultBundle,
  ScanSummary,
} from "../types";
import { nowIso, safeJsonParse } from "./utils";

interface CommercialBriefContext {
  run: PersistedScanRun;
  findings: Array<Record<string, unknown>>;
  artifacts: PersistedArtifact[];
  recommendations: PersistedRecommendation[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreStatus(score: number): CommercialScorecard["status"] {
  if (score >= 75) return "strong";
  if (score >= 45) return "moderate";
  return "weak";
}

function card(score: number, summary: string): CommercialScorecard {
  return {
    score,
    status: scoreStatus(score),
    summary,
  };
}

function parseSummary(context: CommercialBriefContext): ScanSummary {
  return safeJsonParse<ScanSummary>(context.run.scanSummaryJson, {
    domain: context.run.domain,
    dnsProvider: { provider: null, confidence: 0, evidence: [] },
    edgeProvider: { provider: null, confidence: 0, evidence: [] },
    wafProvider: { provider: null, confidence: 0, evidence: [] },
    originProvider: { provider: null, confidence: 0, evidence: [] },
    originHints: [],
    apiSurfaceDetected: false,
    authSurfaceDetected: false,
    cacheSignals: [],
    missingSecurityHeaders: [],
    finalUrl: context.run.finalUrl,
  });
}

function parseBundle(context: CommercialBriefContext): ScanResultBundle | null {
  return safeJsonParse<ScanResultBundle | null>(context.run.rawResultJson, null);
}

function findingCodes(context: CommercialBriefContext): Set<string> {
  return new Set(
    context.findings
      .map((finding) =>
        typeof finding.code === "string" ? finding.code : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
}

function hasRecommendation(
  recommendations: PersistedRecommendation[],
  productCode: string,
): boolean {
  return recommendations.some(
    (recommendation) => recommendation.productCode === productCode,
  );
}

function parseRecommendationList(
  recommendation: PersistedRecommendation,
  key: "evidenceJson" | "blockedByJson" | "prerequisitesJson",
): string[] {
  return safeJsonParse<string[]>(recommendation[key], []);
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

function summarizeProvider(signal: ProviderSignal | null | undefined): string {
  if (!signal?.provider) return "Unknown";
  if (signal.category) {
    return `${signal.provider} (${signal.category})`;
  }
  return signal.provider;
}

function buildCloudflareFit(
  summary: ScanSummary,
  codes: Set<string>,
  recommendations: PersistedRecommendation[],
): CommercialScorecard {
  let score = 38;

  if (summary.dnsProvider.provider !== "Cloudflare") score += 10;
  if (summary.edgeProvider.provider !== "Cloudflare") score += 22;
  if (summary.authSurfaceDetected) score += 8;
  if (summary.apiSurfaceDetected) score += 6;
  if (codes.has("CACHE_POLICY_WEAK")) score += 10;
  score += Math.min(12, summary.missingSecurityHeaders.length * 3);
  if (summary.originProvider?.provider) score += 8;
  if (hasRecommendation(recommendations, "SMART_ROUTING")) score += 4;
  if (hasRecommendation(recommendations, "WAF")) score += 6;

  const clamped = clamp(score, 20, 98);
  const summaryLine =
    clamped >= 75
      ? "The current posture maps cleanly to Cloudflare expansion across protection, performance, and routing."
      : clamped >= 45
        ? "There is a credible Cloudflare motion, but the strongest value depends on which edge and origin gaps matter most."
        : "The Cloudflare fit is still real, but the current scan surfaces fewer high-leverage upgrade motions.";

  return card(clamped, summaryLine);
}

function buildAccessHardening(
  summary: ScanSummary,
  codes: Set<string>,
): CommercialScorecard {
  let score = 86;

  if (summary.authSurfaceDetected) score -= 20;
  if (summary.edgeProvider.provider !== "Cloudflare") score -= 16;
  if (codes.has("PUBLIC_EDGE_DENIED")) score -= 8;
  score -= Math.min(28, summary.missingSecurityHeaders.length * 5);
  if (summary.wafProvider.provider === "Cloudflare") score += 6;

  const clamped = clamp(score, 12, 96);
  const summaryLine =
    clamped >= 75
      ? "The scan already shows a relatively deliberate access posture."
      : clamped >= 45
        ? "Access controls exist, but they are not yet expressed as a clear Cloudflare-first hardening story."
        : "This is a weak access-hardening posture for an externally reachable production surface.";

  return card(clamped, summaryLine);
}

function buildLatencyOpportunity(
  summary: ScanSummary,
  bundle: ScanResultBundle | null,
  codes: Set<string>,
): CommercialScorecard {
  let score = 24;

  if (summary.edgeProvider.provider !== "Cloudflare") score += 16;
  if (codes.has("CACHE_POLICY_WEAK")) score += 18;
  if ((bundle?.http.redirectChain.length ?? 0) > 2) {
    score += Math.min(12, (bundle?.http.redirectChain.length ?? 0) * 3);
  }
  if ((bundle?.http.staticAssetHints.length ?? 0) > 3) score += 8;
  if (summary.cacheSignals.length === 0) score += 8;

  const clamped = clamp(score, 10, 94);
  const summaryLine =
    clamped >= 75
      ? "There is a meaningful edge-performance win available from Cloudflare caching and network-path optimization."
      : clamped >= 45
        ? "There is some performance upside, but it is secondary to the protection and routing story."
        : "Performance improvement is available, but it is not the primary motion from this scan.";

  return card(clamped, summaryLine);
}

function buildResilienceOpportunity(
  summary: ScanSummary,
  bundle: ScanResultBundle | null,
  recommendations: PersistedRecommendation[],
): CommercialScorecard {
  let score = 22;
  const originCount = (bundle?.dns.a.length ?? 0) + (bundle?.dns.aaaa.length ?? 0);

  if (originCount > 1) score += Math.min(18, originCount * 6);
  if (summary.edgeProvider.provider !== "Cloudflare") score += 10;
  if (hasRecommendation(recommendations, "LOAD_BALANCING")) score += 18;
  if ((bundle?.http.redirectChain.length ?? 0) > 2) score += 6;

  const clamped = clamp(score, 8, 92);
  const summaryLine =
    clamped >= 75
      ? "The scan shows a strong case for formalizing resilience with explicit Cloudflare routing and failover controls."
      : clamped >= 45
        ? "There is a believable resilience story, especially if multi-origin intent or failover needs to be made explicit."
        : "Resilience is not the dominant sales motion from the current posture, even if it remains a secondary benefit.";

  return card(clamped, summaryLine);
}

function buildOriginExposure(
  summary: ScanSummary,
  codes: Set<string>,
): CommercialBriefView["originExposure"] {
  const providerConfidence = summary.originProvider?.confidence ?? 0;
  const hintCount = summary.originHints.length;
  const riskScore =
    providerConfidence +
    hintCount * 6 +
    (codes.has("EDGE_NOT_ON_CLOUDFLARE") ? 18 : 0) +
    (codes.has("CACHE_POLICY_WEAK") ? 8 : 0);

  const risk =
    riskScore >= 90 ? "high" : riskScore >= 55 ? "medium" : "low";

  const providerLabel = summary.originProvider?.provider
    ? ` with hints toward ${summary.originProvider.provider}`
    : "";

  const summaryLine =
    risk === "high"
      ? `Origin infrastructure looks materially attributable${providerLabel}, which strengthens the case for shielding and policy consolidation at the edge.`
      : risk === "medium"
        ? `Some origin-identifying hints are visible${providerLabel}, but the exposure story is not absolute.`
        : "The scan does not strongly expose origin infrastructure from the public surface.";

  return {
    risk,
    confidence: clamp(riskScore, 0, 98),
    summary: summaryLine,
    hints: summary.originHints.slice(0, 6),
  };
}

function buildWhyNow(
  summary: ScanSummary,
  codes: Set<string>,
  recommendations: PersistedRecommendation[],
): string[] {
  const reasons = [
    summary.edgeProvider.provider !== "Cloudflare"
      ? "Traffic does not currently appear to terminate on Cloudflare, so the protection and performance surface is still fragmented."
      : null,
    summary.authSurfaceDetected
      ? "Authentication-related surface is visible, which makes bot mitigation and access hardening immediately relevant."
      : null,
    summary.apiSurfaceDetected
      ? "Public API hints were detected, which creates a natural path into API Shield and route-aware controls."
      : null,
    codes.has("CACHE_POLICY_WEAK")
      ? "Weak cache posture suggests avoidable origin load and a clear performance story."
      : null,
    summary.originProvider?.provider
      ? `Origin infrastructure still looks attributable to ${summary.originProvider.provider}, which is a strong edge-shielding motion.`
      : null,
    hasRecommendation(recommendations, "LOAD_BALANCING")
      ? "Multiple publicly visible origin addresses suggest resilience is currently implicit instead of explicit."
      : null,
  ].filter((value): value is string => Boolean(value));

  return reasons.slice(0, 4);
}

function priorityWeight(priority: RecommendationPriority): number {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function buildCommercialMotions(
  recommendations: PersistedRecommendation[],
): CommercialMotion[] {
  return sortRecommendations(recommendations)
    .sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority))
    .slice(0, 4)
    .map((recommendation) => ({
      productCode: recommendation.productCode,
      title: recommendation.title,
      reason: recommendation.executiveSummary || recommendation.rationale,
      priority: recommendation.priority,
      phase: recommendation.phase,
      evidenceRefs: parseRecommendationList(recommendation, "evidenceJson"),
    }));
}

function renderCommercialBriefMarkdown(brief: Omit<CommercialBriefView, "markdown">): string {
  return [
    `# Commercial Brief: ${brief.domain}`,
    "",
    "## Why This Is A Cloudflare Motion",
    "",
    ...brief.whyNow.map((entry) => `- ${entry}`),
    "",
    "## Scorecards",
    "",
    `- Cloudflare Fit: ${brief.cloudflareFit.score}/100 (${brief.cloudflareFit.status})`,
    `- Access Hardening: ${brief.accessHardening.score}/100 (${brief.accessHardening.status})`,
    `- Latency Opportunity: ${brief.latencyOpportunity.score}/100 (${brief.latencyOpportunity.status})`,
    `- Resilience Opportunity: ${brief.resilienceOpportunity.score}/100 (${brief.resilienceOpportunity.status})`,
    `- Origin Exposure: ${brief.originExposure.risk} (${brief.originExposure.confidence}/100)`,
    "",
    "## Customer Narrative",
    "",
    brief.customerNarrative,
    "",
    "## Operator Narrative",
    "",
    brief.operatorNarrative,
    "",
    "## Migration Narrative",
    "",
    brief.migrationNarrative,
    "",
    "## Expansion Candidates",
    "",
    ...brief.expansionCandidates.map(
      (candidate, index) =>
        `${index + 1}. ${candidate.productCode}: ${candidate.reason}`,
    ),
    "",
  ].join("\n");
}

export function buildCommercialBrief(
  context: CommercialBriefContext,
): CommercialBriefView {
  const summary = parseSummary(context);
  const bundle = parseBundle(context);
  const codes = findingCodes(context);
  const expansionCandidates = buildCommercialMotions(context.recommendations);
  const cloudflareFit = buildCloudflareFit(summary, codes, context.recommendations);
  const accessHardening = buildAccessHardening(summary, codes);
  const latencyOpportunity = buildLatencyOpportunity(summary, bundle, codes);
  const resilienceOpportunity = buildResilienceOpportunity(
    summary,
    bundle,
    context.recommendations,
  );
  const originExposure = buildOriginExposure(summary, codes);
  const whyNow = buildWhyNow(summary, codes, context.recommendations);

  const briefWithoutMarkdown: Omit<CommercialBriefView, "markdown"> = {
    domain: context.run.domain,
    generatedAt: nowIso(),
    posture: {
      finalUrl: context.run.finalUrl,
      dnsProvider: summary.dnsProvider,
      edgeProvider: summary.edgeProvider,
      wafProvider: summary.wafProvider,
      originProvider: summary.originProvider ?? null,
      authSurfaceDetected: summary.authSurfaceDetected,
      apiSurfaceDetected: summary.apiSurfaceDetected,
      missingSecurityHeaders: summary.missingSecurityHeaders,
    },
    cloudflareFit,
    accessHardening,
    latencyOpportunity,
    resilienceOpportunity,
    originExposure,
    whyNow,
    customerNarrative:
      summary.edgeProvider.provider === "Cloudflare"
        ? "This environment is already using part of the Cloudflare stack, but the scan shows clear room to deepen policy, resilience, and application-aware controls."
        : "This environment is still outside Cloudflare's main edge control plane, and the scan shows enough public posture friction to justify a concrete migration and hardening conversation now.",
    operatorNarrative: `Observed DNS on ${summarizeProvider(summary.dnsProvider)} with edge traffic on ${summarizeProvider(summary.edgeProvider)}. The strongest next moves are ${expansionCandidates
      .slice(0, 2)
      .map((candidate) => candidate.productCode)
      .join(" and ") || "deeper edge hardening"}.`,
    migrationNarrative:
      summary.originProvider?.provider && summary.edgeProvider.provider !== "Cloudflare"
        ? `Because the public surface still leaks hints toward ${summary.originProvider.provider}, Cloudflare can be positioned as both the protection layer and the origin-shielding layer rather than only a CDN swap.`
        : "The migration story is strongest when framed as edge policy consolidation first, then performance and resilience expansion once proxy adoption is stable.",
    expansionCandidates,
  };

  return {
    ...briefWithoutMarkdown,
    markdown: renderCommercialBriefMarkdown(briefWithoutMarkdown),
  };
}
