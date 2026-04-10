import {
  detectCanonicalProvider,
  normalizeHostingProviderLabel,
} from "@edgeintel/intelligence-rules";
import type { DnsProfile, HttpProbe, ProviderSignal, ScanSummary } from "../types";

function emptySignal(): ProviderSignal {
  return {
    provider: null,
    confidence: 0,
    evidence: [],
  };
}

function signalFromDetection(
  detection: ReturnType<typeof detectCanonicalProvider>,
): ProviderSignal {
  if (!detection.provider) {
    return emptySignal();
  }

  return {
    provider: detection.provider,
    confidence: detection.confidence,
    evidence: detection.evidence,
    category: detection.category,
    methods: detection.methods,
    providerType: detection.type,
    liveDashboard: detection.liveDashboard,
  };
}

function normalizeOriginHints(dns: DnsProfile, http: HttpProbe): string[] {
  return [
    http.headers.server,
    http.headers["x-powered-by"],
    http.headers.via,
    ...dns.cname.map((record) => record.data),
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function isRegistrarStyleNameserverOnly(signal: ProviderSignal): boolean {
  const provider = normalizeHostingProviderLabel(signal.provider);
  const category = signal.category?.toLowerCase() || "";
  const methods = signal.methods || [];

  if (!provider || methods.length !== 1 || methods[0] !== "nameserver") {
    return false;
  }

  return (
    category.includes("shared") ||
    provider === "GoDaddy" ||
    provider === "Bluehost" ||
    provider === "HostGator" ||
    provider === "Namecheap"
  );
}

function detectDnsProvider(dns: DnsProfile): ProviderSignal {
  return signalFromDetection(
    detectCanonicalProvider({
      nameservers: dns.nameservers.map((record) => record.data),
    }),
  );
}

function detectEdgeProvider(dns: DnsProfile, http: HttpProbe): ProviderSignal {
  const detection = signalFromDetection(
    detectCanonicalProvider({
      nameservers: dns.nameservers.map((record) => record.data),
      headerKeys: Object.keys(http.headers),
      headerValues: Object.entries(http.headers).map(
        ([key, value]) => `${key}: ${value}`,
      ),
      hintValues: [...dns.cname.map((record) => record.data), http.headers.server].filter(
        (value): value is string => Boolean(value),
      ),
    }),
  );

  if (!detection.provider) {
    return emptySignal();
  }

  if (detection.methods?.every((method) => method === "nameserver")) {
    return emptySignal();
  }

  return detection;
}

function detectWafProvider(edgeProvider: ProviderSignal, http: HttpProbe): ProviderSignal {
  const headerKeys = Object.keys(http.headers);
  if (
    headerKeys.includes("cf-ray") ||
    headerKeys.includes("cf-cache-status") ||
    edgeProvider.provider === "Cloudflare"
  ) {
    return {
      provider: "Cloudflare",
      confidence: Math.max(edgeProvider.confidence, 88),
      evidence: ["Cloudflare edge and cache headers were observed."],
      category: "CDN/DNS",
      methods: ["header"],
      providerType: "cloud",
      liveDashboard: true,
    };
  }

  if (headerKeys.includes("x-akamai") || headerKeys.includes("akamai-origin-hop")) {
    return {
      provider: "Akamai",
      confidence: 84,
      evidence: ["Akamai request headers were observed."],
      category: "CDN/DNS",
      methods: ["header"],
      providerType: "cloud",
      liveDashboard: false,
    };
  }

  if (headerKeys.includes("x-served-by") || headerKeys.includes("x-fastly-request-id")) {
    return {
      provider: "Fastly",
      confidence: 82,
      evidence: ["Fastly edge headers were observed."],
      category: "CDN/DNS",
      methods: ["header"],
      providerType: "cloud",
      liveDashboard: false,
    };
  }

  return emptySignal();
}

function detectOriginProvider(dns: DnsProfile, http: HttpProbe): ProviderSignal {
  const originHints = normalizeOriginHints(dns, http);
  const detection = signalFromDetection(
    detectCanonicalProvider({
      headerValues: originHints.map((value) => `hint: ${value}`),
      hintValues: originHints,
    }),
  );

  if (!detection.provider || detection.confidence < 62) {
    return emptySignal();
  }

  if (isRegistrarStyleNameserverOnly(detection)) {
    return emptySignal();
  }

  return detection;
}

export function buildScanSummary(domain: string, dns: DnsProfile, http: HttpProbe): ScanSummary {
  const dnsProvider = detectDnsProvider(dns);
  const edgeProvider = detectEdgeProvider(dns, http);
  const wafProvider = detectWafProvider(edgeProvider, http);
  const originProvider = detectOriginProvider(dns, http);

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
    originProvider,
    originHints: normalizeOriginHints(dns, http),
    apiSurfaceDetected: http.apiHints.length > 0,
    authSurfaceDetected: http.authHints.length > 0,
    cacheSignals: [http.headers["cache-control"], http.headers["cf-cache-status"]].filter(
      Boolean,
    ) as string[],
    missingSecurityHeaders,
    finalUrl: http.finalUrl,
  };
}
