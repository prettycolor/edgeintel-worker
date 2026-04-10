# EdgeIntel

Cloudflare-native domain posture and remediation engine for the `hostingtool.dev` / `hostinginfo.gg` environment.

## What This Implements

- `POST /api/scan` to create a bounded public-domain scan job
- `POST /api/domains/:domain/rescan` to trigger a fresh single-domain scan job
- `POST /api/domains/:domain/watch` and `DELETE /api/domains/:domain/watch`
  to manage hourly-to-weekly scheduled rescans
- `GET /api/domains/:domain/latest` and `GET /api/domains/:domain/history`
  for latest posture and diff-aware run history
- `GET /api/inference/capabilities` to inspect the configured hosted and
  local-model inference routes
- `GET|POST|PATCH|DELETE /api/settings/providers` plus
  `POST /api/settings/providers/:id/test` for provider control-plane
  configuration, encrypted secret storage, and connection testing
- `GET|POST|PATCH|DELETE /api/tunnels` plus
  `POST /api/tunnels/:id/test`,
  `POST /api/tunnels/:id/rotate-token`, and
  `POST /api/tunnels/:id/heartbeat` for local-model tunnel orchestration,
  runtime testing, scoped connector pairing, and heartbeat status
- `GET /api/zones` and `POST /api/hostnames/validate` for Cloudflare zone
  discovery, suffix-based hostname matching, and DNS conflict preflight
- `GET /api/session`, `POST /api/pairings`, and
  `POST /api/pairings/:id/exchange` for Access-authenticated operator session
  inspection plus one-time connector bootstrap exchange
- `GET /app` and `GET /app/providers` for the current Worker-served provider control-plane UI
- `GET /app/tunnels` for the current Worker-served tunnel and local-model wizard workspace
- `POST /api/scans/:scanRunId/ai-brief` to generate an evidence-bounded AI
  brief from persisted findings and recommendations
- Durable Object job coordination with job snapshots and event streaming
- Workflow-driven orchestration that fans out stateless scan work through Cloudflare Queues
- Scheduled watch processing through an hourly cron trigger
- Public web posture collection across:
  - DoH-based DNS
  - HTTP/HTTPS response and redirect analysis
  - provider attribution and surface detection
  - findings and Cloudflare recommendation generation
- Artifact generation into R2, with Browser Rendering REST support when configured
  - `response-metadata` evidence
  - `raw-html`
  - `rendered-markdown`
  - `screenshot`
  - `artifact-manifest` with capture/skip/failure provenance
- Export generation for:
  - Markdown reports
  - JSON findings bundles
  - Terraform drafts
  - Cloudflare API payload drafts
- Weighted Cloudflare Upgrade Planner recommendations with:
  - rollout phase and sequence
  - blocker tracking
  - evidence references
  - executive and technical summaries
- Hybrid inference scaffolding with:
  - AI Gateway binding or HTTPS endpoint support for hosted models
  - OpenAI-compatible HTTPS support for self-hosted Ollama/Gemma endpoints
  - Access header support for Tunnel-protected local-model routes
  - grounded Markdown brief generation that never treats AI as source-of-truth
- Provider control-plane foundations with:
  - D1-backed provider settings records
  - AES-GCM envelope encryption for stored provider secrets
  - per-provider connection testing for Workers AI, Anthropic, and
    OpenAI-compatible routes
  - persisted test status and result history for the app shell
- Tunnel orchestration foundations with:
  - remotely managed Cloudflare Tunnel provisioning
  - Cloudflare zone discovery from the operator API token
  - suffix-based hostname matching and inline DNS conflict validation
  - proxied DNS CNAME management to `<tunnel-id>.cfargotunnel.com`
  - optional Access reusable policy, service token, and self-hosted app creation
  - Access-first app auth for `/app`, `/app/providers`, `/app/tunnels`, and
    secret-bearing tunnel/provider APIs
  - one-time pairing sessions so raw tunnel bootstrap is no longer returned by
    ordinary tunnel detail APIs
  - connector heartbeat updates for machine-side status
- Reference connector runtime with:
  - one-time pairing exchange from the Worker API
  - `cloudflared` validation and launch
  - local service probing
  - authenticated heartbeat reporting back into EdgeIntel

## Layout

- `apps/worker`
  Cloudflare Worker runtime, D1 migrations, queues, workflows, tests, and current app-shell endpoints
- `apps/control-plane-web`
  React operator workspace scaffold that will replace the long-term HTML-string app shell
- `apps/desktop-connector`
  Electron macOS tray/window scaffold for local pairing, `cloudflared`, and diagnostics
- `packages/shared-contracts`
  Shared TypeScript contracts for operator surfaces and future connector/worker interop
- `packages/connector-core`
  Current reference runtime for pairing exchange, local probing, and heartbeat reporting

## Setup

```bash
cd edgeintel-worker
nvm use
npm run bootstrap
npm run dev
```

The bootstrap flow targets `apps/worker` and will:

- require Node 24.x from [`.nvmrc`](./.nvmrc)
- install workspace dependencies if needed
- generate Wrangler-backed runtime types for the Worker package
- copy the existing repo-root `.dev.vars` into `apps/worker/.dev.vars` if present
- create `apps/worker/.dev.vars` from the example if missing
- apply local D1 migrations into the Worker's Wrangler local state

Useful follow-up commands:

```bash
npm run validate:install
npm run db:local:list
npm run db:local:reset
npm run verify
```

## App Surface

EdgeIntel is being built as a Cloudflare-native application, not as a separate
marketing website.

- The Worker runtime and control plane live on Cloudflare.
- The operator UX is intended to be an authenticated app shell served by the
  EdgeIntel stack itself.
- The monorepo now contains a React control-plane workspace and a macOS desktop
  connector scaffold so the next-wave buildout can happen without stretching the
  Worker package into a single giant app.
- The current UI direction is documented in
  [docs/mockups/README.md](./docs/mockups/README.md).

That means the project is Cloudflare-native, but it is not automatically an
embedded panel inside Cloudflare's own dashboard product.

Remote Browser Rendering is optional. If you want rendered markdown and screenshots from Cloudflare Browser Rendering REST, set:

- `BROWSER_RENDERING_REST_BASE_URL`
- `BROWSER_RENDERING_API_TOKEN`

AI Gateway is optional in this initial slice. The scaffold reserves:

- `AI_GATEWAY_ID`
- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_TOKEN`

Cloudflare Access is required for the control-plane surfaces in the current
phase. Configure:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`

For localhost-only development, you can opt into a deliberate bypass with:

- `ACCESS_ALLOW_DEV_BYPASS=true`

Local-model connector onboarding now uses one-time pairings rather than direct
tunnel bootstrap fetches. The current quick start is in
[docs/local-model-route-quickstart.md](./docs/local-model-route-quickstart.md).
- `AI_GATEWAY_MODEL`
- `AI_GATEWAY_PROVIDER`
- `AI_UPSTREAM_API_KEY`
- `AI_INFERENCE_DEFAULT_ROUTE`

If you use `AI_GATEWAY_BASE_URL`, set it to the HTTPS provider or route base that
EdgeIntel should call before `/chat/completions`, not just a generic account URL.

## Ollama / Gemma4

Deployed Workers cannot call `localhost` or private RFC1918 addresses. If you
want Ollama or Gemma4 in the production architecture, expose it through a
controlled HTTPS endpoint, ideally behind Cloudflare Tunnel, and either:

- call it directly as an OpenAI-compatible HTTPS endpoint
- route it through AI Gateway as a custom or routed provider

Phase 6 now includes the provider abstraction and setup documentation for this
path. Start with [docs/hybrid-inference.md](./docs/hybrid-inference.md).

Phase 7A now adds the provider control-plane backend needed for the upcoming
hosted-provider settings UI and local-model tunnel wizard.

Phase 7B adds the first Worker-served app-shell surface at `/app/providers`.

Phase 7C through 7E now add:

- `/api/tunnels` orchestration
- `/app/tunnels` local-model wizard UI
- the reference connector in [`packages/connector-core`](./packages/connector-core/README.md)
- a route quickstart in
  [docs/local-model-route-quickstart.md](./docs/local-model-route-quickstart.md)

Phase 8 now adds:

- npm workspace packaging
- `apps/worker` as the canonical Worker package
- `apps/control-plane-web` as the React operator workspace foundation
- `apps/desktop-connector` as the Electron macOS tray/window scaffold
- `packages/shared-contracts` for shared app and connector types

## Current Scope

This is the phase-0/1 implementation slice:

- real scan orchestration
- real DNS + HTTP posture collection
- real findings and recommendation generation
- real export generation
- bounded artifact generation with explicit provenance and manifest capture

What is intentionally not here yet:

- automatic Cloudflare zone mutation
- private-network or raw port probing
- deep authenticated crawl flows
- AI as a hard dependency for scan completion

## Roadmap

The implementation sequence is documented in [docs/implementation-phases.md](./docs/implementation-phases.md).

For the next onboarding-focused expansion, see
[docs/provider-and-tunnel-wizard-roadmap.md](./docs/provider-and-tunnel-wizard-roadmap.md).

For the local-model setup flow, start with
[docs/local-model-route-quickstart.md](./docs/local-model-route-quickstart.md)
and [connector/README.md](./connector/README.md).

UI direction prototypes for Phase 7 live in [docs/mockups/README.md](./docs/mockups/README.md).

The repo wiki Home page is now available in the GitHub wiki and should become
the canonical operator/setup guide as later phases land.
