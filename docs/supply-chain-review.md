# Phase 16 Supply-Chain Review

## Scope

This review covers the runtime and packaging dependencies that materially affect
EdgeIntel:

- Worker dependencies in `apps/worker/package.json`
- React control-plane dependencies in `apps/control-plane-web/package.json`
- desktop connector dependencies in `apps/desktop-connector/package.json`
- connector-core and shared internal packages
- managed `cloudflared` install flow
- desktop auto-update wiring

## Dependency Shape

### Worker

- `jose`
- `wrangler`
- `typescript`
- `vitest`

The Worker surface is intentionally lean. The main third-party runtime
dependency is `jose`, which is appropriate for Access JWT validation.

### Control Plane

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`

This is a conventional, low-complexity frontend toolchain.

### Desktop Connector

- `electron`
- `electron-store`
- `electron-updater`
- Electron Forge Vite packaging stack

The desktop app is the most supply-chain-sensitive package because it downloads
and executes binaries, stores local secrets, and eventually ships signed
artifacts.

## Managed cloudflared Install Path

Current behavior in `apps/desktop-connector/src/main/cloudflared.ts`:

- fetches the latest release metadata from the official
  `cloudflare/cloudflared` GitHub releases API
- picks the expected macOS archive for the current architecture
- extracts the published SHA-256 from the release notes
- downloads the archive
- verifies the SHA-256 before extraction
- extracts with `tar`
- installs the binary into the app-managed user-data bin directory

### Assessment

- checksum verification is present and materially reduces tampered-download risk
- execution uses a copied local binary rather than shell-piped remote content
- the remaining trust assumption is the integrity of the GitHub release payload
  and release notes

## Desktop Auto-Update Path

`apps/desktop-connector/src/main/updater.ts` wires `electron-updater`, but the
release distribution path is not fully closed yet because:

- notarization/signing is not yet part of the active build pipeline
- public GitHub release publishing is explicitly deferred to the end
- release-channel trust and rollback strategy are not fully documented yet

### Assessment

The updater code is acceptable as a scaffold, but it should not be treated as a
fully hardened public distribution path yet.

## CI / Dependency Drift Controls Already Present

- `npm run verify` workspace gate
- `.github/workflows/verify.yml`
- `.github/dependabot.yml`
- explicit Node version pinning to 24.x
- dry-run Wrangler deploy in the verification path

## Audit Result

The Phase 16 audit command is:

```bash
npm audit --workspaces --audit-level=high
```

Use the result as a triage input, not as an unfiltered blocker list. Any finding
must be evaluated for:

- production reachability
- whether it affects dev-only tooling
- whether a fix requires a breaking major-version jump

### Current audit snapshot

The current audit reports `27` vulnerabilities (`6` low, `21` high).

What matters:

- the reported highs are concentrated in the **desktop Electron Forge toolchain**
  and its transitive packaging stack (`tar`, `tmp`, `@electron/rebuild`,
  `@electron-forge/*`)
- the Worker runtime package set did **not** surface a direct runtime-critical
  advisory in this audit pass
- the fix path suggested by `npm audit --force` would downgrade key Electron
  Forge packages and should **not** be applied blindly

### Phase 16 conclusion

- treat the current audit as a **desktop release hardening item**, not a reason
  to distrust the private Worker/operator control plane immediately
- keep the desktop app in controlled/operator use until the Electron Forge
  dependency line is upgraded or otherwise triaged cleanly

## Recommendations

- keep the Worker runtime dependency graph small
- prefer pinned compatible Electron/Electron Forge versions and upgrade them
  together
- keep `cloudflared` download verification mandatory
- complete notarization/signing before public desktop release
- do not expose MCP or broader remote execution surfaces through the desktop
  updater path without a separate hardening review
