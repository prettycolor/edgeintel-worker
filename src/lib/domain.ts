const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) return false;
  const parts = hostname.split(".").map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

function isInvalidHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (!normalized || LOCAL_HOSTS.has(normalized)) return true;
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) {
    return true;
  }
  return isPrivateIpv4(normalized);
}

export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  const url = trimmed.includes("://")
    ? new URL(trimmed)
    : new URL(`https://${trimmed}`);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isInvalidHost(hostname)) {
    throw new Error(
      "Only public, internet-visible domains are allowed for EdgeIntel scans.",
    );
  }
  return hostname;
}

export function normalizeRequestedDomains(
  domain: string | undefined,
  domains: string[] | undefined,
  maxBatchSize: number,
): string[] {
  const candidates = [
    ...(typeof domain === "string" ? [domain] : []),
    ...((domains ?? []).filter((value) => typeof value === "string") as string[]),
  ];

  const normalized = Array.from(new Set(candidates.map(normalizeDomain)));
  if (normalized.length === 0) {
    throw new Error("At least one public domain is required.");
  }
  if (normalized.length > maxBatchSize) {
    throw new Error(`Batch limit exceeded. Max supported domains: ${maxBatchSize}.`);
  }
  return normalized;
}

export function buildCanonicalUrl(domain: string): string {
  return `https://${domain}`;
}
