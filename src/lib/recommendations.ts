import type { Finding, Recommendation, ScanResultBundle } from "../types";

function recommendation(
  partial: Omit<Recommendation, "id">,
): Recommendation {
  return {
    id: crypto.randomUUID(),
    ...partial,
  };
}

function hasCode(findings: Finding[], code: string): boolean {
  return findings.some((finding) => finding.code === code);
}

export function deriveRecommendations(bundle: ScanResultBundle): Recommendation[] {
  const { findings, summary, dns, http } = bundle;
  const recommendations: Recommendation[] = [];

  const onboardingPrereq =
    summary.edgeProvider.provider === "Cloudflare"
      ? []
      : ["Proxy the zone through Cloudflare edge services before applying advanced controls."];

  if (
    hasCode(findings, "EDGE_NOT_ON_CLOUDFLARE") ||
    hasCode(findings, "MISSING_CONTENT_SECURITY_POLICY") ||
    hasCode(findings, "MISSING_X_FRAME_OPTIONS")
  ) {
    recommendations.push(
      recommendation({
        productCode: "WAF",
        title: "Adopt Cloudflare WAF with managed and custom rules",
        rationale:
          "The site would benefit from managed edge protections plus targeted custom rules for auth, admin, and suspicious request patterns.",
        priority: "critical",
        confidence: 90,
        expectedImpact:
          "Reduces commodity attack traffic, centralizes edge policy, and creates an immediate hardening story.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          terraformResource: "cloudflare_ruleset",
          phase: "http_request_firewall_custom",
          actions: [
            "managed_ruleset_enable",
            "protect_login_and_admin_routes",
            "block_suspicious_method_path_combinations",
          ],
        },
      }),
    );
  }

  if (summary.authSurfaceDetected) {
    recommendations.push(
      recommendation({
        productCode: "BOT_MANAGEMENT",
        title: "Use Bot Management for authentication and abuse-sensitive paths",
        rationale:
          "The detected auth surface suggests likely credential abuse and automation pressure, making bot scoring and challenge policy a high-leverage control.",
        priority: "high",
        confidence: 86,
        expectedImpact:
          "Improves credential-stuffing resilience and reduces operator noise on login endpoints.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          product: "bot_management",
          candidatePaths: http.authHints.slice(0, 10),
          enforcement: "managed_challenge_for_low_bot_scores",
        },
      }),
    );

    recommendations.push(
      recommendation({
        productCode: "TURNSTILE",
        title: "Place Turnstile on login and high-risk interactive flows",
        rationale:
          "Interactive human verification is a low-friction complement to bot scoring where authentication or reset flows are visible.",
        priority: "high",
        confidence: 84,
        expectedImpact:
          "Reduces automated abuse on forms without a heavyweight CAPTCHA story.",
        prerequisites: [],
        exportPayload: {
          product: "turnstile",
          candidateFlows: http.authHints.slice(0, 10),
        },
      }),
    );
  }

  if (summary.apiSurfaceDetected) {
    recommendations.push(
      recommendation({
        productCode: "API_SHIELD",
        title: "Introduce API Shield on public API routes",
        rationale:
          "Public API indicators make API-specific discovery, schema learning, and auth enforcement an obvious next layer of protection.",
        priority: "high",
        confidence: 88,
        expectedImpact:
          "Strengthens API posture with route-aware controls instead of treating APIs like generic web traffic.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          product: "api_shield",
          candidateRoutes: http.apiHints.slice(0, 20),
          rollout: ["schema_learning", "jwt_validation", "sequence_controls"],
        },
      }),
    );
  }

  if (dns.a.length + dns.aaaa.length > 1) {
    recommendations.push(
      recommendation({
        productCode: "LOAD_BALANCING",
        title: "Model multiple public origins with Cloudflare Load Balancing",
        rationale:
          "Multiple public IP targets suggest a multi-origin or failover pattern that should be formalized behind health-aware load balancing.",
        priority: "medium",
        confidence: 72,
        expectedImpact:
          "Creates explicit origin health policy and reduces ad hoc failover behavior.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          product: "load_balancer",
          origins: [...dns.a, ...dns.aaaa].map((record) => record.data),
        },
      }),
    );
  }

  if (hasCode(findings, "CACHE_POLICY_WEAK")) {
    recommendations.push(
      recommendation({
        productCode: "CACHE_RULES",
        title: "Define Cloudflare Cache Rules and edge retention strategy",
        rationale:
          "The current response lacks strong cache policy indicators, so explicit cache rules and reserve controls would reduce origin dependence.",
        priority: "high",
        confidence: 83,
        expectedImpact:
          "Improves performance consistency and origin shielding on cacheable routes and assets.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          product: "cache_rules",
          patterns: ["/assets/*", "/static/*", "*.css", "*.js"],
          companionFeatures: ["tiered_cache", "cache_reserve"],
        },
      }),
    );
  }

  if (
    summary.edgeProvider.provider !== "Cloudflare" &&
    http.finalUrl?.startsWith("https://")
  ) {
    recommendations.push(
      recommendation({
        productCode: "SMART_ROUTING",
        title: "Enable Smart Routing after Cloudflare proxy adoption",
        rationale:
          "Once traffic is on Cloudflare edge, smart routing and origin path optimization become available for latency and resilience gains.",
        priority: "medium",
        confidence: 67,
        expectedImpact:
          "Improves request path quality for globally distributed users once edge proxying is established.",
        prerequisites: [
          "Adopt Cloudflare proxying for the target hostnames.",
          "Validate origin health and baseline latency first.",
        ],
        exportPayload: {
          product: "argo_smart_routing",
        },
      }),
    );
  }

  if (hasCode(findings, "MISSING_STRICT_TRANSPORT_SECURITY")) {
    recommendations.push(
      recommendation({
        productCode: "ADVANCED_CERTIFICATE_MANAGER",
        title: "Use Advanced Certificate Manager for explicit TLS lifecycle control",
        rationale:
          "The current HTTPS posture suggests room for stronger certificate policy and more deliberate edge-managed TLS behavior.",
        priority: "medium",
        confidence: 64,
        expectedImpact:
          "Improves certificate governance and gives a cleaner story for edge-managed TLS rollout.",
        prerequisites: onboardingPrereq,
        exportPayload: {
          product: "advanced_certificate_manager",
          desiredPolicies: ["edge_cert_control", "tls_lifecycle_visibility"],
        },
      }),
    );
  }

  return recommendations.sort((left, right) => right.confidence - left.confidence);
}
