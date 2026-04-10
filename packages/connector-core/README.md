# EdgeIntel Connector Core

The Worker can provision the Cloudflare side of a local-model route, but a local
process still has to run `cloudflared` and report health from the machine that
hosts the model.

This package contains the current reference runtime:

- `src/index.ts` shared pairing/probe/heartbeat helpers
- `src/edgeintel-connector.ts` CLI entrypoint

It is intentionally simple:

- exchanges a one-time pairing for scoped tunnel bootstrap
- checks that `cloudflared` is installed
- probes the local model URL
- runs `cloudflared tunnel run --token ...`
- sends authenticated heartbeat updates back to `POST /api/tunnels/:id/heartbeat`

## Why This Exists

This is the thin machine-side layer that makes the tunnel wizard honest.
Without a connector, EdgeIntel can automate Tunnel, DNS, and Access, but it
cannot install or supervise a process on the user's machine.

The reference connector is the bridge between:

- today's Worker-native tunnel control plane
- tomorrow's packaged desktop and tray app

## Quick Start

```bash
export EDGEINTEL_API_BASE="https://your-edgeintel-worker.example.com"
export EDGEINTEL_PAIRING_ID="replace-with-pairing-id"
export EDGEINTEL_PAIRING_TOKEN="replace-with-one-time-pairing-token"

npm run connector:once
```

That will:

- exchange the pairing at `/api/pairings/:id/exchange`
- verify `cloudflared` is available
- probe the configured local service
- send one authenticated connector heartbeat

To run continuously:

```bash
npx tsx packages/connector-core/src/edgeintel-connector.ts
```

## Packaging Direction

This script is no longer the only local connector path. It now shares its core
logic with the macOS desktop app so the CLI and packaged connector stay aligned.
