# Access And MCP Activation

This is the shortest path from a deployed EdgeIntel Worker to a fully usable
remote operator app and a working MCP OAuth flow.

Use this after the Worker itself is already deployed and
[`/health`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/deploy-to-cloudflare.md)
works.

## What This Activates

This flow enables:

- remote `/app`, `/app/providers`, and `/app/tunnels`
- remote `/api/*` operator routes
- authenticated MCP OAuth through `/authorize`, `/callback`, `/token`, and
  `/mcp`

Without this phase, the deployment is real but only partially activated.

## 1. Run The Remote Readiness Check

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npm run remote:check -- https://edgeintel-worker.care-83e.workers.dev
```

This tells you exactly which secrets and remote surfaces are still missing.

## 2. Activate Cloudflare Access For The Operator Host

Choose one host:

- fastest path: the deployed `workers.dev` URL
- production path: a custom hostname on a zone you control

For `workers.dev`, Cloudflare’s documented path is:

1. Open `Workers & Pages`.
2. Select the `edgeintel-worker` Worker.
3. Go to `Settings > Domains & Routes`.
4. For the `workers.dev` route, click `Enable Cloudflare Access`.
5. Optionally click `Manage Cloudflare Access` to refine the policy.

Cloudflare Access adds `Cf-Access-Jwt-Assertion` to requests, but the Worker
still needs two values to validate it:

- your team domain
- the Access application Audience (`AUD`) tag

## 3. Copy The Access Values

### Team domain

Cloudflare documents the team domain format as:

`https://<your-team-name>.cloudflareaccess.com`

Reference:
[App Launcher](https://developers.cloudflare.com/cloudflare-one/applications/app-launcher/)

### Application audience tag

Cloudflare documents the current dashboard path as:

1. In Cloudflare One, go to `Access controls > Applications`.
2. Select `Configure` for the EdgeIntel application.
3. On the `Basic information` tab, copy the `Application Audience (AUD) Tag`.

Reference:
[Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## 4. Set The Access Secrets

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler secret put ACCESS_TEAM_DOMAIN
npx wrangler secret put ACCESS_AUD
```

If you already have several values ready, you can export them in the shell and
use the activation helper instead:

```bash
npm run remote:activate --workspace @edgeintel/worker -- https://edgeintel-worker.care-83e.workers.dev
```

After setting these, rerun the readiness check. The expected state is:

- `/app` returns `401` for an unauthenticated curl instead of `500`
- `/api/session` returns `401` for an unauthenticated curl instead of `500`

That means the Worker is configured correctly and is now waiting on a real
Access-authenticated browser session.

## 5. Create The Access For SaaS OIDC App For MCP

In Cloudflare One:

1. Go to `Access controls > Applications`.
2. Select `Add an application`.
3. Choose `SaaS`.
4. Choose `OIDC`.
5. Create an application for the EdgeIntel MCP host.

Cloudflare documents the OIDC endpoint pattern as:

- Issuer / Base URL:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>`
- Authorization endpoint:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/authorization`
- Token endpoint:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/token`
- JWKS endpoint:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/jwks`

Reference:
[Generic OIDC application](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/saas-apps/generic-oidc-saas/)

Copy these values:

- client id
- client secret
- authorization endpoint
- token endpoint
- JWKS endpoint

## 6. Set The MCP Secrets

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler secret put MCP_ACCESS_CLIENT_ID
npx wrangler secret put MCP_ACCESS_CLIENT_SECRET
npx wrangler secret put MCP_ACCESS_TOKEN_URL
npx wrangler secret put MCP_ACCESS_AUTHORIZATION_URL
npx wrangler secret put MCP_ACCESS_JWKS_URL
```

After this, rerun the readiness check. The expected state is:

- `/authorize` returns `200`
- `/mcp` still returns `401` without a token
- the metadata endpoints still return `200`

## 7. Set The In-App Cloudflare API Token

This is separate from Wrangler auth. It is the token the deployed Worker uses
for tunnel, DNS, and Access automation.

Set:

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

Recommended minimum permissions:

- Tunnel write
- Access application and policy write
- Zone read
- DNS edit

## 7.5 One-Command Secret Activation

Once you have the values, the fastest path is:

```bash
export ACCESS_TEAM_DOMAIN="your-team.cloudflareaccess.com"
export ACCESS_AUD="your-access-audience-tag"
export MCP_ACCESS_CLIENT_ID="your-mcp-client-id"
export MCP_ACCESS_CLIENT_SECRET="your-mcp-client-secret"
export MCP_ACCESS_TOKEN_URL="https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/token"
export MCP_ACCESS_AUTHORIZATION_URL="https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/authorization"
export MCP_ACCESS_JWKS_URL="https://your-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>/jwks"
export CLOUDFLARE_API_TOKEN="your-in-app-cloudflare-api-token"

npm run remote:activate --workspace @edgeintel/worker -- https://edgeintel-worker.care-83e.workers.dev
```

The script only writes variables that are actually set in the shell.

## 8. Re-Run The Gate

Run:

```bash
npm run remote:check -- https://edgeintel-worker.care-83e.workers.dev
```

Then verify:

- open `/app` in an Access-authenticated browser session
- open `/app/providers`
- open `/app/tunnels`
- test MCP with Inspector against `https://<host>/mcp`

## 9. What Counts As Complete

This phase is complete only when all of these are true:

- Worker health is green
- public MCP metadata is green
- operator app routes are Access-configured
- MCP OAuth routes are fully configured
- in-app Cloudflare orchestration has a token
- the readiness checker shows no missing secret groups
