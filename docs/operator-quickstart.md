# Operator Quickstart

This is the fastest factual guide to using EdgeIntel in its current state.

In deployed environments, `/app*` and `/api/*` are private-by-default. Remote
operator use requires Cloudflare Access to be configured first. Without that,
the public deployed hostname is only suitable for `/health`, MCP metadata, and
basic auth-challenge smoke tests.

For the current deployment, use `https://edgeintel.app` as the primary host.

EdgeIntel currently expects one Access audience for protected operator traffic,
so the recommended setup is:

- one protected Access app for `edgeintel.app/*`
- more-specific bypass apps for the public health, MCP, pairing-exchange, and
  heartbeat routes

Use
[`docs/access-mcp-activation.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/access-mcp-activation.md)
to finish the remote activation phase.

## What Is UI-Driven Today

Current app surfaces:

- `/app`
- `/app/providers`
- `/app/scans`
- `/app/exports`
- `/app/tunnels`

Current scan and report flows are now available in the app shell and through the API:

- `POST /api/scan`
- `GET /api/scans/recent`
- `GET /api/jobs/:jobId`
- `GET /api/domains/:domain/latest`
- `GET /api/scans/:scanRunId/commercial-brief`
- `GET /api/scans/:scanRunId/exports`
- `POST /api/exports/:scanRunId`

That means the provider, scan, export, and tunnel workflows all have a Worker-served
operator surface now, while the APIs remain the source-of-truth for automation,
curl-driven demos, and local debugging once you are either:

- on local development with the deliberate localhost bypass, or
- behind Cloudflare Access on the deployed host

## 1. Configure A Model Provider

1. Open `/app/providers`.
2. Create a provider entry.
3. Choose the provider preset.
4. Set the auth strategy shown by the catalog.
5. Save the secret material.
6. Run the provider test.

Recommended defaults:

- OpenAI / Anthropic / Gemini / OpenRouter: `api-key`
- Workers AI: `workers-binding`
- Ollama or custom local route: `api-key` or `none`, depending on the upstream
  gateway and Access posture

## 2. Configure A Local Model Route

1. Open `/app/tunnels`.
2. Discover the zone.
3. Enter the desired hostname.
4. Run hostname validation.
5. Provision the tunnel route.
6. Create a pairing session for the desktop connector.

At this point, the cloud control plane is ready, but the route is not live
until the paired machine runs the connector and `cloudflared`.

## 3. Pair The Desktop Connector

1. Open the EdgeIntel Connector app on macOS.
2. Start pairing from the app.
3. Exchange the one-time pairing secret.
4. Let the app install or validate `cloudflared`.
5. Start the local route.
6. Confirm the tunnel heartbeat and connection test in `/app/tunnels`.

## 4. Run A Scan

### App path

1. Open `/app/scans`.
2. Enter the domain.
3. Create the scan job.
4. Wait for the selected run to settle.
5. Review findings, recommendations, and the commercial brief in the same page.

### Local development path

From the repo root during local development:

```bash
curl -X POST http://127.0.0.1:8787/api/scan \
  -H "content-type: application/json" \
  -d '{"domain":"hostinginfo.gg"}'
```

Capture the returned `jobId`.

### Remote path

For remote use, first finish the Access setup in
[`docs/deploy-to-cloudflare.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/deploy-to-cloudflare.md).
Then call the same API surface through the Access-protected hostname with a
valid `Cf-Access-Jwt-Assertion` header or an Access-backed browser session.

## 5. Follow Job Progress

```bash
curl http://127.0.0.1:8787/api/jobs/<job-id>
```

If you want event streaming:

```bash
curl -N http://127.0.0.1:8787/api/jobs/<job-id>/events
```

## 6. Read The Latest Result

```bash
curl http://127.0.0.1:8787/api/domains/hostinginfo.gg/latest
```

Use the returned `scanRunId` for the next steps.

## 7. Pull The Commercial Brief

JSON:

```bash
curl http://127.0.0.1:8787/api/scans/<scan-run-id>/commercial-brief
```

Markdown:

```bash
curl "http://127.0.0.1:8787/api/scans/<scan-run-id>/commercial-brief?format=markdown"
```

## 8. Create An Export

### App path

1. Open `/app/exports` or use the export section inside `/app/scans`.
2. Select the scan run.
3. Choose the output format.
4. Download the generated artifact from the export list.

Markdown:

```bash
curl -X POST http://127.0.0.1:8787/api/exports/<scan-run-id> \
  -H "content-type: application/json" \
  -d '{"format":"markdown"}'
```

Other useful formats:

- `json`
- `terraform`
- `cf-api`

## 9. Generate An AI Brief

If inference is configured:

```bash
curl -X POST http://127.0.0.1:8787/api/scans/<scan-run-id>/ai-brief \
  -H "content-type: application/json" \
  -d '{"providerSettingId":"<provider-id>"}'
```

Use this as a grounded explanation layer, not as the source-of-truth result.

## Recommended Daily Operator Flow

1. Confirm provider health.
2. Confirm tunnel health if local routes are involved.
3. Run or review scans.
4. Read the commercial brief.
5. Generate the export needed for the audience:
   technical, customer-facing, or Cloudflare-implementation-oriented.

## Public Deployed Smoke Checklist

If you only need to confirm the Cloudflare deployment itself before the full
Access setup is ready, verify:

- `/health` returns `200`
- `/.well-known/oauth-authorization-server` returns `200`
- `/.well-known/oauth-protected-resource/mcp` returns `200`
- `/mcp` without a token returns `401`

Do not treat that as full operator readiness. The actual app and API workflows
remain Access-gated.
