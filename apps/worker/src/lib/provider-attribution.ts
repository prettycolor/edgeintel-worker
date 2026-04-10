import type { DnsProfile, HttpProbe, ProviderSignal, ScanSummary } from "../types";

interface ProviderPattern {
  provider: string;
  matchers: RegExp[];
}

const DNS_PATTERNS: ProviderPattern[] = [
  {
    provider: "Cloudflare",
    matchers: [/\.ns\.cloudflare\.com$/i],
  },
  {
    provider: "AWS Route 53",
    matchers: [/\.awsdns-\d+\./i],
  },
  {
    provider: "Azure DNS",
    matchers: [/\.azure-dns\./i],
  },
  {
    provider: "Vercel DNS",
    matchers: [/\.vercel-dns\.com$/i],
  },
  {
    provider: "DigitalOcean DNS",
    matchers: [/\.digitalocean\.com$/i],
  },
];

const EDGE_PATTERNS: Array<{
  provider: string;
  headerKeys: string[];
  serverMatchers: RegExp[];
}> = [
  {
    provider: "Cloudflare",
    headerKeys: ["cf-ray", "cf-cache-status"],
    serverMatchers: [/cloudflare/i],
  },
  {
    provider: "Fastly",
    headerKeys: ["x-served-by", "x-cache-hits"],
    serverMatchers: [/fastly/i],
  },
  {
    provider: "Akamai",
    headerKeys: ["x-akamai", "akamai-origin-hop"],
    serverMatchers: [/akamai/i],
  },
  {
    provider: "Vercel",
    headerKeys: ["x-vercel-cache", "x-vercel-id"],
    serverMatchers: [/vercel/i],
  },
];

function detectProvider(
  values: string[],
  patterns: ProviderPattern[],
): ProviderSignal {
  for (const pattern of patterns) {
    const matched = values.filter((value) =>
      pattern.matchers.some((matcher) => matcher.test(value)),
    );
    if (matched.length > 0) {
      return {
        provider: pattern.provider,
        confidence: Math.min(95, 60 + matched.length * 12),
        evidence: matched.slice(0, 4),
      };
    }
  }
  return {
    provider: null,
    confidence: 0,
    evidence: [],
  };
}

export function buildScanSummary(domain: string, dns: DnsProfile, http: HttpProbe): ScanSummary {
  const nameservers = dns.nameservers.map((record) => record.data);
  const dnsProvider = detectProvider(nameservers, DNS_PATTERNS);

  const serverHeader = http.headers.server ? [http.headers.server] : [];
  const edgeSignals = EDGE_PATTERNS
    .map((pattern) => {
      const headerMatches = pattern.headerKeys.filter((key) => Boolean(http.headers[key]));
      const serverMatches = serverHeader.filter((value) =>
        pattern.serverMatchers.some((matcher) => matcher.test(value)),
      );
      if (headerMatches.length === 0 && serverMatches.length === 0) return null;
      return {
        provider: pattern.provider,
        confidence: Math.min(
          96,
          62 + headerMatches.length * 14 + serverMatches.length * 10,
        ),
        evidence: [...headerMatches, ...serverMatches],
      };
    })
    .filter(Boolean) as ProviderSignal[];

  const edgeProvider =
    edgeSignals.sort((left, right) => right.confidence - left.confidence)[0] ?? {
      provider: null,
      confidence: 0,
      evidence: [],
    };

  const wafProvider =
    http.headers["cf-ray"] || http.headers["cf-cache-status"]
      ? {
          provider: "Cloudflare",
          confidence: 88,
          evidence: ["cf-ray/cf-cache-status headers observed"],
        }
      : {
          provider: null,
          confidence: 0,
          evidence: [],
        };

  const missingSecurityHeaders = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
  ].filter((name) => !http.headers[name]);

  return {
    domain,
    dnsProvider,
    edgeProvider,
    wafProvider,
    originHints: [
      http.headers.server,
      http.headers["x-powered-by"],
      ...dns.cname.map((record) => record.data),
    ].filter(Boolean) as string[],
    apiSurfaceDetected: http.apiHints.length > 0,
    authSurfaceDetected: http.authHints.length > 0,
    cacheSignals: [http.headers["cache-control"], http.headers["cf-cache-status"]].filter(
      Boolean,
    ) as string[],
    missingSecurityHeaders,
    finalUrl: http.finalUrl,
  };
}
