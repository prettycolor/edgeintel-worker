# EdgeIntel Demo Script

This is the canonical 10-minute walkthrough for EdgeIntel.

## Demo Goals

Show that EdgeIntel is not just a domain scanner. It is a Cloudflare-native
control plane that can:

- scan a public web surface with bounded evidence collection
- explain posture in infrastructure terms
- map findings into Cloudflare product motions
- manage hosted and self-hosted AI provider routes
- orchestrate Cloudflare Tunnel plus Access for local model exposure

## Demo Prep

Do this before the meeting:

- choose the demo domains from
  [`docs/demo-domain-set.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/demo-domain-set.md)
- confirm the same domains still behave the way you expect on the day of the
  demo
- make sure at least one provider connection test is already green
- make sure the local-model tunnel path is already provisioned if you plan to
  show it
- pre-run one scan so you have a stable example if live internet conditions get
  noisy
- keep one live scan ready for the "real platform" story

## Best Demo Sequence

1. Start with the architecture in one sentence.
   "EdgeIntel is a Cloudflare-native domain posture and remediation platform built on Workers, Durable Objects, Queues, Workflows, D1, R2, Browser Rendering, Tunnel, Access, and a macOS connector."

2. Open the provider workspace.
   Show the provider catalog, explicit auth strategies, secret health, and connection testing.

3. Open the tunnel workspace.
   Show zone discovery, hostname validation, provisioning, Access protection, pairing, and runtime tests.

4. Run a scan.
   Use a controlled domain whenever possible and show progress, findings, artifacts, and recommendations.

5. Open the commercial brief.
   Show Cloudflare fit, access hardening, latency/resilience opportunity, origin exposure, and expansion candidates.

6. Generate an export.
   Show that the same persisted scan context feeds the operator, commercial, and implementation outputs.

## Recommended Narrative

Use this progression:

1. infrastructure evidence
2. Cloudflare-native control plane
3. commercial motion
4. local-model and connector differentiation
5. future MCP and AI workflow extensibility

## Suggested Live Commands

Run the Worker locally:

```bash
cd /Users/b.rad/Documents/GitHub/edgeintel-worker
nvm use
npm run dev
```

Trigger a scan:

```bash
curl -X POST http://127.0.0.1:8787/api/scan \
  -H "content-type: application/json" \
  -d '{"domain":"hostinginfo.gg"}'
```

Fetch the latest domain result:

```bash
curl http://127.0.0.1:8787/api/domains/hostinginfo.gg/latest
```

Fetch the commercial brief:

```bash
curl http://127.0.0.1:8787/api/scans/<scan-run-id>/commercial-brief
```

Fetch the commercial brief as Markdown:

```bash
curl "http://127.0.0.1:8787/api/scans/<scan-run-id>/commercial-brief?format=markdown"
```

Create a Markdown export:

```bash
curl -X POST http://127.0.0.1:8787/api/exports/<scan-run-id> \
  -H "content-type: application/json" \
  -d '{"format":"markdown"}'
```

## Demo Rules

- Prefer domains you control.
- If you use a prospect or third-party domain, verify it on the same day because posture can change.
- Never describe EdgeIntel as a vulnerability scanner.
- Keep the Tunnel and local-model path framed as optional but distinctive.
- If the UI is not yet driving a specific flow, use the API directly and say so
  plainly.
