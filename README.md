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
- `GET /api/scans/:scanRunId/commercial-brief` for an SE-grade Cloudflare fit,
  access-hardening, latency/resilience, and expansion-motion summary
- `GET|POST|PATCH|DELETE /api/settings/providers` plus
  `GET /api/settings/provider-catalog`,
  `POST /api/settings/providers/:id/test`, and
  `DELETE /api/settings/providers/:id/secret` for provider control-plane
  configuration, encrypted secret storage, auth-strategy-aware diagnostics,
  and connection testing
- `GET|POST|PATCH|DELETE /api/tunnels` plus
  `POST /api/tunnels/:id/test`,
  `POST /api/tunnels/:id/rotate-token`, and
  `POST /api/tunnels/:id/heartbeat` for local-model tunnel orchestration,
  runtime testing, scoped connector pairing, and heartbeat status
- `GET /api/zones` and `POST /api/hostnames/validate` for Cloudflare zone
  discovery, suffix-based hostname matching, and DNS conflict preflight
- `GET /api/tunnels/:id/events` and `GET /api/tunnels/:id/observability`
  for tunnel event history, recent test runs, last-known-good state, and
  drift/failure summaries
- `GET /api/session`, `POST /api/pairings`, and
  `POST /api/pairings/:id/exchange` for Access-authenticated operator session
  inspection plus one-time connector bootstrap exchange
- `GET /app` and `GET /app/providers` for the current Worker-served provider control-plane UI
- `GET /app/tunnels` for the current Worker-served tunnel and local-model wizard workspace
- `POST /api/scans/:scanRunId/ai-brief` to generate an evidence-bounded AI
  brief from persisted findings and recommendations
- private-by-default route auth across `/app*` and `/api/*`, with only
  `/health`, `/api/pairings/:id/exchange`, and
  `/api/tunnels/:id/heartbeat` intentionally left outside the operator session gate
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
- Commercial brief output with:
  - Cloudflare fit scoring
  - access-hardening posture scoring
  - latency and resilience opportunity scoring
  - origin exposure narrative
  - ranked expansion candidates
- Hybrid inference scaffolding with:
  - AI Gateway binding or HTTPS endpoint support for hosted models
  - OpenAI-compatible HTTPS support for self-hosted Ollama/Gemma endpoints
  - Access header support for Tunnel-protected local-model routes
  - grounded Markdown brief generation that never treats AI as source-of-truth
- Provider control-plane foundations with:
  - D1-backed provider settings records
  - AES-GCM envelope encryption for stored provider secrets
  - provider capability presets for OpenAI, Anthropic, Gemini, OpenRouter,
    Workers AI, Ollama, and custom OpenAI-compatible routes
  - explicit auth strategies (`api-key`, `workers-binding`, or `none`) instead
    of implying a universal OAuth flow
  - per-provider connection testing for Workers AI, Anthropic, and
    OpenAI-compatible routes
  - secret health summaries that distinguish upstream auth posture from
    Cloudflare Access service-token posture
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
  - persisted tunnel event history and test-run history for diagnostics
  - last-known-good and failure-delta summaries in the tunnel workspace
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
  Electron macOS tray/window app for local pairing, `cloudflared` install and supervision, and machine-side diagnostics
- `packages/shared-contracts`
  Shared TypeScript contracts for operator surfaces and future connector/worker interop
- `packages/intelligence-rules`
  Worker-safe hosting/provider canonicalization rules extracted from the hostinginfo intelligence layer
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
- The MCP decision and rollout are documented in
  [docs/phase-17-edgeintel-mcp-plan.md](./docs/phase-17-edgeintel-mcp-plan.md)
  and [docs/edgeintel-mcp-tool-matrix.md](./docs/edgeintel-mcp-tool-matrix.md).

That means the project is Cloudflare-native, but it is not automatically an
embedded panel inside Cloudflare's own dashboard product.

Remote Browser Rendering is optional. If you want rendered markdown and screenshots from Cloudflare Browser Rendering REST, set:

- `BROWSER_RENDERING_REST_BASE_URL`
- `BROWSER_RENDERING_API_TOKEN`

AI Gateway is optional in this initial slice. The scaffold reserves:

- `AI_GATEWAY_ID`
- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_MODEL`
- `AI_GATEWAY_PROVIDER`
- `AI_GATEWAY_TOKEN`
- `AI_UPSTREAM_API_KEY`
- `AI_INFERENCE_DEFAULT_ROUTE`

Cloudflare Access is required for the control-plane surfaces in the current
phase. Configure:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`

For localhost-only development, you can opt into a deliberate bypass with:

- `ACCESS_ALLOW_DEV_BYPASS=true`

Local-model connector onboarding now uses one-time pairings rather than direct
tunnel bootstrap fetches. The current quick start is in
[docs/local-model-route-quickstart.md](./docs/local-model-route-quickstart.md).

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

Phase 12 now adds:

- a real macOS desktop connector flow instead of a placeholder scaffold
- encrypted local connector state via Electron `safeStorage`
- one-time pairing exchange inside the app
- managed `cloudflared` detection plus official GitHub-release install with checksum verification
- runtime supervision, local service probing, and heartbeat reporting without CLI use
- tray-aware diagnostics and a desktop setup workspace for pairing, install, test, start, and stop

Phase 13 now adds:

- a provider capability catalog endpoint for the control plane
- an auth-strategy-aware provider UX in `/app/providers`
- explicit credential posture summaries and supported-auth guidance per provider
- secret clearing from the operator workspace without deleting the provider record
- Gemini and OpenRouter as first-class API-key presets alongside OpenAI, Anthropic, Workers AI, Ollama, and custom OpenAI-compatible routes

Phase 14 now adds:

- `@edgeintel/intelligence-rules` as the shared hosting/provider canonicalization layer
- stronger DNS, edge, and origin attribution guardrails in the Worker scan summary
- a first-class commercial brief endpoint at `/api/scans/:scanRunId/commercial-brief`
- export v1.6 with commercial brief content embedded into Markdown, JSON, and API payload outputs

Phase 15 now adds:

- the canonical demo script in [docs/demo-script.md](./docs/demo-script.md)
- the canonical demo domain mix in [docs/demo-domain-set.md](./docs/demo-domain-set.md)
- the architecture narrative in [docs/architecture-story.md](./docs/architecture-story.md)
- the final visual QA checklist in [docs/visual-qa-checklist.md](./docs/visual-qa-checklist.md)

Release-layer docs now add:

- deployment runbook in [docs/deploy-to-cloudflare.md](./docs/deploy-to-cloudflare.md)
- operator usage guide in [docs/operator-quickstart.md](./docs/operator-quickstart.md)
- release checklist in [docs/release-checklist.md](./docs/release-checklist.md)
- MCP evaluation in [docs/mcp-server-evaluation.md](./docs/mcp-server-evaluation.md)
- maintenance and security roadmap in
  [docs/maintenance-and-security-roadmap.md](./docs/maintenance-and-security-roadmap.md)

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
and [packages/connector-core/README.md](./packages/connector-core/README.md).

UI direction prototypes for Phase 7 live in [docs/mockups/README.md](./docs/mockups/README.md).

Interview/demo assets now live in:

- [docs/demo-script.md](./docs/demo-script.md)
- [docs/demo-domain-set.md](./docs/demo-domain-set.md)
- [docs/architecture-story.md](./docs/architecture-story.md)
- [docs/visual-qa-checklist.md](./docs/visual-qa-checklist.md)

Release/operator docs now live in:

- [docs/deploy-to-cloudflare.md](./docs/deploy-to-cloudflare.md)
- [docs/operator-quickstart.md](./docs/operator-quickstart.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
- [docs/mcp-server-evaluation.md](./docs/mcp-server-evaluation.md)
- [docs/maintenance-and-security-roadmap.md](./docs/maintenance-and-security-roadmap.md)
- [docs/phase-16-security-plan.md](./docs/phase-16-security-plan.md)
- [docs/edgeintel-worker-threat-model.md](./docs/edgeintel-worker-threat-model.md)
- [docs/security-test-matrix.md](./docs/security-test-matrix.md)
- [docs/supply-chain-review.md](./docs/supply-chain-review.md)
- [docs/residual-risk-register.md](./docs/residual-risk-register.md)

The repo wiki Home page is now available in the GitHub wiki and should become
the canonical operator/setup guide as later phases land.
