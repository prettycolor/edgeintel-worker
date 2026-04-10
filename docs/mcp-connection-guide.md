# EdgeIntel MCP Connection Guide

This is the Phase 18 operator guide for the authenticated EdgeIntel MCP server.

EdgeIntel now exposes a remote MCP surface on:

- `/mcp`
- `/authorize`
- `/callback`
- `/token`
- `/register`

It uses:

- Cloudflare Workers OAuth Provider for the OAuth server
- Cloudflare Access for SaaS as the upstream identity/OIDC provider
- a bounded Tier 1 tool set only

EdgeIntel does **not** expose pairing, heartbeat, provider secret reads, or
tunnel mutation through MCP.

## What The Current MCP Server Can Do

The current authenticated tool set covers:

- scan creation
- job status lookup
- latest domain posture lookup
- domain history lookup
- commercial brief lookup
- export generation
- provider catalog lookup
- inference capability lookup
- zone discovery
- hostname validation
- tunnel observability lookup

The scope model is implemented in
[`apps/worker/src/mcp/scopes.ts`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/src/mcp/scopes.ts).

## Prerequisites

- A deployed EdgeIntel Worker on Cloudflare
- A Cloudflare Zero Trust organization
- A Cloudflare Access for SaaS application configured as OIDC
- A public EdgeIntel hostname for the deployed Worker
- Wrangler auth pointed at the correct account

Relevant Cloudflare docs:

- [Secure MCP servers with Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/)
- [MCP authorization on Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)
- [Securing MCP servers](https://developers.cloudflare.com/agents/guides/securing-mcp-server/)

## 1. Create The OAuth KV Namespaces

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler kv namespace create edgeintel-oauth --binding OAUTH_KV --update-config
npx wrangler kv namespace create edgeintel-oauth-preview --binding OAUTH_KV --preview --update-config
```

This replaces the placeholder `OAUTH_KV` IDs in
[`wrangler.jsonc`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/wrangler.jsonc).

## 2. Create The Access For SaaS OIDC App

In Cloudflare One:

1. Go to `Access controls` -> `Applications`.
2. Select `Add an application`.
3. Choose `SaaS`.
4. Name the app something like `EdgeIntel MCP`.
5. Choose `OIDC`.
6. Create the app.

Copy these values from the SaaS application:

- Client ID
- Client secret
- Authorization endpoint
- Token endpoint
- JWKS endpoint

Important:

- Use the OIDC values from the Cloudflare Access for SaaS app.
- Do **not** use the identity provider's raw OAuth endpoints directly.
- EdgeIntel prefixes these secrets with `MCP_` so they do not collide with the
  existing operator-app Access variables.

## 3. Set The EdgeIntel MCP Secrets

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler secret put MCP_ACCESS_CLIENT_ID
npx wrangler secret put MCP_ACCESS_CLIENT_SECRET
npx wrangler secret put MCP_ACCESS_TOKEN_URL
npx wrangler secret put MCP_ACCESS_AUTHORIZATION_URL
npx wrangler secret put MCP_ACCESS_JWKS_URL
```

Unlike Cloudflare’s example template, Phase 18 of EdgeIntel does **not** use a
cookie-encryption secret. The current implementation uses:

- one-time CSRF cookies for the `/authorize` form
- one-time PKCE/OAuth state stored in `OAUTH_KV`

The relevant code is in:

- [`apps/worker/src/mcp/oauth-utils.ts`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/src/mcp/oauth-utils.ts)
- [`apps/worker/src/mcp/access-handler.ts`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/src/mcp/access-handler.ts)

## 4. Deploy And Verify The MCP Metadata Surface

Deploy the Worker:

```bash
npm run deploy
```

After deploy, verify these endpoints on your EdgeIntel hostname:

- `https://<edgeintel-host>/.well-known/oauth-authorization-server`
- `https://<edgeintel-host>/.well-known/oauth-protected-resource/mcp`

Also verify that:

- `GET /authorize` renders the approval page
- `POST /mcp` without a token returns an OAuth challenge flow instead of the
  normal operator-session response

## 5. Test With MCP Inspector

The quickest live test is MCP Inspector against the deployed Worker.

Example flow:

```bash
npx @modelcontextprotocol/inspector@latest
```

Then connect the remote server URL:

```text
https://<edgeintel-host>/mcp
```

The client should:

1. receive the OAuth authorization challenge
2. open the browser
3. hit EdgeIntel `/authorize`
4. redirect through the Cloudflare Access for SaaS OIDC flow
5. return to the client with an MCP token
6. list the allowed EdgeIntel tools

## 6. Test With Claude Desktop Or Another MCP Host

For hosts that support `mcp-remote`, the current connection pattern is:

```json
{
  "mcpServers": {
    "edgeintel": {
      "command": "npx",
      "args": ["mcp-remote", "https://<edgeintel-host>/mcp"]
    }
  }
}
```

Use this only after the deployed Worker and Access for SaaS app are already
working through the Inspector flow.

## 7. Current Scope Model

The current supported scopes are:

- `edgeintel.scan.read`
- `edgeintel.scan.create`
- `edgeintel.export.generate`
- `edgeintel.catalog.read`
- `edgeintel.zone.read`
- `edgeintel.hostname.validate`
- `edgeintel.tunnel.read`

These are surfaced in protected resource metadata and enforced again inside the
server when tools are registered.

## 8. Safe Exclusions

The current MCP server intentionally excludes:

- provider secret reads
- provider create/update/delete
- tunnel create/update/delete
- tunnel token rotation
- pairing creation and pairing exchange
- connector heartbeat

Those remain HTTP/operator-only surfaces because their blast radius is too high
for the first MCP release.

## 9. Recommended Demo Path

For a live demo:

1. show the EdgeIntel app shell first
2. show a completed domain scan and commercial brief
3. connect EdgeIntel through MCP Inspector
4. list tools
5. run `edgeintel.domain.latest.get`
6. run `edgeintel.scan.commercial_brief.get`
7. run `edgeintel.export.create`
8. explain why pairings and tunnel mutation stay out of MCP v1

That keeps the story technical, secure, and clearly Cloudflare-native.
