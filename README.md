# EdgeIntel Worker

Cloudflare-native domain posture and remediation engine for the `hostingtool.dev` / `hostinginfo.gg` environment.

## What This Implements

- `POST /api/scan` to create a bounded public-domain scan job
- Durable Object job coordination with job snapshots and event streaming
- Workflow-driven orchestration that fans out stateless scan work through Cloudflare Queues
- Public web posture collection across:
  - DoH-based DNS
  - HTTP/HTTPS response and redirect analysis
  - provider attribution and surface detection
  - findings and Cloudflare recommendation generation
- Artifact generation into R2, with Browser Rendering REST support when configured
- Export generation for:
  - Markdown reports
  - JSON findings bundles
  - Terraform drafts
  - Cloudflare API payload drafts

## Layout

- `src/index.ts`
  Worker entrypoint and HTTP API
- `src/durable-objects/job-coordinator.ts`
  Per-job state and event history
- `src/workflows/scan-workflow.ts`
  Durable orchestration and queue fan-out
- `src/lib/`
  scanning, findings, recommendations, artifacts, persistence, exports
- `migrations/0001_initial.sql`
  D1 schema

## Setup

```bash
cd edgeintel-worker
npm install
npx wrangler d1 migrations apply edgeintel --local
npm run dev
```

Remote Browser Rendering is optional. If you want rendered markdown and screenshots from Cloudflare Browser Rendering REST, set:

- `BROWSER_RENDERING_REST_BASE_URL`
- `BROWSER_RENDERING_API_TOKEN`

AI Gateway is optional in this initial slice. The scaffold reserves:

- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_TOKEN`
- `AI_GATEWAY_MODEL`
- `AI_GATEWAY_PROVIDER`

## Ollama / Gemma4

Deployed Workers cannot call `localhost` or private RFC1918 addresses. If you want Ollama or Gemma4 in the production architecture, expose it through a controlled HTTPS endpoint, ideally behind Cloudflare Tunnel, and route it as a provider behind AI Gateway or a dedicated gateway service.

## Current Scope

This is the phase-0/1 implementation slice:

- real scan orchestration
- real DNS + HTTP posture collection
- real findings and recommendation generation
- real export generation
- bounded artifact generation

What is intentionally not here yet:

- automatic Cloudflare zone mutation
- private-network or raw port probing
- deep authenticated crawl flows
- advanced AI-generated summaries as a hard dependency
