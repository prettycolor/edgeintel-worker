import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";
import type { Env } from "../env";

const MCP_CSRF_COOKIE = "__Host-edgeintel-mcp-csrf";
const MCP_STATE_PREFIX = "edgeintel:mcp:state:";
const OAUTH_STATE_TTL_SECONDS = 600;

export interface McpAccessConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  authorizationUrl: string;
  jwksUrl: string;
}

interface StoredOAuthState {
  oauthReqInfo: AuthRequest;
  codeVerifier: string;
}

export interface EdgeIntelMcpIdentity {
  email: string | null;
  name: string | null;
  sub: string;
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getMcpAccessConfig(env: Env): McpAccessConfig {
  const clientId = trimOrNull(env.MCP_ACCESS_CLIENT_ID);
  const clientSecret = trimOrNull(env.MCP_ACCESS_CLIENT_SECRET);
  const tokenUrl = trimOrNull(env.MCP_ACCESS_TOKEN_URL);
  const authorizationUrl = trimOrNull(env.MCP_ACCESS_AUTHORIZATION_URL);
  const jwksUrl = trimOrNull(env.MCP_ACCESS_JWKS_URL);

  const missing = [
    !clientId ? "MCP_ACCESS_CLIENT_ID" : null,
    !clientSecret ? "MCP_ACCESS_CLIENT_SECRET" : null,
    !tokenUrl ? "MCP_ACCESS_TOKEN_URL" : null,
    !authorizationUrl ? "MCP_ACCESS_AUTHORIZATION_URL" : null,
    !jwksUrl ? "MCP_ACCESS_JWKS_URL" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw new Error(
      `Missing MCP Access OAuth configuration: ${missing.join(", ")}.`,
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    tokenUrl: tokenUrl!,
    authorizationUrl: authorizationUrl!,
    jwksUrl: jwksUrl!,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

function buildRedirectUri(request: Request): string {
  return new URL("/callback", request.url).toString();
}

export function buildAccessAuthorizationUrl(
  request: Request,
  config: McpAccessConfig,
  stateToken: string,
  codeChallenge: string,
): string {
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", buildRedirectUri(request));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", stateToken);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function issueCsrfCookie(): { token: string; setCookie: string } {
  const token = crypto.randomUUID();
  return {
    token,
    setCookie: `${MCP_CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  };
}

export function validateCsrfCookie(request: Request, formData: FormData): string {
  const tokenFromForm = formData.get("csrf_token");
  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new Error("Missing CSRF token.");
  }

  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${MCP_CSRF_COOKIE}=`));

  const tokenFromCookie = cookie ? cookie.slice(MCP_CSRF_COOKIE.length + 1) : null;
  if (!tokenFromCookie || tokenFromCookie !== tokenFromForm) {
    throw new Error("CSRF token validation failed.");
  }

  return `${MCP_CSRF_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
): Promise<{ stateToken: string; codeChallenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = toBase64Url(verifierBytes);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const stateToken = crypto.randomUUID();

  const payload: StoredOAuthState = {
    oauthReqInfo,
    codeVerifier,
  };

  await kv.put(`${MCP_STATE_PREFIX}${stateToken}`, JSON.stringify(payload), {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
  });

  return {
    stateToken,
    codeChallenge,
  };
}

export async function consumeOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<StoredOAuthState> {
  const url = new URL(request.url);
  const stateToken = trimOrNull(url.searchParams.get("state"));
  if (!stateToken) {
    throw new Error("Missing OAuth state token.");
  }

  const storageKey = `${MCP_STATE_PREFIX}${stateToken}`;
  const raw = await kv.get(storageKey);
  await kv.delete(storageKey);

  if (!raw) {
    throw new Error("OAuth state token is invalid or expired.");
  }

  const parsed = JSON.parse(raw) as StoredOAuthState;
  if (!parsed.oauthReqInfo || !parsed.codeVerifier) {
    throw new Error("OAuth state payload is malformed.");
  }

  return parsed;
}

export async function exchangeAccessAuthorizationCode(
  request: Request,
  config: McpAccessConfig,
  codeVerifier: string,
): Promise<{ accessToken: string; idToken: string }> {
  const code = trimOrNull(new URL(request.url).searchParams.get("code"));
  if (!code) {
    throw new Error("Missing authorization code from Access callback.");
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: buildRedirectUri(request),
      code_verifier: codeVerifier,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        id_token?: string;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token || !payload.id_token) {
    const description =
      payload?.error_description ??
      payload?.error ??
      `Access token exchange failed with status ${response.status}.`;
    throw new Error(description);
  }

  return {
    accessToken: payload.access_token,
    idToken: payload.id_token,
  };
}

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  const cached = JWKS_CACHE.get(url);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(url));
  JWKS_CACHE.set(url, jwks);
  return jwks;
}

export async function verifyAccessIdToken(
  config: McpAccessConfig,
  idToken: string,
): Promise<EdgeIntelMcpIdentity> {
  const { payload } = await jwtVerify(idToken, getJwks(config.jwksUrl), {
    audience: config.clientId,
  });

  const subject = trimOrNull(typeof payload.sub === "string" ? payload.sub : null);
  if (!subject) {
    throw new Error("Access ID token did not include a subject.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < nowSeconds) {
    throw new Error("Access ID token has expired.");
  }

  return {
    email: trimOrNull(typeof payload.email === "string" ? payload.email : null),
    name: trimOrNull(typeof payload.name === "string" ? payload.name : null),
    sub: subject,
  };
}

export function encodeAuthorizeState(oauthReqInfo: AuthRequest): string {
  return btoa(JSON.stringify({ oauthReqInfo }));
}

export function decodeAuthorizeState(value: FormDataEntryValue | null): AuthRequest {
  if (!value || typeof value !== "string") {
    throw new Error("Missing authorization state.");
  }

  const parsed = JSON.parse(atob(value)) as { oauthReqInfo?: AuthRequest };
  if (!parsed.oauthReqInfo) {
    throw new Error("Authorization state is invalid.");
  }

  return parsed.oauthReqInfo;
}

export function renderAuthorizePage(input: {
  request: Request;
  oauthReqInfo: AuthRequest;
  client: ClientInfo | null;
  csrfToken: string;
  grantedScopes: string[];
}): Response {
  const clientName =
    input.client?.clientName ??
    input.client?.clientUri ??
    input.oauthReqInfo.clientId ??
    "Unknown MCP client";
  const clientDescription = input.client?.clientUri
    ? `Client ID: ${input.oauthReqInfo.clientId}`
    : "This MCP client wants to connect to EdgeIntel.";
  const encodedState = encodeAuthorizeState(input.oauthReqInfo);
  const scopeMarkup = input.grantedScopes
    .map(
      (scope) =>
        `<li><code>${escapeHtml(scope)}</code></li>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize EdgeIntel MCP</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3f4f6;
        --surface: #ffffff;
        --border: #d1d5db;
        --ink: #111827;
        --muted: #6b7280;
        --accent: #f97316;
        --accent-ink: #ffffff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "SF Pro Display", "Inter", system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(249, 115, 22, 0.18), transparent 28%),
          linear-gradient(180deg, #fafaf9 0%, var(--bg) 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(680px, 100%);
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(209, 213, 219, 0.75);
        border-radius: 28px;
        box-shadow: 0 22px 70px rgba(17, 24, 39, 0.12);
        padding: 28px;
        backdrop-filter: blur(18px);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(249, 115, 22, 0.12);
        color: #9a3412;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: clamp(30px, 4vw, 42px);
        line-height: 1.02;
      }
      p {
        margin: 0 0 16px;
        color: var(--muted);
        line-height: 1.6;
      }
      .panel {
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 18px;
        background: rgba(249, 250, 251, 0.8);
        margin-top: 18px;
      }
      ul {
        margin: 12px 0 0;
        padding-left: 18px;
      }
      li { margin-top: 8px; }
      code {
        font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.92em;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 14px;
        padding: 13px 18px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .primary {
        background: var(--accent);
        color: var(--accent-ink);
      }
      .secondary {
        background: transparent;
        color: var(--ink);
        border: 1px solid var(--border);
      }
    </style>
  </head>
  <body>
    <form class="card" method="post" action="/authorize">
      <div class="eyebrow">EdgeIntel MCP</div>
      <h1>Approve MCP access</h1>
      <p>${escapeHtml(clientName)} wants to connect to EdgeIntel and use your approved MCP tools.</p>
      <div class="panel">
        <strong>Client</strong>
        <p>${escapeHtml(clientDescription)}</p>
        <strong>Scopes</strong>
        <ul>${scopeMarkup}</ul>
      </div>
      <div class="panel">
        <strong>Server</strong>
        <p>EdgeIntel will authenticate you with Cloudflare Access, then issue an MCP token limited to the scopes shown above.</p>
      </div>
      <input type="hidden" name="csrf_token" value="${escapeHtml(input.csrfToken)}" />
      <input type="hidden" name="state" value="${escapeHtml(encodedState)}" />
      <div class="actions">
        <button class="primary" type="submit" name="action" value="approve">Continue to Access</button>
        <button class="secondary" type="submit" name="action" value="deny">Deny</button>
      </div>
    </form>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
