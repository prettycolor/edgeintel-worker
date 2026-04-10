# Phase 16: Security, Threat Modeling, And Adversarial Test Suite

This is the next logical build phase for EdgeIntel.

It exists to keep security hardening separate from the product and release work
that is already complete.

## Goal

Produce evidence-backed confidence in EdgeIntel’s security posture instead of
relying on intuition, one-off code review, or narrative claims.

## Why This Is Phase 16

The current roadmap is functionally complete through the core product, release
layer, deployment runbooks, demo assets, and operator workflow documentation.

That means the correct next move is not more feature growth. The correct next
move is hardening.

## Scope

Phase 16 covers:

- Worker API threat model
- Access-protected operator routes
- provider secret handling
- tunnel orchestration and pairing flow
- desktop connector local-runtime boundary
- local-model route exposure
- supply-chain and dependency risk
- security-oriented negative test coverage

Phase 16 does **not** include:

- public package publishing
- notarization/signing release work
- new product features unrelated to hardening
- EdgeIntel MCP implementation

## Required Deliverables

1. **Threat model**
   A concise but real threat model for:
   - Worker API and scan routes
   - operator control-plane routes
   - connector pairing and bootstrap
   - desktop connector runtime
   - local-model tunnel path
   - future MCP surface

2. **Security test matrix**
   A test plan that maps attack surfaces to concrete automated checks.

3. **Adversarial negative tests**
   New tests for:
   - malformed Access headers
   - invalid or replayed connector tokens
   - unauthorized tunnel mutations
   - pairing replay attempts
   - invalid provider secret flows
   - malformed hostname and domain inputs

4. **Supply-chain review**
   A documented review of:
   - Worker runtime dependencies
   - Electron dependencies
   - update path
   - `cloudflared` install and checksum flow

5. **Residual risk register**
   Explicit remaining risks and what would be required to reduce them further.

## Concrete Work

### 1. Threat model the actual system

Produce a repo-grounded threat model that covers:

- assets
- trust boundaries
- attacker goals
- abuse paths
- mitigations already present
- gaps still open

### 2. Expand the automated test suite

Add suite-backed tests for:

- Access JWT validation failures
- connector bearer token misuse
- pairing token replay or double exchange
- provider secret clear/update edge cases
- tunnel mutation auth failures
- malformed route and hostname input

### 3. Add supply-chain and dependency checks

At minimum:

- `npm audit` review with triage discipline
- dependency diff review guidance
- CI hooks or scripted checks where justified

### 4. Audit desktop connector boundaries

Focus on:

- process spawning
- shell argument safety
- updater assumptions
- `cloudflared` binary provenance
- local secret storage behavior

### 5. Define the MCP security gate

Before any MCP implementation, establish:

- which tools are safe as read-only
- which tools are never safe as public/general MCP tools
- required auth model
- required human confirmation model
- required negative test coverage

## Acceptance Criteria

Phase 16 is only complete when:

- the threat model exists and is tied to the real repo
- the security test matrix exists
- new adversarial tests are implemented and passing
- the dependency and supply-chain review is documented
- no open critical security findings remain unaddressed for the intended demo
  and operator scope
- MCP is either explicitly approved for Phase 17 or explicitly deferred with
  reasons

## Exit Decision

At the end of Phase 16, make one of two decisions:

1. **Proceed to Phase 17**
   EdgeIntel MCP is justified and the security gate is satisfied.

2. **Defer MCP**
   EdgeIntel should stay HTTP/API/app-shell-first until the remaining risks are
   reduced.
