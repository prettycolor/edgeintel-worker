import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../env";
import type { OperatorSession } from "../types";
import { jsonResponse } from "./utils";

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTeamDomain(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function toIsoTimestamp(value: number | null | undefined): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function parseAudience(payload: JWTPayload): string[] {
  if (Array.isArray(payload.aud)) {
    return payload.aud.filter((entry): entry is string => typeof entry === "string");
  }

  return typeof payload.aud === "string" ? [payload.aud] : [];
}

function parseGroups(payload: JWTPayload): string[] {
  const groups = payload.groups;
  return Array.isArray(groups)
    ? groups.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function buildDevBypassSession(request: Request): OperatorSession {
  const headers = request.headers;
  return {
    mode: "dev-bypass",
    subject:
      trimOrNull(headers.get("x-edgeintel-dev-subject")) ?? "dev-bypass-operator",
    email:
      trimOrNull(headers.get("x-edgeintel-dev-email")) ?? "dev@edgeintel.local",
    name: trimOrNull(headers.get("x-edgeintel-dev-name")) ?? "EdgeIntel Local Dev",
    issuer: "edgeintel-dev-bypass",
    audience: ["edgeintel-local"],
    groups: [],
    issuedAt: new Date().toISOString(),
    expiresAt: null,
  };
}

function getJwks(teamDomain: string) {
  const normalized = normalizeTeamDomain(teamDomain);
  const cached = JWKS_CACHE.get(normalized);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(
    new URL(`https://${normalized}/cdn-cgi/access/certs`),
  );
  JWKS_CACHE.set(normalized, jwks);
  return jwks;
}

function getAccessConfig(env: Env): { teamDomain: string; aud: string } {
  const teamDomain = trimOrNull(env.ACCESS_TEAM_DOMAIN);
  const aud = trimOrNull(env.ACCESS_AUD);

  if (!teamDomain || !aud) {
    throw new Error(
      "ACCESS_TEAM_DOMAIN and ACCESS_AUD must be configured for Access-protected control-plane routes.",
    );
  }

  return {
    teamDomain: normalizeTeamDomain(teamDomain),
    aud,
  };
}

export async function requireOperatorSession(
  request: Request,
  env: Env,
): Promise<OperatorSession | Response> {
  const url = new URL(request.url);
  const allowDevBypass = String(env.ACCESS_ALLOW_DEV_BYPASS ?? "").toLowerCase() === "true";
  if (allowDevBypass && isLocalDevelopmentHost(url.hostname)) {
    return buildDevBypassSession(request);
  }

  let config: { teamDomain: string; aud: string };
  try {
    config = getAccessConfig(env);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Access configuration is incomplete.",
      },
      { status: 500 },
    );
  }

  const token = trimOrNull(request.headers.get("Cf-Access-Jwt-Assertion"));
  if (!token) {
    return jsonResponse(
      { error: "Missing Cf-Access-Jwt-Assertion header." },
      { status: 401 },
    );
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(config.teamDomain), {
      issuer: `https://${config.teamDomain}`,
      audience: config.aud,
    });

    return {
      mode: "access",
      subject:
        trimOrNull(typeof payload.sub === "string" ? payload.sub : null) ??
        "unknown-subject",
      email:
        trimOrNull(typeof payload.email === "string" ? payload.email : null) ?? null,
      name: trimOrNull(typeof payload.name === "string" ? payload.name : null) ?? null,
      issuer:
        trimOrNull(typeof payload.iss === "string" ? payload.iss : null) ??
        `https://${config.teamDomain}`,
      audience: parseAudience(payload),
      groups: parseGroups(payload),
      issuedAt: toIsoTimestamp(payload.iat),
      expiresAt: toIsoTimestamp(payload.exp),
    };
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? `Access token validation failed: ${error.message}`
            : "Access token validation failed.",
      },
      { status: 403 },
    );
  }
}
