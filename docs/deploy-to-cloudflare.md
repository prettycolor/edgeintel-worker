# Deploy EdgeIntel To Your Cloudflare Account

This is the operator runbook for deploying EdgeIntel onto a signed-in
Cloudflare account.

## Deployment Modes

Use one of these modes:

- **Minimal API deploy**
  Good for scan, commercial brief, and export demos on `workers.dev`.
- **Full operator deploy**
  Good for provider settings, tunnel orchestration, Access-protected app
  surfaces, and the desktop connector flow.

The minimal path is faster. The full path is the real product story.

## Prerequisites

- Node `24.x`
- npm `10.x`
- Wrangler `4.x`
- a signed-in Cloudflare account via `wrangler whoami`
- a Cloudflare account with Workers, D1, R2, and Queues enabled

For the full operator path, also prepare:

- a Zero Trust organization
- a custom hostname you control for the EdgeIntel app
- a Cloudflare API token for in-app tunnel, DNS, and Access orchestration
- a Cloudflare Access for SaaS OIDC application for the MCP surface

## 1. Verify Wrangler Auth

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler whoami
```

If this does not show the intended account, fix auth first.

## 2. Install Dependencies And Verify Locally

From the repo root:

```bash
nvm use
npm ci
npm run db:local:apply
npm run verify
```

Do not deploy a branch that has not passed the local verify gate.

## 3. Create The Cloudflare Resources

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

### D1

```bash
npx wrangler d1 create edgeintel --binding EDGE_DB --update-config
```

This creates the database and writes the remote `database_id` into
[`wrangler.jsonc`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/wrangler.jsonc).

### R2

```bash
npx wrangler r2 bucket create edgeintel-artifacts --binding EDGE_ARTIFACTS --update-config
```

### KV For MCP OAuth State

```bash
npx wrangler kv namespace create edgeintel-oauth --binding OAUTH_KV --update-config
npx wrangler kv namespace create edgeintel-oauth-preview --binding OAUTH_KV --preview --update-config
```

### Queues

```bash
npx wrangler queues create edgeintel-scan
npx wrangler queues create edgeintel-artifacts
```

The queue names already match the current Worker config, so no further config
change is needed unless you intentionally rename them.

## 4. Set Deployment Secrets

The Worker needs different secrets depending on which path you deploy.

### Minimum deploy secrets

```bash
npx wrangler secret put PROVIDER_SECRET_ENCRYPTION_KEY
```

Generate the key with:

```bash
openssl rand -base64 32 | tr -d '\n'
```

### Optional AI and Browser Rendering secrets

```bash
npx wrangler secret put AI_GATEWAY_TOKEN
npx wrangler secret put AI_UPSTREAM_API_KEY
npx wrangler secret put BROWSER_RENDERING_API_TOKEN
```

### Full operator deploy secrets

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler secret put ACCESS_TEAM_DOMAIN
npx wrangler secret put ACCESS_AUD
```

### MCP deploy secrets

```bash
npx wrangler secret put MCP_ACCESS_CLIENT_ID
npx wrangler secret put MCP_ACCESS_CLIENT_SECRET
npx wrangler secret put MCP_ACCESS_TOKEN_URL
npx wrangler secret put MCP_ACCESS_AUTHORIZATION_URL
npx wrangler secret put MCP_ACCESS_JWKS_URL
```

For local-model routing or BYOK inference, also set the relevant optional
provider secrets from
[`apps/worker/.dev.vars.example`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/.dev.vars.example).

## 5. Apply Remote D1 Migrations

From [`apps/worker`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker):

```bash
npx wrangler d1 migrations apply edgeintel --remote
```

Use the remote database name or binding shown in your config.

## 6. Deploy The Worker

From the repo root:

```bash
npm run deploy
```

This deploys the Worker, Durable Object, Workflow, and queue consumers to your
authenticated Cloudflare account.

## 7. Minimal Post-Deploy Smoke Test

After deploy, confirm these work on your `workers.dev` or custom domain:

- `POST /api/scan`
- `GET /api/domains/:domain/latest`
- `GET /api/scans/:scanRunId/commercial-brief`
- `POST /api/exports/:scanRunId`

If your deployment is only for the scan/commercial demo path, this is enough.

If you are also demoing MCP, verify:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource/mcp`

## 8. Full Operator App Setup

To use `/app/providers` and `/app/tunnels` remotely, protect the app with
Cloudflare Access.

### Recommended pattern

1. Attach the Worker to a custom hostname you control.
2. Create a Cloudflare Access self-hosted application that protects that host.
3. Copy the Access application audience into `ACCESS_AUD`.
4. Set `ACCESS_TEAM_DOMAIN` to your Zero Trust team domain.
5. Verify that requests to `/app`, `/app/providers`, `/app/tunnels`, and the
   secret-bearing APIs now include `Cf-Access-Jwt-Assertion`.

Without this, the control-plane app routes will reject remote use.

## 8.5 MCP Access Setup

The EdgeIntel MCP server uses a separate OAuth path from the app-shell Access
JWT gate.

Use Cloudflare Access for SaaS as the upstream OIDC provider for MCP, then wire
its client credentials and endpoint URLs into the `MCP_ACCESS_*` Worker
secrets.

The full setup flow is in
[`docs/mcp-connection-guide.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/mcp-connection-guide.md).

## 9. Full Operator API Token Guidance

For the Worker's in-app Cloudflare orchestration token, start with the smallest
set of account and zone permissions that still supports your workflow.

At minimum, validate the current Cloudflare permissions for:

- Tunnel write access
- Access application and policy write access
- Zone read access
- DNS edit access for the zones EdgeIntel will manage

Do not reuse an overly broad admin token when a purpose-built token will do.

## 10. Desktop Connector Pairing

After the Worker is live and Access-protected:

1. Open `/app/tunnels`.
2. Create or update the tunnel route.
3. Create a pairing session.
4. Start the desktop connector app.
5. Pair the machine.
6. Install and launch `cloudflared`.
7. Run the tunnel connection test from the app.

The detailed operator flow is in
[`docs/operator-quickstart.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/operator-quickstart.md).

## Fastest Interview Deploy

If time is constrained, use this path:

1. Minimal API deploy on `workers.dev`
2. Run the scan/commercial brief/export demo
3. Separately show the provider and tunnel control plane locally
4. Explain the full Access-protected custom-domain setup as the production path

That keeps the live demo tight without pretending the control plane is already a
public multi-user product.
