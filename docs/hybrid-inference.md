# Hybrid Inference Setup

This document is written to be copied into a public GitHub wiki with minimal editing.

## Goal

EdgeIntel should support both:

- hosted models through Cloudflare AI Gateway
- self-hosted local models such as Ollama + Gemma, exposed safely over HTTPS

The local-model path exists so advanced operators can use their own hardware and RAG stack instead of relying only on paid API traffic.

## Supported routes

EdgeIntel exposes these inference routes:

- `hosted`
  - uses AI Gateway through the Workers AI binding when `AI_GATEWAY_ID` is configured
  - falls back to direct AI Gateway HTTPS when `AI_GATEWAY_BASE_URL` is configured
- `local-direct`
  - uses an HTTPS OpenAI-compatible endpoint directly
  - intended for Ollama or similar systems behind Cloudflare Tunnel
- `local-gateway`
  - sends a self-hosted model through AI Gateway after that upstream is configured there

You can inspect the active configuration at:

- `GET /api/inference/capabilities`

## What EdgeIntel generates

The first AI feature is intentionally bounded:

- `POST /api/scans/:scanRunId/ai-brief`

This route only uses persisted scan material:

- run summary
- module statuses
- findings
- recommendations
- artifact metadata

It does not stream raw HTML or uncontrolled crawl content into the model.

## Recommended architecture

### Best general-purpose production path

Use this when you want strong observability and easy provider switching:

1. Route hosted providers through AI Gateway.
2. Expose self-hosted Ollama over HTTPS through Cloudflare Tunnel.
3. Protect the Ollama hostname with Cloudflare Access service credentials if it should not be public.
4. Use `local-direct` first for the self-hosted path because it is the simplest to validate.
5. Add `local-gateway` later if you want AI Gateway analytics, routing, and a unified provider control plane for the self-hosted model.

### Why this order is recommended

- `local-direct` proves the local model works end to end.
- Tunnel and Access create a production-safe boundary between the deployed Worker and the local machine.
- AI Gateway can be layered on after that without conflating transport issues with model issues.

## Quick start: hosted provider

Set these values in your Worker environment:

```bash
AI_GATEWAY_ID=
AI_GATEWAY_BASE_URL=
AI_GATEWAY_PROVIDER=workers-ai
AI_GATEWAY_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
AI_UPSTREAM_API_KEY=
AI_INFERENCE_DEFAULT_ROUTE=hosted
```

Guidance:

- Prefer `AI_GATEWAY_ID` when using the Workers AI binding path.
- Use `AI_GATEWAY_BASE_URL` when you want the HTTPS endpoint path instead.
- When using `AI_GATEWAY_BASE_URL`, point it at the exact provider or route base
  that EdgeIntel should call before `/chat/completions`.
- Set `AI_UPSTREAM_API_KEY` when the upstream provider requires a key and AI Gateway is not already handling provider auth for you.

## Quick start: local Ollama or Gemma through Tunnel

### Step 1: run the model locally

Run Ollama locally with the model you want to expose, for example a Gemma-family model.

Confirm the local model serves an OpenAI-compatible chat endpoint before involving Cloudflare.

### Step 2: expose Ollama through Cloudflare Tunnel

Create a Tunnel that forwards a public HTTPS hostname to the local Ollama port.

Example `cloudflared` ingress shape:

```yaml
tunnel: edgeintel-ollama
credentials-file: /path/to/edgeintel-ollama.json

ingress:
  - hostname: ollama.your-domain.com
    service: http://localhost:11434
  - service: http_status:404
```

The important design point is simple:

- the Worker talks to `https://ollama.your-domain.com`
- `cloudflared` handles the hop back to `localhost:11434`
- the deployed Worker never talks to `localhost` directly

### Step 3: optionally protect the hostname with Access

If the local model should not be open to the internet:

1. put the Tunnel hostname behind Cloudflare Access
2. create a service token
3. place the service token values in Worker secrets

EdgeIntel supports these headers automatically for `local-direct`:

- `CF-Access-Client-Id`
- `CF-Access-Client-Secret`

### Step 4: configure Worker secrets and vars

For direct self-hosted usage:

```bash
LOCAL_MODEL_GATEWAY_URL=https://ollama.your-domain.com
LOCAL_MODEL_MODEL=gemma3:12b
LOCAL_MODEL_API_KEY=ollama
LOCAL_MODEL_ACCESS_CLIENT_ID=
LOCAL_MODEL_ACCESS_CLIENT_SECRET=
AI_INFERENCE_DEFAULT_ROUTE=local-direct
```

Notes:

- `LOCAL_MODEL_GATEWAY_URL` must be HTTPS in deployed Worker use.
- `LOCAL_MODEL_API_KEY` is optional in some local stacks, but an OpenAI-compatible client often expects a bearer token. A simple placeholder such as `ollama` is fine when the upstream ignores it.
- If Access is enabled, set both Access secrets.

### Step 5: validate capabilities

After deploy, verify:

1. `GET /api/inference/capabilities`
2. confirm `local-direct` shows `available: true`
3. run `POST /api/scans/:scanRunId/ai-brief`

The generated brief is stored as an `ai-brief` artifact in R2 and indexed in D1.

## Quick start: self-hosted model through AI Gateway

Use this only after `local-direct` works.

Set:

```bash
AI_GATEWAY_ID=
AI_GATEWAY_BASE_URL=
LOCAL_MODEL_AI_GATEWAY_PROVIDER=ollama-local
LOCAL_MODEL_MODEL=gemma3:12b
LOCAL_MODEL_API_KEY=
AI_INFERENCE_DEFAULT_ROUTE=local-gateway
```

This route assumes the self-hosted provider is already modeled inside AI Gateway, for example through a custom provider or routed upstream.

## Route selection behavior

EdgeIntel resolves routes in this order:

1. request body override
2. `AI_INFERENCE_DEFAULT_ROUTE`
3. first available configured route

The request body for `POST /api/scans/:scanRunId/ai-brief` may include:

```json
{
  "route": "local-direct",
  "profile": "upgrade-planner",
  "model": "gemma3:27b",
  "instruction": "Prioritize the most compelling interview-ready recommendations."
}
```

## Prompt and grounding policy

EdgeIntel keeps AI bounded on purpose.

Included in the grounding payload:

- run metadata
- module statuses
- summarized findings
- summarized recommendations
- artifact metadata

Excluded from the grounding payload:

- raw HTML bodies
- unbounded crawl dumps
- opaque token-heavy artifacts

This keeps the AI layer explainable and prevents it from becoming the system of record.

## Recommended public wiki structure

If you mirror this into the GitHub wiki, use:

1. `Getting Started`
2. `Hosted AI Gateway Setup`
3. `Local Ollama Through Cloudflare Tunnel`
4. `Access Protection For Local Models`
5. `AI Brief API`
6. `Troubleshooting`

## Troubleshooting

### `local-direct` shows unavailable

Check:

- `LOCAL_MODEL_GATEWAY_URL` is set
- the URL is HTTPS
- the Tunnel hostname resolves publicly

### `ai-brief` returns 503

Check:

- the selected route is listed in `/api/inference/capabilities`
- the upstream model is reachable
- Access headers are present if the hostname is protected
- the configured model name matches what the upstream expects

### Hosted route is available but requests fail

Check:

- `AI_GATEWAY_ID` or `AI_GATEWAY_BASE_URL`
- provider and model names
- upstream provider auth if the route is BYOK

## Related repo files

- [`README.md`](../README.md)
- [`docs/implementation-phases.md`](./implementation-phases.md)
- [`src/lib/inference.ts`](../src/lib/inference.ts)
