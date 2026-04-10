# Why Workers, Why Cloudflare

This is the canonical architecture explanation for EdgeIntel.

## Core Thesis

EdgeIntel belongs on Cloudflare because it is fundamentally about:

- DNS delegation
- public request handling
- CDN and WAF presence
- TLS and header posture
- edge-to-origin separation
- Tunnel and Access orchestration

Workers is not just where the code runs. It is the control-plane substrate that keeps the product close to the same systems it is reasoning about.

## Product Mapping

- **Workers**
  Main API surface, operator app delivery, provider control plane, tunnel orchestration, and commercial brief output.

- **Durable Objects**
  Authoritative per-job coordination and scan event flow.

- **Queues + Workflows**
  Durable orchestration for scans and artifact generation.

- **D1**
  Jobs, runs, findings, recommendations, provider settings, tunnel records, pairings, and observability history.

- **R2**
  Artifacts, reports, screenshots, manifests, and exports.

- **Browser Rendering**
  JS-aware page evidence instead of pretending raw HTML alone tells the story.

- **AI Gateway / Workers AI / external providers**
  Optional inference for grounded briefs without making AI the system of record.

- **Cloudflare Tunnel + Access**
  Secure exposure of self-hosted model endpoints and connector-managed local infrastructure.

## Why A Desktop Connector Exists

The Worker can automate Cloudflare's control plane, but it cannot:

- install `cloudflared` on the operator's machine
- keep a long-running local daemon alive
- safely own machine-local secrets and runtime lifecycle

That is why EdgeIntel has a macOS connector. It is the correct split between cloud control plane and machine-local runtime.

## Why The Commercial Brief Matters

A scan engine alone is not enough for a senior Cloudflare interview story.

The commercial brief turns raw posture evidence into:

- Cloudflare fit
- access-hardening posture
- origin exposure story
- latency and resilience opportunity
- ranked expansion motions
