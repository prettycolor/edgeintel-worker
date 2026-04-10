# EdgeIntel Desktop Connector

The desktop connector is the macOS companion app for EdgeIntel.

It exists because the Worker can provision Cloudflare-side state, but it cannot:

- install `cloudflared` on a machine
- keep a local `cloudflared` process alive
- store tunnel bootstrap secrets on-device
- probe a localhost model route from the machine that hosts it

This package now handles those machine-local responsibilities directly.

## What It Does

- accepts a one-time EdgeIntel pairing ID and pairing token
- exchanges that pairing for a scoped tunnel bootstrap and connector bearer token
- stores local secrets with Electron `safeStorage`
- detects an existing `cloudflared` binary or installs a managed copy
- verifies the official GitHub release checksum before install
- probes the configured local service URL
- starts and stops `cloudflared tunnel run --token ...`
- reports connector heartbeats back to the EdgeIntel Worker

## Commands

```bash
npm run dev --workspace @edgeintel/desktop-connector
npm run test --workspace @edgeintel/desktop-connector
npm run package --workspace @edgeintel/desktop-connector
```

## Current Scope

This is intentionally macOS-only for the current wave.

The app is designed to be:

- a tray/window companion
- a no-CLI local-model onboarding path
- the foundation for future auto-update, packaging polish, and richer observability
