import type { Finding, ScanSummary, DnsProfile, HttpProbe } from "../types";

function finding(
  partial: Omit<Finding, "id">,
): Finding {
  return {
    id: crypto.randomUUID(),
    ...partial,
  };
}

export function deriveFindings(
  domain: string,
  dns: DnsProfile,
  http: HttpProbe,
  summary: ScanSummary,
): Finding[] {
  const findings: Finding[] = [];

  if (dns.nameservers.length === 0) {
    findings.push(
      finding({
        category: "dns",
        severity: "high",
        code: "DNS_NS_EMPTY",
        title: "No authoritative nameserver records were observed",
        detail:
          "The scan could not confirm authoritative nameserver responses through DoH, which weakens downstream provider attribution.",
        evidence: { domain },
      }),
    );
  }

  if (!http.ok) {
    findings.push(
      finding({
        category: "http",
        severity: "critical",
        code: "PUBLIC_WEB_UNREACHABLE",
        title: "The domain is not reliably reachable over HTTP(S)",
        detail:
          http.error ??
          "The public web surface did not complete a successful HTTP or HTTPS response during the scan window.",
        evidence: {
          attemptedUrl: http.attemptedUrl,
          redirects: http.redirectChain,
          status: http.status,
        },
      }),
    );
    return findings;
  }

  if (summary.dnsProvider.provider !== "Cloudflare") {
    findings.push(
      finding({
        category: "edge",
        severity: "medium",
        code: "DNS_NOT_ON_CLOUDFLARE",
        title: "DNS is not currently delegated to Cloudflare",
        detail:
          "The observed nameservers do not indicate Cloudflare authoritative DNS, which creates a clear migration and policy opportunity.",
        evidence: {
          nameservers: dns.nameservers.map((record) => record.data),
          detectedDnsProvider: summary.dnsProvider,
        },
      }),
    );
  }

  if (summary.edgeProvider.provider !== "Cloudflare") {
    findings.push(
      finding({
        category: "edge",
        severity: "medium",
        code: "EDGE_NOT_ON_CLOUDFLARE",
        title: "Traffic does not appear to terminate on Cloudflare edge services",
        detail:
          "The response headers do not provide strong evidence of Cloudflare proxying or caching, which reduces access to Cloudflare’s edge security and optimization controls.",
        evidence: {
          detectedEdgeProvider: summary.edgeProvider,
          headers: http.headers,
        },
      }),
    );
  }

  for (const header of summary.missingSecurityHeaders) {
    findings.push(
      finding({
        category: "security",
        severity: header === "strict-transport-security" ? "high" : "medium",
        code: `MISSING_${header.toUpperCase().replace(/-/g, "_")}`,
        title: `Missing ${header} header`,
        detail:
          `The public response does not include ${header}, leaving security posture and policy enforcement weaker than expected for a production site.`,
        evidence: {
          finalUrl: http.finalUrl,
          observedHeaders: http.headers,
        },
      }),
    );
  }

  if (!http.headers["cache-control"] && !http.headers["cf-cache-status"]) {
    findings.push(
      finding({
        category: "performance",
        severity: "medium",
        code: "CACHE_POLICY_WEAK",
        title: "No strong cache policy was observed on the primary response",
        detail:
          "The response does not expose cache policy hints that suggest deliberate edge caching. That usually means avoidable origin load and weaker performance controls.",
        evidence: {
          headers: http.headers,
          staticAssetHints: http.staticAssetHints,
        },
      }),
    );
  }

  if (summary.apiSurfaceDetected) {
    findings.push(
      finding({
        category: "surface",
        severity: "info",
        code: "API_SURFACE_DETECTED",
        title: "Public API surface indicators were detected",
        detail:
          "The rendered page or response body exposes likely API routes, which increases the value of API-aware security and schema controls.",
        evidence: {
          apiHints: http.apiHints,
        },
      }),
    );
  }

  if (summary.authSurfaceDetected) {
    findings.push(
      finding({
        category: "surface",
        severity: "medium",
        code: "AUTH_SURFACE_DETECTED",
        title: "Authentication-related surface was detected",
        detail:
          "The rendered page suggests login or authentication flows, which raises the importance of bot mitigation and interactive challenge controls.",
        evidence: {
          authHints: http.authHints,
        },
      }),
    );
  }

  if (http.redirectChain.length > 2) {
    findings.push(
      finding({
        category: "http",
        severity: "low",
        code: "REDIRECT_CHAIN_COMPLEX",
        title: "The primary request path uses a multi-hop redirect chain",
        detail:
          "Multi-step redirect behavior often indicates avoidable edge/origin complexity and creates opportunities for policy consolidation.",
        evidence: {
          redirectChain: http.redirectChain,
        },
      }),
    );
  }

  return findings;
}
