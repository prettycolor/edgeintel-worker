import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Env } from "../env";
import { jsonResponse } from "../lib/utils";
import {
  consumeOAuthState,
  createOAuthState,
  decodeAuthorizeState,
  exchangeAccessAuthorizationCode,
  getMcpAccessConfig,
  issueCsrfCookie,
  renderAuthorizePage,
  validateCsrfCookie,
  verifyAccessIdToken,
  buildAccessAuthorizationUrl,
} from "./oauth-utils";
import { resolveRequestedMcpScopes } from "./scopes";

type EnvWithOAuth = Env & { OAUTH_PROVIDER: OAuthHelpers };

function oauthError(message: string, status = 400): Response {
  return jsonResponse(
    {
      error: message,
    },
    { status },
  );
}

function parseGrantedScopes(oauthReqInfo: AuthRequest): string[] {
  const scopes = resolveRequestedMcpScopes(oauthReqInfo.scope);
  if (scopes.length === 0) {
    throw new Error("The requested MCP scopes are not supported by EdgeIntel.");
  }
  return scopes;
}

export async function handleMcpAccessRequest(
  request: Request,
  env: EnvWithOAuth,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (request.method === "GET" && pathname === "/authorize") {
    try {
      getMcpAccessConfig(env);
      const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const client = oauthReqInfo.clientId
        ? await env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId)
        : null;
      const grantedScopes = parseGrantedScopes(oauthReqInfo);
      const csrf = issueCsrfCookie();
      const response = renderAuthorizePage({
        request,
        oauthReqInfo,
        client,
        csrfToken: csrf.token,
        grantedScopes,
      });
      response.headers.append("Set-Cookie", csrf.setCookie);
      return response;
    } catch (error) {
      return oauthError(
        error instanceof Error ? error.message : "Failed to start MCP authorization.",
        500,
      );
    }
  }

  if (request.method === "POST" && pathname === "/authorize") {
    try {
      const config = getMcpAccessConfig(env);
      const formData = await request.formData();
      const action = formData.get("action");
      const clearCookie = validateCsrfCookie(request, formData);

      if (action !== "approve") {
        return new Response("MCP authorization was denied.", {
          status: 403,
          headers: {
            "Set-Cookie": clearCookie,
          },
        });
      }

      const oauthReqInfo = decodeAuthorizeState(formData.get("state"));
      parseGrantedScopes(oauthReqInfo);
      const { stateToken, codeChallenge } = await createOAuthState(
        oauthReqInfo,
        env.OAUTH_KV,
      );

      return new Response(null, {
        status: 302,
        headers: {
          location: buildAccessAuthorizationUrl(
            request,
            config,
            stateToken,
            codeChallenge,
          ),
          "Set-Cookie": clearCookie,
        },
      });
    } catch (error) {
      return oauthError(
        error instanceof Error ? error.message : "Failed to approve MCP authorization.",
        400,
      );
    }
  }

  if (request.method === "GET" && pathname === "/callback") {
    try {
      const config = getMcpAccessConfig(env);
      const { oauthReqInfo, codeVerifier } = await consumeOAuthState(
        request,
        env.OAUTH_KV,
      );
      const { idToken } = await exchangeAccessAuthorizationCode(
        request,
        config,
        codeVerifier,
      );
      const identity = await verifyAccessIdToken(config, idToken);
      const grantedScopes = parseGrantedScopes(oauthReqInfo);

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReqInfo,
        userId: identity.sub,
        scope: grantedScopes,
        metadata: {
          email: identity.email,
          label: identity.name ?? identity.email ?? identity.sub,
        },
        props: {
          email: identity.email,
          grantedScopes,
          login: identity.sub,
          name: identity.name,
        },
      });

      return Response.redirect(redirectTo, 302);
    } catch (error) {
      return oauthError(
        error instanceof Error ? error.message : "MCP callback handling failed.",
        400,
      );
    }
  }

  return new Response("Not Found", { status: 404 });
}
