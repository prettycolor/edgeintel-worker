# Phase 16 Security Test Matrix

## Automated Coverage

| Surface | Abuse Case | Current Coverage |
| --- | --- | --- |
| Access gate | Missing JWT is rejected | `apps/worker/tests/auth.test.ts` |
| Access gate | Malformed JWT is rejected | `apps/worker/tests/auth.test.ts` |
| Access gate | Dev bypass is localhost-only | `apps/worker/tests/auth.test.ts` |
| Route exposure | Private app/API routes require operator auth | `apps/worker/tests/route-auth.test.ts`, `apps/worker/tests/fetch-security.test.ts` |
| Connector exchange | Pairing exchange bypasses operator auth but still fails on invalid token | `apps/worker/tests/fetch-security.test.ts` |
| Pairing tokens | Opaque token verification rejects wrong token | `apps/worker/tests/pairings.test.ts` |
| Provider config | Unsupported auth strategy is rejected | `apps/worker/tests/provider-settings.test.ts` |
| Provider test posture | Missing Access headers are reported separately from upstream auth | `apps/worker/tests/provider-settings.test.ts` |
| Tunnel input | `localServiceUrl` rejects embedded credentials | `apps/worker/tests/tunnels.test.ts` |
| Connector payloads | Invalid connector status and malformed heartbeat booleans are rejected | `apps/worker/tests/connector-input.test.ts` |
| Connector payloads | Pairing metadata is normalized and bounded | `apps/worker/tests/connector-input.test.ts` |
| Secret storage | AES-GCM encrypt/decrypt round trip works and empty payloads stay empty | `apps/worker/tests/secrets.test.ts` |
| Cloudflared install | Expected asset name and release-note checksum parsing are correct | `apps/desktop-connector/src/main/cloudflared.test.ts` |

## Verification Gate

Phase 16 is not complete without:

- `npm run db:local:apply`
- `npm run verify`
- dependency audit triage
- diff review for new auth and connector input boundaries

## Manual / Operator Checks

These are not fully automated yet and should remain in the release checklist:

- verify Access policy membership and audience values against the deployed app
- verify tunnel provisioning token scopes against the real Cloudflare account
- verify desktop package signing/notarization before public distribution
- verify the local model route cannot be reached publicly without Access or the
  tunnel token path
- verify release-updater metadata once GitHub Releases are enabled

## Known Gaps

- no dedicated load or brute-force test around pairing exchange yet
- no automated macOS Keychain tamper test
- no dedicated D1-backed replay-race integration harness yet
- no MCP-specific adversarial suite because MCP is still deferred
