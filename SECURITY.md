# Security

EdgeIntel is designed for public web posture analysis and Cloudflare-native
control-plane orchestration. It is not intended to be a vulnerability scanner,
an exploit tool, or a private-network inspection system.

## Scope Boundaries

- Public DNS, HTTP, HTTPS, edge, header, and rendered-page evidence is in scope.
- Private RFC1918 targets, `localhost`, raw port scanning, credential attacks,
  and exploit validation are out of scope.
- Mutating control-plane actions should always be deliberate and auditable.

## Reporting

Do not open a public issue for a sensitive security finding.

If GitHub private vulnerability reporting is enabled for this repository, use
that path. Otherwise, contact the repository owner privately before disclosure.

## Current Security Posture

EdgeIntel already includes:

- encrypted provider and tunnel secret storage in the Worker
- one-time pairing sessions for connector bootstrap
- Cloudflare Access validation for operator routes
- checksum verification for `cloudflared` installation in the desktop connector

That is not the same as a completed security certification. The dedicated
security audit and security test program are tracked in
[`docs/maintenance-and-security-roadmap.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/maintenance-and-security-roadmap.md).
