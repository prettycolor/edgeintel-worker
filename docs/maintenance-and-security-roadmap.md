# Maintenance And Security Roadmap

This is the post-build hardening roadmap for keeping EdgeIntel current and
defensible.

It is intentionally written as a roadmap, not a false claim that the system is
already fully hardened.

## Maintenance Baseline

### What should run automatically

- GitHub Actions verify on push and pull request
- a scheduled weekly verify run
- Dependabot updates for npm dependencies
- Dependabot updates for GitHub Actions

These are now part of the repository baseline.

## Next Maintenance Layer

Add these after the release layer is stable:

1. **Deployed smoke tests**
   Hit the deployed Worker on a schedule and confirm:
   - scan creation works
   - job polling works
   - commercial brief works
   - exports work

2. **Release canary**
   Deploy to a staging hostname before promoting production.

3. **Observability alerts**
   Add alerting for:
   - queue backlogs
   - failing tunnel tests
   - connector heartbeat gaps
   - repeated Worker exceptions

4. **Dependency policy**
   Prefer pinned or tightly bounded versions for high-risk runtime packages and
   review lockfile diffs carefully.

## Security Audit Plan

EdgeIntel still needs a dedicated security audit. That audit should produce
evidence, not just a narrative.

### Required workstreams

1. **Threat model**
   - Worker API
   - Access-protected operator routes
   - desktop connector
   - local-model route exposure
   - future MCP surface

2. **Supply-chain review**
   - runtime dependencies
   - Electron packaging dependencies
   - update mechanism
   - `cloudflared` download and checksum path

3. **Secret-handling audit**
   - Worker secret envelope storage
   - connector local storage and Keychain posture
   - pairing flow
   - token rotation behavior

4. **Auth and authorization audit**
   - Access JWT validation
   - connector bearer sessions
   - tunnel mutation boundaries
   - provider secret access boundaries

5. **Input-validation audit**
   - domain normalization
   - hostname validation
   - provider settings input
   - tunnel settings input

6. **Desktop-local boundary audit**
   - local process management
   - shell/exec safety
   - updater trust path
   - local endpoint assumptions

## Security Test Program

Do not call EdgeIntel "secure" until a suite-backed test program exists.

### Required test classes

- unit tests for auth, token parsing, and secret handling
- negative tests for malformed headers, missing JWTs, and expired connector tokens
- API tests for unauthorized mutation attempts
- tunnel pairing replay tests
- connector process-management failure tests
- dependency and supply-chain scanning
- end-to-end tests for Access-protected operator routes
- future MCP-specific auth and tool-approval tests

## MCP-Specific Security Gate

If EdgeIntel gets its own MCP server, require a separate security gate before
release:

- read-only tools first
- authenticated remote MCP only
- tool-by-tool authorization review
- explicit human confirmation for mutation
- no exposure of secret-bearing routes as general MCP tools
- dedicated MCP threat model and negative test suite

## High-Confidence Rule

Do not implement a security-sensitive addition on assumption.

If the team is not 100% confident in:

- the Cloudflare product behavior
- the MCP security posture
- the desktop connector boundary
- the dependency update risk

then stop and do targeted research before implementation.
