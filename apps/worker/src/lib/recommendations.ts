import type {
  Finding,
  Recommendation,
  RecommendationPhase,
  RecommendationPriority,
  ScanResultBundle,
} from "../types";

const SEVERITY_SCORE: Record<Finding["severity"], number> = {
  critical: 32,
  high: 20,
  medium: 12,
  low: 6,
  info: 3,
};

interface RecommendationDraft {
  productCode: string;
  title: string;
  rationale: string;
  expectedImpact: string;
  phase: RecommendationPhase;
  sequence: number;
  blockedBy: string[];
  evidenceRefs: string[];
  technicalSummary: string;
  executiveSummary: string;
  prerequisites: string[];
  exportPayload: Record<string, unknown>;
  confidence: number;
  priority: RecommendationPriority;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function recommendation(partial: RecommendationDraft): Recommendation {
  return {
    id: crypto.randomUUID(),
    ...partial,
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function matchFindings(findings: Finding[], codes: string[]): Finding[] {
  const codeSet = new Set(codes);
  return findings.filter((finding) => codeSet.has(finding.code));
}

function scoreFindings(findings: Finding[]): number {
  return findings.reduce(
    (total, finding) => total + SEVERITY_SCORE[finding.severity],
    0,
  );
}

function confidenceFromScore(base: number, score: number, evidenceCount: number): number {
  return clamp(Math.round(base + score / 3 + evidenceCount * 2), 52, 96);
}

function priorityFromScore(score: number): RecommendationPriority {
  if (score >= 70) return "critical";
  if (score >= 48) return "high";
  if (score >= 28) return "medium";
  return "low";
}

function pathCandidates(
  finalUrl: string | null,
  defaults: string[],
  discovered: string[] = [],
): string[] {
  const urlPath = finalUrl
    ? (() => {
        try {
          const parsed = new URL(finalUrl);
          return parsed.pathname !== "/" ? parsed.pathname : null;
        } catch {
          return null;
        }
      })()
    : null;

  return unique([urlPath, ...discovered, ...defaults]).slice(0, 8);
}

function onboardingPrerequisites(bundle: ScanResultBundle): string[] {
  return bundle.summary.edgeProvider.provider === "Cloudflare"
    ? []
    : [
        "Proxy the target hostnames through Cloudflare before enabling edge-enforced controls.",
      ];
}

function onboardingBlockers(bundle: ScanResultBundle): string[] {
  return bundle.summary.edgeProvider.provider === "Cloudflare"
    ? []
    : ["cloudflare_proxy_adoption"];
}

function makeSummaryEvidence(bundle: ScanResultBundle, extra: string[] = []): string[] {
  return unique([
    bundle.summary.authSurfaceDetected ? "summary:auth_surface_detected" : null,
    bundle.summary.apiSurfaceDetected ? "summary:api_surface_detected" : null,
    bundle.summary.edgeProvider.provider
      ? `summary:edge_provider:${bundle.summary.edgeProvider.provider}`
      : "summary:edge_provider:unknown",
    bundle.summary.dnsProvider.provider
      ? `summary:dns_provider:${bundle.summary.dnsProvider.provider}`
      : "summary:dns_provider:unknown",
    bundle.http.redirectChain.length > 2
      ? `http:redirect_chain:${bundle.http.redirectChain.length}`
      : null,
    bundle.dns.a.length + bundle.dns.aaaa.length > 1
      ? `dns:multi_origin_ips:${bundle.dns.a.length + bundle.dns.aaaa.length}`
      : null,
    ...extra,
  ]);
}

function buildWafRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const matched = matchFindings(bundle.findings, [
    "EDGE_NOT_ON_CLOUDFLARE",
    "PUBLIC_EDGE_DENIED",
    "MISSING_CONTENT_SECURITY_POLICY",
    "MISSING_X_FRAME_OPTIONS",
    "MISSING_STRICT_TRANSPORT_SECURITY",
    "AUTH_SURFACE_DETECTED",
  ]);
  if (matched.length === 0) return null;

  const score =
    scoreFindings(matched) +
    (bundle.summary.authSurfaceDetected ? 12 : 0) +
    (bundle.http.surfaceClassification.isDenied ? 10 : 0);

  const loginPaths = pathCandidates(bundle.http.finalUrl, [
    "/login",
    "/signin",
    "/admin",
    "/wp-login.php",
  ]);
  const blockedBy = onboardingBlockers(bundle);
  const evidenceRefs = makeSummaryEvidence(bundle, matched.map((finding) => finding.code));

  return recommendation({
    productCode: "WAF",
    title: "Adopt Cloudflare WAF with managed rules and targeted auth protections",
    rationale:
      "The scan shows edge protection gaps and security-header weakness on a public web surface. Cloudflare WAF should become the policy anchor before finer-grained product rollouts.",
    expectedImpact:
      "Creates a centralized enforcement layer for commodity attacks, admin/auth abuse, and policy normalization at the edge.",
    phase: 1,
    sequence: 20,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Enable Cloudflare Managed Rules, then add custom expressions for high-risk login and admin routes with managed challenge or block actions where appropriate.",
    executiveSummary:
      "This is the fastest way to raise baseline protection and make the edge posture look intentionally managed instead of reactive.",
    prerequisites: onboardingPrerequisites(bundle),
    exportPayload: {
      product: "waf",
      managedRulesets: [
        "cloudflare-managed-core",
        "cloudflare-managed-owasp",
      ],
      customRules: [
        {
          description: "Challenge suspicious login and admin traffic",
          expression: `(http.request.uri.path in {${loginPaths
            .map((path) => `"${path}"`)
            .join(" ")}} and cf.threat_score gt 10)`,
          action: "managed_challenge",
        },
        {
          description: "Block suspicious method/path combinations",
          expression:
            '(http.request.method in {"TRACE" "CONNECT"} or starts_with(lower(http.request.uri.path), "/wp-admin"))',
          action: "block",
        },
      ],
      rolloutOrder: [
        "enable_managed_rules",
        "simulate_custom_rules",
        "promote_to_enforcement",
      ],
    },
    confidence: confidenceFromScore(68, score, evidenceRefs.length),
    priority: priorityFromScore(score + 10),
  });
}

function buildBotManagementRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const matched = matchFindings(bundle.findings, [
    "AUTH_SURFACE_DETECTED",
    "PUBLIC_EDGE_DENIED",
    "REDIRECT_CHAIN_COMPLEX",
  ]);
  if (!bundle.summary.authSurfaceDetected && matched.length === 0) return null;

  const score =
    scoreFindings(matched) +
    (bundle.summary.authSurfaceDetected ? 16 : 0) +
    (bundle.http.surfaceClassification.isDenied ? 8 : 0);
  const blockedBy = onboardingBlockers(bundle);
  const evidenceRefs = makeSummaryEvidence(bundle, matched.map((finding) => finding.code));

  return recommendation({
    productCode: "BOT_MANAGEMENT",
    title: "Use Bot Management on authentication and abuse-sensitive routes",
    rationale:
      "Authentication-related surface and denial-oriented responses suggest automation pressure or defensive controls that should be made explicit through bot scoring and route-specific policy.",
    expectedImpact:
      "Improves credential-abuse handling and reduces noisy security operations around login and abuse-prone endpoints.",
    phase: 2,
    sequence: 20,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Start in monitoring mode on login, signup, and reset flows, then challenge low bot-score traffic while exempting known automation and health checks.",
    executiveSummary:
      "This turns likely bot pressure into something measurable and enforceable instead of relying on ad hoc denial behavior.",
    prerequisites: onboardingPrerequisites(bundle),
    exportPayload: {
      product: "bot_management",
      candidatePaths: pathCandidates(bundle.http.finalUrl, [
        "/login",
        "/signin",
        "/password-reset",
        "/reset-password",
      ]),
      enforcementPlan: [
        "observe_bot_scores",
        "challenge_high-risk_auth_paths",
        "add_allowlist_exceptions",
      ],
    },
    confidence: confidenceFromScore(66, score, evidenceRefs.length),
    priority: priorityFromScore(score),
  });
}

function buildTurnstileRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const matched = matchFindings(bundle.findings, [
    "AUTH_SURFACE_DETECTED",
    "PUBLIC_EDGE_DENIED",
  ]);
  if (!bundle.summary.authSurfaceDetected && matched.length === 0) return null;

  const score = scoreFindings(matched) + (bundle.summary.authSurfaceDetected ? 12 : 0);
  const evidenceRefs = makeSummaryEvidence(bundle, matched.map((finding) => finding.code));

  return recommendation({
    productCode: "TURNSTILE",
    title: "Place Turnstile on login, reset, and high-risk form flows",
    rationale:
      "Interactive verification is a low-friction way to harden visible auth or abuse-prone flows, especially when those routes are already under pressure.",
    expectedImpact:
      "Reduces form abuse and adds a lightweight human verification layer without forcing a heavyweight CAPTCHA experience.",
    phase: 2,
    sequence: 10,
    blockedBy: [],
    evidenceRefs,
    technicalSummary:
      "Deploy Turnstile on login, account recovery, contact, and signup flows first, then evaluate completion and challenge rates before expanding.",
    executiveSummary:
      "Turnstile is the easiest visible trust-control upgrade in the stack and pairs well with bot mitigation without increasing user friction too much.",
    prerequisites: [],
    exportPayload: {
      product: "turnstile",
      candidateFlows: pathCandidates(bundle.http.finalUrl, [
        "/login",
        "/signup",
        "/password-reset",
        "/contact",
      ]),
      deploymentMode: "managed_widget",
    },
    confidence: confidenceFromScore(70, score, evidenceRefs.length),
    priority: priorityFromScore(score - 4),
  });
}

function buildApiShieldRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const matched = matchFindings(bundle.findings, ["API_SURFACE_DETECTED"]);
  if (!bundle.summary.apiSurfaceDetected && matched.length === 0) return null;

  const candidateRoutes = unique(bundle.http.apiHints).slice(0, 20);
  const score =
    scoreFindings(matched) +
    (bundle.summary.apiSurfaceDetected ? 18 : 0) +
    (candidateRoutes.length > 3 ? 6 : 0);
  const blockedBy = unique([
    ...onboardingBlockers(bundle),
    "api_route_inventory_confirmation",
  ]);
  const evidenceRefs = makeSummaryEvidence(bundle, [
    ...matched.map((finding) => finding.code),
    ...candidateRoutes.map((route) => `api:${route}`),
  ]);

  return recommendation({
    productCode: "API_SHIELD",
    title: "Introduce API Shield on public API routes with staged enforcement",
    rationale:
      "The scan detected public API indicators, which makes route-aware schema, token, and sequence controls much more relevant than generic web-only protection.",
    expectedImpact:
      "Improves API security posture with learned or explicit schemas, stronger auth enforcement, and route-specific controls.",
    phase: 2,
    sequence: 30,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Inventory the exposed API routes, enable schema learning, validate JWT or mTLS posture, then move to sequence and abuse controls on the highest-value endpoints.",
    executiveSummary:
      "If the application exposes public API behavior, API Shield is the cleanest way to show Cloudflare depth beyond generic CDN and WAF positioning.",
    prerequisites: unique([
      ...onboardingPrerequisites(bundle),
      "Confirm the production API route inventory and auth model.",
    ]),
    exportPayload: {
      product: "api_shield",
      candidateRoutes,
      rolloutStages: [
        "schema_learning",
        "token_validation",
        "sequence_controls",
      ],
    },
    confidence: confidenceFromScore(72, score, evidenceRefs.length),
    priority: priorityFromScore(score + 4),
  });
}

function buildLoadBalancingRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const originAddresses = unique([
    ...bundle.dns.a.map((record) => record.data),
    ...bundle.dns.aaaa.map((record) => record.data),
  ]);
  if (originAddresses.length <= 1) return null;

  const matched = matchFindings(bundle.findings, ["REDIRECT_CHAIN_COMPLEX"]);
  const score = scoreFindings(matched) + 22 + originAddresses.length * 4;
  const blockedBy = unique([
    ...onboardingBlockers(bundle),
    "origin_inventory_confirmation",
    "health_check_design",
  ]);
  const evidenceRefs = makeSummaryEvidence(bundle, [
    ...matched.map((finding) => finding.code),
    ...originAddresses.map((origin) => `origin:${origin}`),
  ]);

  return recommendation({
    productCode: "LOAD_BALANCING",
    title: "Formalize multi-origin routing with Cloudflare Load Balancing",
    rationale:
      "Multiple public origin addresses are visible, which is a strong indicator that origin routing and failover should be made explicit rather than left implicit in DNS or app behavior.",
    expectedImpact:
      "Improves origin resilience, documents failover intent, and creates a cleaner implementation path for regional or redundant origin strategy.",
    phase: 3,
    sequence: 10,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Define origin pools from the observed public IPs, attach health checks, then map failover behavior explicitly instead of relying on ambient DNS state.",
    executiveSummary:
      "This is the resilience control that turns a probable multi-origin pattern into a documented and supportable architecture.",
    prerequisites: unique([
      ...onboardingPrerequisites(bundle),
      "Confirm which observed IPs are production-serving origins and which are standby or legacy endpoints.",
    ]),
    exportPayload: {
      product: "load_balancing",
      originHints: originAddresses,
      healthCheckPlan: {
        protocol: "HTTPS",
        path: "/",
        interval: 60,
      },
      rolloutStages: ["define_pools", "attach_monitors", "enable_failover"],
    },
    confidence: confidenceFromScore(62, score, evidenceRefs.length),
    priority: priorityFromScore(score),
  });
}

function buildCacheRulesRecommendation(bundle: ScanResultBundle): Recommendation | null {
  const matched = matchFindings(bundle.findings, ["CACHE_POLICY_WEAK"]);
  if (matched.length === 0 && bundle.http.staticAssetHints.length === 0) return null;

  const candidatePatterns = unique([
    ...bundle.http.staticAssetHints,
    "/assets/*",
    "/static/*",
    "*.css",
    "*.js",
  ]).slice(0, 10);
  const score =
    scoreFindings(matched) +
    (candidatePatterns.length > 0 ? 18 : 0) +
    (bundle.summary.cacheSignals.length === 0 ? 10 : 0);
  const blockedBy = onboardingBlockers(bundle);
  const evidenceRefs = makeSummaryEvidence(bundle, [
    ...matched.map((finding) => finding.code),
    ...candidatePatterns.map((pattern) => `cache:${pattern}`),
  ]);

  return recommendation({
    productCode: "CACHE_RULES",
    title: "Define Cloudflare Cache Rules and origin-shielding policy",
    rationale:
      "The current response does not advertise a strong cache posture even though the surface exposes static asset patterns that should be cacheable at the edge.",
    expectedImpact:
      "Reduces avoidable origin traffic and improves consistency for cacheable application assets and responses.",
    phase: 3,
    sequence: 20,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Start by caching static assets explicitly, then evaluate Tiered Cache and Cache Reserve for high-repeat traffic while excluding auth and personalized routes.",
    executiveSummary:
      "This is the clearest performance and origin-offload win in the current posture without requiring application changes first.",
    prerequisites: onboardingPrerequisites(bundle),
    exportPayload: {
      product: "cache_rules",
      candidatePatterns,
      exclusions: ["/login*", "/account*", "/checkout*"],
      companionFeatures: ["tiered_cache", "cache_reserve"],
    },
    confidence: confidenceFromScore(64, score, evidenceRefs.length),
    priority: priorityFromScore(score),
  });
}

function buildSmartRoutingRecommendation(bundle: ScanResultBundle): Recommendation | null {
  if (!bundle.http.finalUrl?.startsWith("https://")) return null;

  const matched = matchFindings(bundle.findings, [
    "EDGE_NOT_ON_CLOUDFLARE",
    "REDIRECT_CHAIN_COMPLEX",
  ]);
  const score =
    scoreFindings(matched) +
    (bundle.summary.edgeProvider.provider !== "Cloudflare" ? 12 : 0) +
    (bundle.http.redirectChain.length > 1 ? 8 : 0);
  const blockedBy = unique([
    ...onboardingBlockers(bundle),
    "origin_latency_baseline",
  ]);
  const evidenceRefs = makeSummaryEvidence(bundle, matched.map((finding) => finding.code));

  return recommendation({
    productCode: "SMART_ROUTING",
    title: "Enable Smart Routing after proxy adoption and origin baselining",
    rationale:
      "Once the workload is consistently proxied through Cloudflare, Smart Routing becomes the network-level optimization lever for origin path quality and resilience.",
    expectedImpact:
      "Improves request path quality and gives a cleaner latency and resilience story for globally distributed traffic.",
    phase: 4,
    sequence: 10,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Baseline origin latency first, then enable Smart Routing only after edge proxying is stable so its impact is measurable.",
    executiveSummary:
      "This is the performance optimization layer to apply after the core protection and origin-mapping work is already under control.",
    prerequisites: unique([
      ...onboardingPrerequisites(bundle),
      "Capture baseline origin latency before enabling Smart Routing.",
    ]),
    exportPayload: {
      product: "argo_smart_routing",
      readinessChecks: [
        "cloudflare_proxy_enabled",
        "origin_latency_baselined",
      ],
    },
    confidence: confidenceFromScore(58, score, evidenceRefs.length),
    priority: priorityFromScore(score - 6),
  });
}

function buildAdvancedCertificateManagerRecommendation(
  bundle: ScanResultBundle,
): Recommendation | null {
  if (!bundle.http.finalUrl?.startsWith("https://")) return null;

  const matched = matchFindings(bundle.findings, [
    "MISSING_STRICT_TRANSPORT_SECURITY",
    "DNS_NOT_ON_CLOUDFLARE",
  ]);
  if (matched.length === 0) return null;

  const score =
    scoreFindings(matched) +
    (bundle.http.finalUrl?.startsWith("https://") ? 12 : 0);
  const blockedBy = unique([
    ...onboardingBlockers(bundle),
    "certificate_ownership_confirmation",
  ]);
  const evidenceRefs = makeSummaryEvidence(bundle, matched.map((finding) => finding.code));

  return recommendation({
    productCode: "ADVANCED_CERTIFICATE_MANAGER",
    title: "Use Advanced Certificate Manager for deliberate edge TLS ownership",
    rationale:
      "The HTTPS surface is active but not yet clearly governed as an intentional Cloudflare-managed TLS program. Advanced Certificate Manager is the right next step once proxying is in place.",
    expectedImpact:
      "Improves certificate governance, clarifies ownership of edge TLS behavior, and supports a stronger HTTPS rollout story.",
    phase: 1,
    sequence: 30,
    blockedBy,
    evidenceRefs,
    technicalSummary:
      "Confirm certificate ownership and hostname inventory, then move edge TLS policy under explicit management instead of relying on ambient defaults.",
    executiveSummary:
      "This makes HTTPS posture feel deliberate and supportable instead of merely present.",
    prerequisites: unique([
      ...onboardingPrerequisites(bundle),
      "Confirm certificate ownership, hostname scope, and renewal expectations.",
    ]),
    exportPayload: {
      product: "advanced_certificate_manager",
      desiredPolicies: [
        "hostname_inventory_review",
        "edge_certificate_lifecycle_visibility",
        "tls_policy_confirmation",
      ],
    },
    confidence: confidenceFromScore(60, score, evidenceRefs.length),
    priority: priorityFromScore(score - 2),
  });
}

export function deriveRecommendations(bundle: ScanResultBundle): Recommendation[] {
  const recommendations = [
    buildWafRecommendation(bundle),
    buildBotManagementRecommendation(bundle),
    buildTurnstileRecommendation(bundle),
    buildApiShieldRecommendation(bundle),
    buildLoadBalancingRecommendation(bundle),
    buildCacheRulesRecommendation(bundle),
    buildSmartRoutingRecommendation(bundle),
    buildAdvancedCertificateManagerRecommendation(bundle),
  ].filter(Boolean) as Recommendation[];

  return recommendations.sort((left, right) => {
    if (left.phase !== right.phase) return left.phase - right.phase;
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return right.confidence - left.confidence;
  });
}
