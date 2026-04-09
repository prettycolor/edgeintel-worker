import type { HttpProbe, RedirectHop } from "../types";
import { withRetry } from "./utils";

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

interface FollowOutcome {
  attemptedUrl: string;
  finalUrl: string | null;
  status: number | null;
  ok: boolean;
  redirectChain: RedirectHop[];
  headers: Record<string, string>;
  htmlPreview: string | null;
  pageTitle: string | null;
  apiHints: string[];
  authHints: string[];
  staticAssetHints: string[];
  contentType: string | null;
  contentLength: number | null;
}

async function follow(startUrl: string): Promise<FollowOutcome> {
  const redirectChain: RedirectHop[] = [];
  let currentUrl = startUrl;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { value: response } = await withRetry(
      () =>
        fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          headers: {
            "user-agent": USER_AGENT,
          },
        }),
      {
        attempts: 2,
        delayMs: 200,
      },
    );

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
      contentType: response.headers.get("content-type"),
      contentLength: Number(response.headers.get("content-length")) || null,
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
    contentType: null,
    contentLength: null,
  };
}

export async function probeDomainSurface(domain: string): Promise<HttpProbe> {
  const attempts: HttpProbe["attempts"] = [];
  const errors: string[] = [];

  try {
    const httpsStartedAt = Date.now();
    const httpsProbe = await follow(`https://${domain}`);
    attempts.push({
      url: `https://${domain}`,
      scheme: "https",
      durationMs: Date.now() - httpsStartedAt,
      status: httpsProbe.status,
      ok: httpsProbe.ok,
      finalUrl: httpsProbe.finalUrl,
    });
    if (httpsProbe.ok || httpsProbe.status !== null) {
      return {
        ...httpsProbe,
        protocolUsed: "https",
        attempts,
        surfaceClassification: {
          isHtml: Boolean(httpsProbe.contentType?.includes("text/html")),
          isDenied: httpsProbe.status === 401 || httpsProbe.status === 403 || httpsProbe.status === 429,
          redirectCount: httpsProbe.redirectChain.length,
          hasApiHints: httpsProbe.apiHints.length > 0,
          hasAuthHints: httpsProbe.authHints.length > 0,
        },
        errors,
      };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "HTTPS probe failed";
    attempts.push({
      url: `https://${domain}`,
      scheme: "https",
      durationMs: 0,
      status: null,
      ok: false,
      finalUrl: null,
      error: message,
    });
    errors.push(message);
  }

  try {
    const httpStartedAt = Date.now();
    const httpProbe = await follow(`http://${domain}`);
    attempts.push({
      url: `http://${domain}`,
      scheme: "http",
      durationMs: Date.now() - httpStartedAt,
      status: httpProbe.status,
      ok: httpProbe.ok,
      finalUrl: httpProbe.finalUrl,
    });
    return {
      ...httpProbe,
      protocolUsed: "http",
      attempts,
      surfaceClassification: {
        isHtml: Boolean(httpProbe.contentType?.includes("text/html")),
        isDenied: httpProbe.status === 401 || httpProbe.status === 403 || httpProbe.status === 429,
        redirectCount: httpProbe.redirectChain.length,
        hasApiHints: httpProbe.apiHints.length > 0,
        hasAuthHints: httpProbe.authHints.length > 0,
      },
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "HTTP probe failed";
    errors.push(message);
    return {
      attemptedUrl: `https://${domain}`,
      finalUrl: null,
      status: null,
      ok: false,
      protocolUsed: "unknown",
      redirectChain: [],
      headers: {},
      htmlPreview: null,
      pageTitle: null,
      apiHints: [],
      authHints: [],
      staticAssetHints: [],
      contentType: null,
      contentLength: null,
      attempts,
      surfaceClassification: {
        isHtml: false,
        isDenied: false,
        redirectCount: 0,
        hasApiHints: false,
        hasAuthHints: false,
      },
      errors,
      error: message,
    };
  }
}
