export interface CanonicalProviderSignals {
  asnAliases: string[];
  nameserverHints: string[];
  headerHints: string[];
  builderHints: string[];
}

export interface CanonicalProviderConfidencePolicy {
  asn: number;
  nameserver: number;
  isp: number;
  organization: number;
  header: number;
  hint: number;
}

export interface CanonicalHostingProviderEntry {
  canonicalName: string;
  liveDashboard: boolean;
  defaultCategory: string;
  aliases: string[];
  scanPatterns: string[];
  signals: CanonicalProviderSignals;
  confidencePolicy: CanonicalProviderConfidencePolicy;
}

export interface CanonicalProviderMatch {
  provider: string | null;
  category: string | null;
  confidence: number;
  evidence: string[];
  methods: string[];
  liveDashboard: boolean;
  type: "cloud" | "shared" | "dedicated" | "unknown";
}

export interface CanonicalProviderDetectionInput {
  nameservers?: string[];
  headerKeys?: string[];
  headerValues?: string[];
  hintValues?: string[];
  organization?: string | null;
  isp?: string | null;
  asnProvider?: string | null;
}

const DEFAULT_CONFIDENCE_POLICY: CanonicalProviderConfidencePolicy = {
  asn: 95,
  nameserver: 92,
  isp: 80,
  organization: 72,
  header: 88,
  hint: 68,
};

const CANONICAL_HOSTING_PROVIDERS: CanonicalHostingProviderEntry[] = [
  {
    canonicalName: "GoDaddy",
    liveDashboard: true,
    defaultCategory: "Shared/cPanel",
    aliases: [
      "hostingtool",
      "go daddy",
      "godaddy managed wordpress",
      "godaddy website builder",
      "hostingtool managed wordpress",
      "hostingtool website builder",
      "hostingtool hosting",
    ],
    scanPatterns: ["hostingtool", "domaincontrol", "secureserver", "godaddy"],
    signals: {
      asnAliases: ["hostingtool", "godaddy"],
      nameserverHints: ["domaincontrol", "secureserver"],
      headerHints: ["x-gateway-cache", "x-siteid"],
      builderHints: ["godaddy website builder", "hostingtool website builder"],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Bluehost",
    liveDashboard: true,
    defaultCategory: "Shared/cPanel",
    aliases: ["bluehost managed wordpress", "hostmonster"],
    scanPatterns: ["bluehost", "hostmonster"],
    signals: {
      asnAliases: ["bluehost"],
      nameserverHints: ["bluehost", "hostmonster"],
      headerHints: ["x-bluehost-cache", "x-bluehost-managed"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "HostGator",
    liveDashboard: true,
    defaultCategory: "Shared/cPanel",
    aliases: [],
    scanPatterns: ["hostgator", "gator"],
    signals: {
      asnAliases: ["hostgator"],
      nameserverHints: ["hostgator"],
      headerHints: [],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Unified Layer (Bluehost/HostGator)",
    liveDashboard: false,
    defaultCategory: "Shared/cPanel",
    aliases: ["unified layer", "bluehost/hostgator", "bluehost hostgator"],
    scanPatterns: [],
    signals: {
      asnAliases: ["unified layer"],
      nameserverHints: [],
      headerHints: [],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "SiteGround",
    liveDashboard: true,
    defaultCategory: "Managed WordPress",
    aliases: ["siteground managed"],
    scanPatterns: ["siteground"],
    signals: {
      asnAliases: ["siteground"],
      nameserverHints: ["siteground"],
      headerHints: ["x-sg-id", "x-sg-cache"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "WP Engine",
    liveDashboard: true,
    defaultCategory: "Managed WordPress",
    aliases: [],
    scanPatterns: ["wpengine", "wpenginepowered", "wp engine"],
    signals: {
      asnAliases: ["wp engine", "wpengine"],
      nameserverHints: ["wpengine", "wpenginepowered"],
      headerHints: ["wpe-backend", "x-powered-by: wp engine"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Kinsta",
    liveDashboard: true,
    defaultCategory: "Managed WordPress",
    aliases: [],
    scanPatterns: ["kinsta"],
    signals: {
      asnAliases: ["kinsta"],
      nameserverHints: ["kinsta"],
      headerHints: ["x-kinsta-cache"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Cloudflare",
    liveDashboard: true,
    defaultCategory: "CDN/DNS",
    aliases: [],
    scanPatterns: ["cloudflare"],
    signals: {
      asnAliases: ["cloudflare"],
      nameserverHints: ["cloudflare"],
      headerHints: ["cf-ray", "cf-cache-status", "cf-request-id"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "AWS",
    liveDashboard: true,
    defaultCategory: "Cloud/VPS",
    aliases: [
      "amazon web services",
      "amazon web services aws",
      "amazon web services (aws)",
      "aws lightsail wordpress",
      "cloudfront",
      "amazon cloudfront",
    ],
    scanPatterns: ["amazonaws", "aws", "amazon", "lightsail", "cloudfront"],
    signals: {
      asnAliases: ["amazon web services", "aws"],
      nameserverHints: ["awsdns"],
      headerHints: ["x-amz", "x-cache", "x-amz-cf-id", "x-amz-cf-pop"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Google Cloud",
    liveDashboard: true,
    defaultCategory: "Cloud/VPS",
    aliases: [
      "google cloud platform",
      "google cloud platform gcp",
      "google cloud platform (gcp)",
      "gcp",
      "google cloud cdn",
    ],
    scanPatterns: ["googledomains", "google cloud", "gcp", "googleusercontent"],
    signals: {
      asnAliases: ["google cloud platform", "google cloud", "gcp"],
      nameserverHints: ["googledomains", "google"],
      headerHints: ["x-goog"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "DigitalOcean",
    liveDashboard: true,
    defaultCategory: "Cloud/VPS",
    aliases: [],
    scanPatterns: ["digitalocean"],
    signals: {
      asnAliases: ["digitalocean"],
      nameserverHints: ["digitalocean"],
      headerHints: [],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Vercel",
    liveDashboard: true,
    defaultCategory: "Cloud/VPS",
    aliases: [],
    scanPatterns: ["vercel", "vercel-dns"],
    signals: {
      asnAliases: ["vercel"],
      nameserverHints: ["vercel-dns"],
      headerHints: ["x-vercel", "server: vercel", "x-vercel-cache", "x-vercel-id"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Netlify",
    liveDashboard: true,
    defaultCategory: "Cloud/VPS",
    aliases: [],
    scanPatterns: ["netlify", "netlifydns", "nsone"],
    signals: {
      asnAliases: ["netlify"],
      nameserverHints: ["nsone", "netlify"],
      headerHints: ["x-nf-request-id", "server: netlify"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Fastly",
    liveDashboard: false,
    defaultCategory: "CDN/DNS",
    aliases: [],
    scanPatterns: ["fastly", "fastly.net", "fastlylb.net"],
    signals: {
      asnAliases: ["fastly"],
      nameserverHints: [],
      headerHints: ["x-served-by", "x-cache-hits", "x-fastly-request-id", "fastly-io-info"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Akamai",
    liveDashboard: false,
    defaultCategory: "CDN/DNS",
    aliases: ["akamai technologies"],
    scanPatterns: ["akamai", "akamaiedge", "akamai.net"],
    signals: {
      asnAliases: ["akamai", "akamai technologies"],
      nameserverHints: [],
      headerHints: ["x-akamai", "akamai-origin-hop", "x-akamai-request-id"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Cloudways",
    liveDashboard: false,
    defaultCategory: "Managed/VPS",
    aliases: [],
    scanPatterns: ["cloudways"],
    signals: {
      asnAliases: ["cloudways"],
      nameserverHints: [],
      headerHints: ["x-breeze"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "Pantheon",
    liveDashboard: false,
    defaultCategory: "Managed WordPress",
    aliases: [],
    scanPatterns: ["pantheon", "pantheonsite"],
    signals: {
      asnAliases: ["pantheon"],
      nameserverHints: ["pantheon"],
      headerHints: ["x-pantheon", "x-styx-req-id"],
      builderHints: [],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
  {
    canonicalName: "WordPress.com",
    liveDashboard: false,
    defaultCategory: "Managed WordPress",
    aliases: ["wordpress.com vip", "wordpress com vip"],
    scanPatterns: ["wordpress.com", "automattic", "wp.com"],
    signals: {
      asnAliases: ["automattic", "wordpress.com"],
      nameserverHints: ["wordpress.com"],
      headerHints: ["x-vip", "x-automattic"],
      builderHints: ["wordpress.com"],
    },
    confidencePolicy: DEFAULT_CONFIDENCE_POLICY,
  },
];

const LIVE_DASHBOARD_PROVIDERS = CANONICAL_HOSTING_PROVIDERS.filter(
  (provider) => provider.liveDashboard,
).map((provider) => provider.canonicalName);

function normalizeProviderLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/hostingtool/g, "godaddy")
    .replace(/\(gcp\)/g, "gcp")
    .replace(/\(aws\)/g, "aws")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const aliasLookup = new Map<string, CanonicalHostingProviderEntry>();

for (const provider of CANONICAL_HOSTING_PROVIDERS) {
  const candidates = new Set<string>([
    provider.canonicalName,
    ...provider.aliases,
    ...provider.scanPatterns,
    ...provider.signals.asnAliases,
    ...provider.signals.builderHints,
  ]);

  for (const candidate of candidates) {
    const key = normalizeProviderLookupValue(candidate);
    if (key) aliasLookup.set(key, provider);
  }
}

function cloneEntry(
  entry: CanonicalHostingProviderEntry,
): CanonicalHostingProviderEntry {
  return {
    ...entry,
    aliases: [...entry.aliases],
    scanPatterns: [...entry.scanPatterns],
    signals: {
      asnAliases: [...entry.signals.asnAliases],
      nameserverHints: [...entry.signals.nameserverHints],
      headerHints: [...entry.signals.headerHints],
      builderHints: [...entry.signals.builderHints],
    },
    confidencePolicy: { ...entry.confidencePolicy },
  };
}

function matchesHint(value: string, candidates: string[]): string[] {
  const normalized = normalizeProviderLookupValue(value);
  if (!normalized) return [];
  return candidates.filter((candidate) => normalized.includes(normalizeProviderLookupValue(candidate)));
}

export function getCanonicalHostingProviderCatalog(): CanonicalHostingProviderEntry[] {
  return CANONICAL_HOSTING_PROVIDERS.map(cloneEntry);
}

export function getLiveDashboardCanonicalProviders(): string[] {
  return [...LIVE_DASHBOARD_PROVIDERS];
}

export function normalizeHostingProviderLabel(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;

  const key = normalizeProviderLookupValue(trimmed);
  if (!key) return null;

  const exact = aliasLookup.get(key);
  if (exact) return exact.canonicalName;

  for (const [aliasKey, provider] of aliasLookup.entries()) {
    if (key.includes(aliasKey) || aliasKey.includes(key)) {
      return provider.canonicalName;
    }
  }

  return trimmed.replace(/hostingtool/gi, "GoDaddy");
}

export function getCanonicalProviderByName(
  providerName: string | null | undefined,
): CanonicalHostingProviderEntry | null {
  const normalized = normalizeHostingProviderLabel(providerName);
  if (!normalized) return null;
  return (
    CANONICAL_HOSTING_PROVIDERS.find(
      (entry) => entry.canonicalName === normalized,
    ) ?? null
  );
}

export function normalizeHostingProviderCategory(
  value: string | null | undefined,
  providerName?: string | null,
): string {
  const provider = getCanonicalProviderByName(providerName);
  if (provider) return provider.defaultCategory;

  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized.includes("cdn")) return "CDN/DNS";
  if (normalized.includes("cloud")) return "Cloud/VPS";
  if (normalized.includes("shared")) return "Shared/cPanel";
  if (normalized.includes("managed")) return "Managed WordPress";
  if (normalized.includes("website builder")) return "Website Builder";
  return value || "Unknown";
}

export function inferCanonicalProviderType(
  providerName: string | null | undefined,
  explicitCategory?: string | null,
): "cloud" | "shared" | "dedicated" | "unknown" {
  const category = normalizeHostingProviderCategory(explicitCategory, providerName);
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory.includes("cloud") || normalizedCategory.includes("cdn")) {
    return "cloud";
  }
  if (normalizedCategory.includes("shared")) {
    return "shared";
  }
  if (normalizedCategory.includes("managed") || normalizedCategory.includes("dedicated")) {
    return "dedicated";
  }

  const normalizedProvider = normalizeProviderLookupValue(providerName || "");
  if (!normalizedProvider) return "unknown";
  if (
    normalizedProvider.includes("aws") ||
    normalizedProvider.includes("google cloud") ||
    normalizedProvider.includes("azure") ||
    normalizedProvider.includes("digitalocean") ||
    normalizedProvider.includes("cloudflare") ||
    normalizedProvider.includes("vercel") ||
    normalizedProvider.includes("netlify") ||
    normalizedProvider.includes("fastly") ||
    normalizedProvider.includes("akamai")
  ) {
    return "cloud";
  }
  if (
    normalizedProvider.includes("godaddy") ||
    normalizedProvider.includes("bluehost") ||
    normalizedProvider.includes("hostgator") ||
    normalizedProvider.includes("hostinger")
  ) {
    return "shared";
  }
  return "unknown";
}

export function detectCanonicalProvider(
  input: CanonicalProviderDetectionInput,
): CanonicalProviderMatch {
  const nameservers = input.nameservers ?? [];
  const headerKeys = (input.headerKeys ?? []).map((value) => value.toLowerCase());
  const headerValues = (input.headerValues ?? []).map((value) => value.toLowerCase());
  const hintValues = (input.hintValues ?? []).map((value) => value.toLowerCase());
  const normalizedIsp = normalizeProviderLookupValue(input.isp || "");
  const normalizedOrganization = normalizeProviderLookupValue(input.organization || "");
  const asnProvider = normalizeHostingProviderLabel(input.asnProvider) || input.asnProvider || null;

  let best: CanonicalProviderMatch = {
    provider: null,
    category: null,
    confidence: 0,
    evidence: [],
    methods: [],
    liveDashboard: false,
    type: "unknown",
  };

  for (const entry of CANONICAL_HOSTING_PROVIDERS) {
    const evidence: string[] = [];
    const methods: string[] = [];
    let confidence = 0;

    if (asnProvider && normalizeHostingProviderLabel(asnProvider) === entry.canonicalName) {
      confidence = Math.max(confidence, entry.confidencePolicy.asn);
      methods.push("asn");
      evidence.push(`asn:${entry.canonicalName}`);
    }

    const matchedNameservers = nameservers.filter((value) =>
      matchesHint(value, entry.signals.nameserverHints).length > 0,
    );
    if (matchedNameservers.length > 0) {
      confidence = Math.max(
        confidence,
        entry.confidencePolicy.nameserver + Math.min(3, matchedNameservers.length) * 2,
      );
      methods.push("nameserver");
      evidence.push(...matchedNameservers.slice(0, 3).map((value) => `ns:${value}`));
    }

    const matchedHeaders = entry.signals.headerHints.filter((hint) =>
      headerKeys.includes(hint.toLowerCase()) ||
      headerValues.some((value) => value.includes(hint.toLowerCase())),
    );
    if (matchedHeaders.length > 0) {
      confidence = Math.max(
        confidence,
        entry.confidencePolicy.header + Math.min(2, matchedHeaders.length) * 3,
      );
      methods.push("header");
      evidence.push(...matchedHeaders.slice(0, 3).map((value) => `header:${value}`));
    }

    const matchedHints = hintValues.filter(
      (value) =>
        matchesHint(value, [...entry.scanPatterns, ...entry.aliases, ...entry.signals.builderHints]).length > 0,
    );
    if (matchedHints.length > 0) {
      confidence = Math.max(
        confidence,
        entry.confidencePolicy.hint + Math.min(2, matchedHints.length) * 2,
      );
      methods.push("hint");
      evidence.push(...matchedHints.slice(0, 2).map((value) => `hint:${value}`));
    }

    if (normalizedOrganization) {
      const organizationMatches = matchesHint(
        normalizedOrganization,
        [...entry.aliases, ...entry.signals.asnAliases, ...entry.scanPatterns],
      );
      if (organizationMatches.length > 0) {
        confidence = Math.max(confidence, entry.confidencePolicy.organization);
        methods.push("organization");
        evidence.push(`organization:${organizationMatches[0]}`);
      }
    }

    if (normalizedIsp) {
      const ispMatches = matchesHint(
        normalizedIsp,
        [...entry.aliases, ...entry.signals.asnAliases, ...entry.scanPatterns],
      );
      if (ispMatches.length > 0) {
        confidence = Math.max(confidence, entry.confidencePolicy.isp);
        methods.push("isp");
        evidence.push(`isp:${ispMatches[0]}`);
      }
    }

    if (confidence > best.confidence) {
      best = {
        provider: entry.canonicalName,
        category: entry.defaultCategory,
        confidence: Math.min(98, confidence),
        evidence: evidence.slice(0, 4),
        methods: Array.from(new Set(methods)),
        liveDashboard: entry.liveDashboard,
        type: inferCanonicalProviderType(entry.canonicalName, entry.defaultCategory),
      };
    }
  }

  return best;
}
