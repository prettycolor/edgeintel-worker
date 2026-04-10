# Residual Risk Register

## R1. No explicit rate limiting on pairing exchange or heartbeat

- **Impact:** medium
- **Likelihood:** medium
- **Why it remains:** the token model is strong, but repeated requests could
  still create noise or operational churn.
- **Recommended next step:** add Cloudflare rate limiting or lightweight
  per-route throttling for `/api/pairings/:id/exchange` and
  `/api/tunnels/:id/heartbeat`.

## R2. Cloudflare API token remains a high-value control-plane secret

- **Impact:** high
- **Likelihood:** medium
- **Why it remains:** least-privilege scope and rotation are deployment
  concerns, not fully enforced in code.
- **Recommended next step:** document the exact minimum API scopes and add a
  startup diagnostics panel for token-readiness and scope expectations.

## R3. Desktop release trust is not production-final yet

- **Impact:** high
- **Likelihood:** medium
- **Why it remains:** notarization, signing, and public release workflows are
  not the current priority and are not finished.
- **Recommended next step:** complete the packaging/signing/notarization track
  before any public desktop distribution.

## R4. Local model route exposure depends on operator tunnel posture

- **Impact:** high
- **Likelihood:** medium
- **Why it remains:** EdgeIntel can provision Access-protected routes, but
  incorrect operator choices could still weaken the exposed model route.
- **Recommended next step:** add stronger UI guardrails that warn on
  non-Access-protected public hostnames for local-model providers.

## R5. MCP is now implemented, but deployed OAuth and abuse hardening still need a deeper pass

- **Impact:** critical
- **Likelihood:** medium
- **Why it remains:** the current MCP surface is correctly bounded, but it now
  exists as a live remote interface with OAuth, dynamic registration, and
  scope-bearing tokens. That raises the bar for deployed negative testing and
  observability.
- **Recommended next step:** run a deployed MCP hardening pass against
  authorize/token/register flows, add abuse-rate instrumentation, and add a
  live Inspector-based acceptance harness to the release checklist.

## R6. Desktop packaging dependencies still need deeper triage

- **Impact:** medium
- **Likelihood:** medium
- **Why it remains:** `npm audit` currently reports high-severity issues in the
  Electron Forge packaging chain, primarily through transitive `tar` and `tmp`
  dependencies.
- **Recommended next step:** isolate the exact reachable desktop build/runtime
  paths, then upgrade or replace the affected packaging dependencies without a
  blind `audit fix --force`.
