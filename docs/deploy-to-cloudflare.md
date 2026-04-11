# Deploy EdgeIntel To Your Cloudflare Account

This is the operator runbook for deploying EdgeIntel onto a signed-in
Cloudflare account.

For the Access and MCP activation phase after deploy, use
[`docs/access-mcp-activation.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/access-mcp-activation.md).

## Deployment Modes

Use one of these modes:

- **Local development demo**
  Good for scan, commercial brief, export, provider, and tunnel demos on
  `localhost` with the deliberate local Access bypass.
- **Public smoke deploy**
  Good for proving the Worker, resources, health endpoint, and MCP metadata are
  live on Cloudflare.
- **Full operator deploy**
  Good for provider settings, tunnel orchestration, Access-protected app
  surfaces, and the desktop connector flow.

The public-smoke path is the fastest Cloudflare deploy. The full operator path
is the real product story.

Current canonical EdgeIntel host:

- `https://edgeintel.app`

The legacy `workers.dev` hostname can remain enabled as a fallback smoke host,
but treat `edgeintel.app` as the primary operator and MCP endpoint.

## Prerequisites

- Node `24.x`
- npm `10.x`
- Wrangler `4.x`
- a signed-in Cloudflare account via `wrangler whoami`
- a Cloudflare account with Workers, D1, R2, and Queues enabled

For the full operator path, also prepare:

- a Zero Trust organization
- either:
  - the primary custom hostname `edgeintel.app`, or
  - the default `workers.dev` hostname with Cloudflare Access enabled as a fallback, or
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

After using `--update-config`, review
[`wrangler.jsonc`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/wrangler.jsonc)
before continuing. Repeated resource-creation commands can leave duplicated
bindings behind if you rerun them against an already-initialized config.

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

Without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, deployed requests to `/app*` and
`/api/*` will fail intentionally because EdgeIntel is private-by-default after
Phase 16.

### MCP deploy secrets

```bash
npx wrangler secret put MCP_ACCESS_CLIENT_ID
npx wrangler secret put MCP_ACCESS_CLIENT_SECRET
npx wrangler secret put MCP_ACCESS_TOKEN_URL
npx wrangler secret put MCP_ACCESS_AUTHORIZATION_URL
npx wrangler secret put MCP_ACCESS_JWKS_URL
```

Without these `MCP_ACCESS_*` secrets, the metadata endpoints can still respond,
but `/authorize` cannot complete the OAuth flow.

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

The committed Worker config also publishes the Worker to the custom domain
`edgeintel.app` via a Workers Custom Domain route.

The committed Worker config intentionally leaves `cpu_ms` unset so the default
deploy path also works on Free plan accounts. If you add explicit CPU limits
back into
[`wrangler.jsonc`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/wrangler.jsonc),
Cloudflare Free plans will reject the deploy.

## 7. Minimal Post-Deploy Smoke Test

After deploy, confirm these public endpoints work on `https://edgeintel.app`
first, and optionally on the fallback `workers.dev` hostname:

- `GET /health`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource/mcp`
- `POST /mcp` without a token returns an OAuth challenge (`401`), not a generic
  Worker failure

This proves the Worker, MCP metadata, and public routing are alive.

Then verify the protected operator path:

- `GET /app`
- `GET /api/session`
- `POST /api/scan`
- `GET /api/domains/:domain/latest`

These routes only work after `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set and
the request is coming through Cloudflare Access with a valid
`Cf-Access-Jwt-Assertion` header.

Then verify the MCP OAuth flow:

- `GET /authorize`
- `POST /token`
- MCP Inspector against `https://<edgeintel-host>/mcp`

These only work after the `MCP_ACCESS_*` secrets are set.

To summarize all of this against the live deployment, run:

```bash
npm run remote:check --workspace @edgeintel/worker -- https://<edgeintel-host>
```

To write several remote secrets in one pass and rerun the gate immediately:

```bash
npm run remote:activate --workspace @edgeintel/worker -- https://<edgeintel-host>
```

## 8. Full Operator App Setup

To use `/app/providers` and `/app/tunnels` remotely, protect the app with
Cloudflare Access.

### Recommended pattern

Use `edgeintel.app` as the primary operator host and keep `workers.dev` only as
a fallback smoke host.

Important implementation detail:

- EdgeIntel currently validates a single `ACCESS_AUD`.
- Because of that, create one primary self-hosted Access app for
  `edgeintel.app/*`.
- Then create more-specific bypass apps for the public routes that must stay
  reachable without Access.

Minimum Access layout:

1. protected app: `edgeintel.app/*`
2. bypass app: `edgeintel.app/health`
3. bypass app: `edgeintel.app/.well-known/*`
4. bypass app: `edgeintel.app/mcp`
5. bypass app: `edgeintel.app/authorize*`
6. bypass app: `edgeintel.app/callback`
7. bypass app: `edgeintel.app/token`
8. bypass app: `edgeintel.app/register`
9. bypass app: `edgeintel.app/api/pairings/*/exchange`
10. bypass app: `edgeintel.app/api/tunnels/*/heartbeat`

Then:

1. Copy the Access application audience from the protected `edgeintel.app/*`
   app into `ACCESS_AUD`.
2. Set `ACCESS_TEAM_DOMAIN` to your Zero Trust team domain.
3. Verify that protected requests now include `Cf-Access-Jwt-Assertion`.

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

## Fastest Interview Demo Path

If time is constrained, use this path:

1. Deploy the Worker to Cloudflare and verify `/health` plus the MCP metadata
2. Run the full operator/scan/commercial/export demo locally on `localhost`
3. Show the deployed `workers.dev` or custom-domain health/MCP endpoints as the
   live Cloudflare proof point
4. If Access is ready, switch to the full remote operator app demo on the
   protected `workers.dev` URL or custom hostname

That keeps the demo factual. It does not pretend the protected operator app is
publicly usable before Access and MCP OAuth are actually configured.
