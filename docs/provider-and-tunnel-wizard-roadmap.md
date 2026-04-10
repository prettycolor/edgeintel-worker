# Provider And Tunnel Wizard Roadmap

This document defines the product architecture required to make EdgeIntel feel
like a 5-minute setup instead of an operator-only project.

## What Is Factually True Today

Implemented now:

- Hosted inference routing exists through `hosted`.
- Self-hosted inference routing exists through `local-direct` and `local-gateway`.
- Tunnel-backed local models are supported as an architecture when exposed over HTTPS.
- Access service token headers are supported for the local-model path.
- `GET /api/inference/capabilities` exposes the configured inference routes.
- `POST /api/scans/:scanRunId/ai-brief` exercises the configured route against grounded scan data.

Not implemented yet:

- user-facing provider settings UI
- API key management UI
- provider OAuth onboarding
- automatic Cloudflare Tunnel creation from the app
- local-machine installation or startup of `cloudflared`
- connection testing and ongoing connector health

## Hard Platform Boundary

The Worker can automate Cloudflare's control plane, but it cannot directly:

- install software on the user's machine
- start `cloudflared` on the user's machine
- inspect arbitrary localhost ports from the browser
- keep a long-running OS service alive on the user's machine

That means a true "never touch CLI" onboarding flow requires two systems:

1. EdgeIntel control plane in Cloudflare
2. a local companion component on the user's machine

Without the local companion, the best we can do is:

- create the Tunnel remotely
- generate the token and hostname config
- provide copy-paste commands

That is better than manual setup, but it is not a seamless 5-minute flow.

## Recommended Product Direction

Build a two-part onboarding architecture:

- **Cloudflare control plane**
  - Worker APIs
  - D1 persistence
  - encrypted provider settings
  - OAuth callbacks
  - Tunnel orchestration
  - Access policy orchestration
  - health checks
- **EdgeIntel Connector**
  - small desktop or tray agent
  - installs or updates `cloudflared`
  - validates the local LLM URL and model path
  - runs the tunnel token locally
  - reports status back to EdgeIntel

This is the correct architecture if the goal is:

- no CLI for the user
- guided local-model onboarding
- recoverable tunnel lifecycle
- real ongoing health checks

## Why A Connector Is The Right Answer

If the user is in a browser-only wizard:

- the browser cannot install `cloudflared`
- the browser cannot launch a background daemon
- the browser cannot reliably probe protected localhost services across all environments

If the user installs a tiny local connector:

- setup can be mostly one-click
- port detection becomes reliable
- local model validation becomes reliable
- tunnel lifecycle can be automated
- updates and reconnect flows become possible

## Target User Experience

The target setup flow should be:

1. User opens EdgeIntel and clicks `Connect AI`.
2. User chooses `Hosted Provider` or `Local Model`.
3. Hosted flow:
   - choose provider
   - connect with API key or OAuth where supported
   - run connection test
   - save as active route
4. Local flow:
   - install EdgeIntel Connector if not present
   - choose local provider type (`Ollama`, `OpenAI-compatible`, `Custom`)
   - enter or detect local port
   - choose model
   - choose tunnel hostname
   - toggle Access protection
   - EdgeIntel creates the Cloudflare Tunnel, DNS record, and optional Access application
   - Connector installs and starts `cloudflared`
   - Connector validates the endpoint and reports health
5. User sees `Connected` and can immediately generate an AI brief or run an upgraded scan flow.

## Architecture

### 1. Provider settings service

Create a provider settings service in the Worker with:

- `GET /api/settings/providers`
- `POST /api/settings/providers`
- `PATCH /api/settings/providers/:id`
- `DELETE /api/settings/providers/:id`
- `POST /api/settings/providers/:id/test`

Recommended provider record shape:

- `id`
- `kind`
  - `hosted-api-key`
  - `hosted-oauth`
  - `local-direct`
  - `local-gateway`
- `providerCode`
  - `openai`
  - `anthropic`
  - `google-ai-studio`
  - `workers-ai`
  - `ollama`
  - `custom-openai-compatible`
- `displayName`
- `defaultModel`
- `baseUrl`
- `usesAiGateway`
- `oauthConnected`
- `status`
- `lastTestedAt`
- `lastTestResult`
- `encryptedSecretRef`
- `metadataJson`

### 2. Secret storage

Do not store raw provider secrets in plaintext in D1.

Recommended approach:

- store provider config metadata in D1
- encrypt API keys or service tokens before persistence
- use a Worker secret as the envelope master key
- decrypt only inside the Worker request path when making outbound calls

This is the simplest practical single-environment design for EdgeIntel.

### 3. Hosted provider onboarding

Support two modes:

- API key
- OAuth where the provider actually supports a usable delegated flow

Important product rule:

- API key entry is the universal path.
- OAuth is optional and provider-specific, not universal.

For frontier providers, the likely practical default is:

- OpenAI: API key
- Anthropic: API key
- Google AI / Vertex: API key, OAuth, or service account style flows depending on the exact product
- Workers AI: no third-party OAuth needed

### 4. Tunnel orchestration service

Create a tunnel orchestration service in the Worker that can:

- create remotely-managed tunnels through the Cloudflare API
- fetch or rotate tunnel tokens
- write remote ingress configuration
- create the required DNS CNAME pointing to `<tunnel-id>.cfargotunnel.com`
- optionally provision Access protection and service tokens

Recommended API surface:

- `POST /api/tunnels`
- `GET /api/tunnels/:id`
- `POST /api/tunnels/:id/test`
- `POST /api/tunnels/:id/rotate-token`
- `PATCH /api/tunnels/:id`
- `DELETE /api/tunnels/:id`

Recommended stored tunnel record:

- `id`
- `providerSettingId`
- `cloudflareTunnelId`
- `cloudflareTunnelName`
- `publicHostname`
- `localServiceUrl`
- `accessProtected`
- `connectorStatus`
- `lastConnectorHeartbeatAt`
- `lastTunnelHealthAt`
- `status`
- `metadataJson`

### 5. EdgeIntel Connector

This is the missing piece for true no-CLI onboarding.

The connector should be a small local app or service with responsibilities:

- detect whether `cloudflared` is installed
- install or upgrade `cloudflared` when needed
- validate the configured local URL and port
- validate the selected model endpoint
- run `cloudflared service install <token>` or equivalent platform-specific launch flow
- send health and version heartbeats back to EdgeIntel
- expose local status in a simple machine-readable format

Recommended first release:

- macOS-focused
- lightweight desktop app or signed command agent
- pairing code flow from the wizard

### 6. Wizard UI

The wizard should not be a generic settings form. It should be a decision-driven onboarding system.

Suggested steps:

#### Step 1: Choose AI mode

- Hosted frontier model
- Local model on my machine
- Hybrid

#### Step 2: Choose provider

Hosted:

- OpenAI
- Anthropic
- Google
- Workers AI
- Custom OpenAI-compatible

Local:

- Ollama
- OpenAI-compatible server
- Custom endpoint

#### Step 3: Connection method

Hosted:

- API key
- OAuth if supported

Local:

- Auto-detect with Connector
- Manual port entry

#### Step 4: Configuration

Hosted:

- base URL if custom
- default model
- AI Gateway toggle

Local:

- local URL/port
- model name
- tunnel hostname
- Access protection on/off

#### Step 5: Verification

Run:

- local endpoint probe
- tunnel creation probe
- DNS readiness check
- Access credential validation
- inference test call

#### Step 6: Finish

Display:

- active route
- provider health
- tunnel hostname
- next recommended actions

## Connection test endpoint

Add a dedicated endpoint for connection testing so onboarding can fail safely before the user hits the main app.

Recommended API:

- `POST /api/settings/providers/:id/test`

Test result should include:

- network reachability
- TLS validity
- auth success
- model availability
- latency
- normalized error reason

For local models, the test flow should distinguish:

- connector missing
- connector offline
- local port unreachable
- tunnel not running
- Access denied
- model not found
- endpoint not OpenAI-compatible

## Wizard Quality Bar

To feel top-tier, the wizard should include:

- resumable setup state
- optimistic progress UI with real statuses
- inline diagnostics, not generic error toasts
- generated next-step help for each failure state
- one-click copy for advanced users
- downloadable fallback installer only when auto-flow is unavailable
- clear separation between provider config and active runtime route

## Recommended New Phases

### Phase 7A: Provider control plane

Deliver:

- provider settings D1 schema
- encrypted secret storage
- provider CRUD APIs
- connection test endpoint

### Phase 7B: Hosted provider onboarding UI

Deliver:

- settings UI
- API key forms
- optional OAuth routes where supported
- provider health views

### Phase 7C: Tunnel orchestration backend

Deliver:

- Cloudflare Tunnel create/update/delete APIs
- DNS orchestration
- Access application and service token orchestration
- tunnel status persistence

### Phase 7D: EdgeIntel Connector

Deliver:

- local pairing flow
- cloudflared installation/startup
- local endpoint validation
- connector heartbeat

### Phase 7E: Local model wizard

Deliver:

- multi-step tunnel wizard
- local detection or manual port entry
- one-click tunnel setup
- ongoing health/readiness UI

### Phase 7F: Documentation and public wiki

Deliver:

- setup docs
- screenshots
- troubleshooting matrix
- hosted vs local setup comparison
- architecture page

## Most Important Product Decision

If the goal is "any user can connect in 5 minutes without touching the CLI," then
we should explicitly commit to building the local connector.

Without that connector, EdgeIntel can be highly automated, but not truly seamless.

With that connector, the onboarding experience can be legitimately differentiated.
