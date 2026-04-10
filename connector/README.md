# EdgeIntel Connector

The Worker can provision the Cloudflare side of a local-model route, but a local
process still has to run `cloudflared` and report health from the machine that
hosts the model.

This folder contains the first reference connector:

- `edgeintel-connector.mjs`

It is intentionally simple:

- loads the tunnel bootstrap from the Worker API
- checks that `cloudflared` is installed
- probes the local model URL
- runs `cloudflared tunnel run --token ...`
- sends heartbeat updates back to `POST /api/tunnels/:id/heartbeat`

## Why This Exists

This is the thin machine-side layer that makes the app-shell wizard honest.
Without a connector, EdgeIntel can automate Tunnel, DNS, and Access, but it
cannot install or supervise a process on the user's machine.

The reference connector is the bridge between:

- today's operator-friendly tunnel wizard
- tomorrow's packaged desktop or tray app

## Quick Start

```bash
export EDGEINTEL_API_BASE="https://your-edgeintel-worker.example.com"
export EDGEINTEL_TUNNEL_ID="replace-with-tunnel-record-id"

node connector/edgeintel-connector.mjs --once
```

That will:

- fetch the tunnel bootstrap from `/api/tunnels/:id`
- verify `cloudflared` is available
- probe the configured local service
- send one connector heartbeat

To run continuously:

```bash
node connector/edgeintel-connector.mjs
```

## CLI Flags

- `--api-base`
  EdgeIntel base URL. Equivalent to `EDGEINTEL_API_BASE`.
- `--tunnel-id`
  Tunnel record ID from EdgeIntel. Equivalent to `EDGEINTEL_TUNNEL_ID`.
- `--cloudflared-bin`
  Optional path to the `cloudflared` binary. Equivalent to `EDGEINTEL_CLOUDFLARED_BIN`.
- `--once`
  Run one bootstrap + heartbeat cycle and exit.
- `--dry-run`
  Load the bootstrap, probe the local URL, emit the connector payload, and exit
  without launching `cloudflared`.

## Packaging Direction

This script is not the final UX. It is the reference runtime that can later be
wrapped by:

- a small desktop app
- a tray agent
- an Electron or Tauri onboarding shell
- a signed service installer

The API contract is already the important part:

- `GET /api/tunnels/:id`
- `POST /api/tunnels/:id/heartbeat`
- `POST /api/tunnels/:id/test`
- `POST /api/tunnels/:id/rotate-token`
