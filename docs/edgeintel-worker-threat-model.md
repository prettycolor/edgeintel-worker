# EdgeIntel Threat Model

## Scope

This threat model covers the production code in:

- `apps/worker`
- `apps/desktop-connector`
- `packages/connector-core`
- `packages/shared-contracts`

It is grounded in the current private-app deployment model described in
`README.md` and the current security hardening in:

- `apps/worker/src/lib/auth.ts`
- `apps/worker/src/lib/route-auth.ts`
- `apps/worker/src/lib/secrets.ts`
- `apps/worker/src/lib/connector-input.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/lib/tunnels.ts`
- `apps/desktop-connector/src/main/connector-service.ts`
- `apps/desktop-connector/src/main/cloudflared.ts`
- `apps/desktop-connector/src/main/store.ts`

Out of scope:

- public package publishing
- release notarization/signing
- production Cloudflare account policy hygiene outside the repo
- any future MCP server implementation

## System Model

### Primary components

- **Worker API and app shell**
  Serves the operator app, scan APIs, provider settings, tunnel orchestration,
  pairing issuance, scan history, exports, and AI brief generation.
- **Cloudflare Access gate**
  Protects the private operator-facing routes by validating
  `Cf-Access-Jwt-Assertion`.
- **D1 and R2**
  Persist scan results, encrypted provider/tunnel secrets, pairing state,
  tunnel event history, test runs, and exports.
- **Desktop connector**
  Exchanges one-time pairing secrets for scoped tunnel bootstrap, installs and
  runs `cloudflared`, probes the local model route, and sends authenticated
  heartbeats.
- **Cloudflare control plane**
  Provisions tunnels, DNS records, Access apps/policies/service tokens, and
  validates zone/hostname choices.

### Trust boundaries

1. **Internet client -> Worker**
   Boundary for every `/api/*` request and `/app*` route.
2. **Operator browser -> Access-protected Worker routes**
   Boundary enforced by Cloudflare Access JWT validation.
3. **Unauthenticated connector pairing exchange -> Worker**
   Narrow boundary intentionally left open for one-time token exchange only.
4. **Authenticated connector heartbeat -> Worker**
   Narrow machine-to-worker channel using pairing-bound bearer tokens.
5. **Worker -> D1 / R2**
   Internal persistence boundary for secrets, posture data, and artifacts.
6. **Worker -> Cloudflare control plane**
   High-value orchestration boundary using `CLOUDFLARE_API_TOKEN`.
7. **Desktop connector -> local machine**
   Boundary for local secret storage, process execution, and local service
   probing.
8. **Desktop connector -> GitHub release download**
   Supply-chain boundary for managed `cloudflared` installation.

## High-Value Assets

- Cloudflare API token and account ID
- Access team domain and audience configuration
- provider secrets and tunnel bootstrap secrets
- pairing tokens and connector bearer tokens
- scan history, exports, commercial briefs, and AI briefs
- local model route hostname and Access headers
- managed `cloudflared` binary and desktop auto-update path

## Attacker Model

### Realistic capabilities

- Internet attacker with no prior access
- attacker with visibility of public hostname or domain targets
- attacker able to send crafted JSON payloads to exposed endpoints
- attacker attempting pairing replay or connector token misuse
- attacker attempting data access through unauthenticated API routes
- local attacker on the same machine reading desktop state files
- supply-chain attacker attempting tampered binary or dependency delivery

### Non-capabilities assumed here

- compromise of Cloudflare’s Access signing infrastructure
- compromise of GitHub’s release infrastructure and Cloudflare’s release notes
  simultaneously
- attacker with shell access to the operator workstation

## Prioritized Threats

### T1. Unauthenticated access to operator APIs or scan data

- **Assets impacted:** scan results, exports, AI briefs, tunnel/provider config
- **Likelihood:** high without controls
- **Impact:** high
- **Priority:** high
- **Current mitigation:** Worker now treats `/app*` and `/api/*` as private by
  default via `apps/worker/src/lib/route-auth.ts`; only `/health`,
  `/api/pairings/:id/exchange`, and `/api/tunnels/:id/heartbeat` remain
  intentionally unauthenticated.
- **Residual risk:** Access policy misconfiguration outside the repo would still
  expose protected routes.

### T2. Pairing replay or connector token misuse

- **Assets impacted:** scoped tunnel bootstrap, connector session
- **Likelihood:** medium
- **Impact:** high
- **Priority:** high
- **Current mitigation:** opaque tokens are random, hashed with SHA-256, and
  compared using `timingSafeEqual`; stale pairings expire on read; pairing
  exchange activates only pending sessions and revokes other active pairings for
  the same tunnel.
- **Residual risk:** there is no explicit rate limiting on pairing exchange or
  heartbeat endpoints.

### T3. Secret leakage from provider or tunnel configuration flows

- **Assets impacted:** API keys, Access service tokens, tunnel token
- **Likelihood:** medium
- **Impact:** high
- **Priority:** high
- **Current mitigation:** provider and tunnel secrets are encrypted with
  AES-GCM envelopes in `apps/worker/src/lib/secrets.ts`; serialized control
  plane views omit ciphertext; connector local secrets are encrypted via
  Electron `safeStorage`.
- **Residual risk:** if `PROVIDER_SECRET_ENCRYPTION_KEY` is mishandled at
  deployment time, the Worker cannot protect stored secrets.

### T4. Connector-controlled payload abuse against logs or tunnel metadata

- **Assets impacted:** operational logs, tunnel metadata integrity
- **Likelihood:** medium
- **Impact:** medium
- **Priority:** medium
- **Current mitigation:** heartbeat and pairing payloads now pass through
  `apps/worker/src/lib/connector-input.ts`, which validates enum values,
  normalizes whitespace, strips multiline log injection, and limits field
  lengths.
- **Residual risk:** connector status and note volume are still not rate-limited.

### T5. Abuse of Cloudflare control-plane mutation privileges

- **Assets impacted:** tunnels, DNS routes, Access apps/policies/tokens
- **Likelihood:** medium
- **Impact:** high
- **Priority:** high
- **Current mitigation:** only Access-authenticated operator routes can create,
  mutate, or delete provider/tunnel state; hostname validation preflights DNS
  conflicts before provisioning.
- **Residual risk:** the Cloudflare API token is still a powerful credential and
  should remain least-privilege and rotation-managed outside the repo.

### T6. Desktop connector process-execution or binary provenance compromise

- **Assets impacted:** operator workstation, local model route, connector trust
- **Likelihood:** medium
- **Impact:** high
- **Priority:** high
- **Current mitigation:** connector runtime uses `spawn()` with argument arrays,
  not shell execution; managed `cloudflared` installs verify SHA-256 against the
  published release notes before extraction; secrets are stored separately from
  plain state.
- **Residual risk:** desktop notarization/signing and hardened release
  distribution are not complete in this repo yet.

### T7. Future MCP surface becoming an oversized remote-admin interface

- **Assets impacted:** Cloudflare account resources, secrets, scans, customer
  data, local routes
- **Likelihood:** high if implemented loosely
- **Impact:** critical
- **Priority:** critical
- **Current mitigation:** no MCP server is implemented yet, and the approved
  Phase 17 plan keeps the first MCP surface bounded to authenticated,
  scope-checked tools with secret-bearing routes excluded.
- **Residual risk:** the implementation phase still needs a dedicated MCP
  negative test suite and release gate before the server can ship.

## Existing Mitigations Present In Code

- Access JWT verification with issuer/audience validation in
  `apps/worker/src/lib/auth.ts`
- private-by-default route protection in
  `apps/worker/src/lib/route-auth.ts`
- AES-GCM secret envelope encryption in
  `apps/worker/src/lib/secrets.ts`
- hashed one-time pairing and connector bearer tokens in
  `apps/worker/src/lib/pairings.ts`
- connector payload validation in
  `apps/worker/src/lib/connector-input.ts`
- rejection of credential-bearing `localServiceUrl` values in
  `apps/worker/src/lib/tunnels.ts`
- checksum-verified `cloudflared` installs in
  `apps/desktop-connector/src/main/cloudflared.ts`
- `spawn()`-based runtime launch in
  `apps/desktop-connector/src/main/connector-service.ts`

## Assumptions That Most Affect Risk

- EdgeIntel remains a private operator app behind Cloudflare Access.
- Operators use a least-privilege Cloudflare API token.
- The desktop connector runs on a trusted operator-owned macOS machine.
- The local-model route is intentionally exposed through Tunnel/Access, not
  directly to the public internet.

## Exit Decision For MCP

**Decision:** approve MCP for the next implementation phase.

Reason:

- EdgeIntel is now in a safer position for HTTP/app-shell/operator usage, and
  the dedicated Phase 17 plan now defines the tool scoping, auth model, and
  non-negotiable exclusions needed to build MCP correctly.
- The next move is a bounded implementation phase, not generic additional
  evaluation.
- The MCP release gate still requires tool-specific authorization tests and a
  dedicated negative suite before shipping.
