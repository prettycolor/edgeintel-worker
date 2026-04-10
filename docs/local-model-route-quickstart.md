# Local Model Route Quickstart

This is the fastest path to connect a local Ollama, Gemma, or OpenAI-compatible
endpoint into EdgeIntel through Cloudflare.

## What You Need

- a running EdgeIntel Worker deployment
- a Cloudflare API token with Tunnel, DNS, and Access permissions
- a Cloudflare account ID
- either:
  - a default `CLOUDFLARE_ZONE_ID`, or
  - a zone ID you will enter in the tunnel wizard
- a local model endpoint such as:
  - `http://localhost:11434` for Ollama
  - another OpenAI-compatible local URL
- `cloudflared` installed on the machine that hosts the local model

## 5-Minute Flow

1. Open `/app/providers` and create the provider record.

Recommended settings for a local Ollama route:

- `kind`: `local-direct`
- `providerCode`: `ollama`
- `baseUrl`: the eventual public HTTPS hostname if you already know it, or leave it empty for now
- `defaultModel`: your local model name

2. Open `/app/tunnels`.

3. Create the route.

Fill:

- linked provider
- Cloudflare zone
- public hostname
- local service URL
- optional tunnel name
- whether Access service-token protection should be enabled

The tunnel workspace now auto-discovers available Cloudflare zones from the API
token and validates the hostname inline. In the common case, the operator can
leave the zone selector on auto-match and let EdgeIntel pick the best suffix
match before provisioning.

4. Save the route.

That triggers:

- remote Tunnel creation
- proxied DNS CNAME creation to `<tunnel-id>.cfargotunnel.com`
- optional Access reusable policy creation
- optional Access service token creation
- optional Access self-hosted application creation

5. Run the connector.

Create a one-time pairing from the tunnel workspace, then run the connector
with the pairing ID and token instead of a raw tunnel ID.

Reference flow:

```bash
export EDGEINTEL_API_BASE="https://your-edgeintel-worker.example.com"
export EDGEINTEL_PAIRING_ID="replace-with-pairing-id"
export EDGEINTEL_PAIRING_TOKEN="replace-with-one-time-pairing-token"
node packages/connector-core/src/edgeintel-connector.mjs
```

The connector will:

- exchange the one-time pairing for scoped bootstrap plus a connector bearer token
- verify `cloudflared`
- probe the local model URL
- launch `cloudflared tunnel run --token ...`
- send authenticated heartbeats back to EdgeIntel

6. Run a route test.

Use the tunnel workspace `Run test` action. EdgeIntel will:

- check Tunnel control-plane health
- inspect current Cloudflare connection state
- probe the public hostname
- persist the result on the tunnel record
- compare failures against the last known good test when one exists

## What The Wizard Actually Proves

When this path is green, the system proves:

- the Cloudflare control plane is configured correctly
- the public hostname is routed correctly
- optional Access protection is working
- the local machine is running the connector
- the local model surface is reachable through the tunnel

## Recommended Operator Pattern

- keep provider onboarding in `/app/providers`
- keep public route orchestration in `/app/tunnels`
- use `Run test` after every route or token change
- treat the connector heartbeat as the source of truth for machine-side status
- create a fresh pairing after any bootstrap rotation
- use the observability panel to spot connector version drift and failure deltas quickly

## Follow-On Docs

- [Hybrid inference](./hybrid-inference.md)
- [Provider and tunnel roadmap](./provider-and-tunnel-wizard-roadmap.md)
- [Connector README](../packages/connector-core/README.md)
