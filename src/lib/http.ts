import type { HttpProbe, RedirectHop } from "../types";

const USER_AGENT =
  "EdgeIntel/0.1 (+https://hostinginfo.gg; Cloudflare Worker posture analysis)";

function pickHeaders(headers: Headers): Record<string, string> {
  const selected = [
    "server",
    "cache-control",
    "cf-ray",
    "cf-cache-status",
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "x-powered-by",
    "via",
    "alt-svc",
  ];
  const result: Record<string, string> = {};
  for (const name of selected) {
    const value = headers.get(name);
    if (value) result[name] = value;
  }
  return result;
}

function extractTitle(html: string | null): string | null {
  if (!html) return null;
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function extractHintMatches(html: string | null, pattern: RegExp): string[] {
  if (!html) return [];
  const found = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const value = match[0]?.trim();
    if (value) found.add(value);
  }
  return Array.from(found).slice(0, 10);
}

function normalizeRedirectLocation(sourceUrl: string, location: string | null): string | null {
  if (!location) return null;
  try {
    return new URL(location, sourceUrl).toString();
  } catch {
    return location;
  }
}

async function fetchPreview(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return null;
  const text = await response.text();
  return text.slice(0, 16_000);
}

async function follow(startUrl: string): Promise<HttpProbe> {
  const redirectChain: RedirectHop[] = [];
  let currentUrl = startUrl;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
      },
    });

    const location = normalizeRedirectLocation(
      currentUrl,
      response.headers.get("location"),
    );

    redirectChain.push({
      url: currentUrl,
      status: response.status,
      location,
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      location &&
      attempt < 5
    ) {
      currentUrl = location;
      continue;
    }

    const htmlPreview = await fetchPreview(response.clone()).catch(() => null);
    const headers = pickHeaders(response.headers);
    return {
      attemptedUrl: startUrl,
      finalUrl: currentUrl,
      status: response.status,
      ok: response.ok,
      redirectChain,
      headers,
      htmlPreview,
      pageTitle: extractTitle(htmlPreview),
      apiHints: extractHintMatches(htmlPreview, /\/api\/[a-z0-9/_-]*/gi),
      authHints: extractHintMatches(
        htmlPreview,
        /(login|signin|sign-in|auth|password-reset|reset-password)/gi,
      ),
      staticAssetHints: extractHintMatches(
        htmlPreview,
        /(\/assets\/[^\s"'<>]+|\/static\/[^\s"'<>]+|\.css|\.js)/gi,
      ),
    };
  }

  return {
    attemptedUrl: startUrl,
    finalUrl: null,
    status: null,
    ok: false,
    redirectChain,
    headers: {},
    htmlPreview: null,
    pageTitle: null,
    apiHints: [],
    authHints: [],
    staticAssetHints: [],
    error: "Redirect chain exceeded maximum depth.",
  };
}

export async function probeDomainSurface(domain: string): Promise<HttpProbe> {
  try {
    const httpsProbe = await follow(`https://${domain}`);
    if (httpsProbe.ok || httpsProbe.status !== null) return httpsProbe;
  } catch {
    // Fall back to HTTP when HTTPS fails.
  }

  try {
    return await follow(`http://${domain}`);
  } catch (error) {
    return {
      attemptedUrl: `https://${domain}`,
      finalUrl: null,
      status: null,
      ok: false,
      redirectChain: [],
      headers: {},
      htmlPreview: null,
      pageTitle: null,
      apiHints: [],
      authHints: [],
      staticAssetHints: [],
      error: error instanceof Error ? error.message : "HTTP probe failed",
    };
  }
}
