# Release Checklist

Use this before calling EdgeIntel ready for a public demo, public repo review,
or release candidate.

## Repo Readiness

- `README.md` reflects the current behavior and route surface.
- deployment, operator, and demo docs are present and linked.
- `CONTRIBUTING.md`, `SECURITY.md`, CI, and Dependabot are in place.
- no local `.dev.vars`, secrets, or generated artifacts are committed.
- package publishing remains deferred until the end of the buildout.

## Verification

- `npm run db:local:apply`
- `npm run verify`
- GitHub Actions verify workflow is green
- a fresh clone can bootstrap without hidden local assumptions

## Visual QA

Run the checklist in
[`docs/visual-qa-checklist.md`](/Users/b.rad/Documents/GitHub/edgeintel-worker/docs/visual-qa-checklist.md).

Minimum sign-off:

- provider workspace reads clearly in empty, configured, and error states
- tunnel workspace reads clearly in setup, healthy, degraded, and failed states
- desktop connector states are visually distinct
- commercial brief reads as both customer-safe and operator-useful

## Deployment QA

- deploy to a signed-in Cloudflare account succeeds
- remote D1 migrations are applied
- public `/health` smoke test works remotely
- public MCP metadata endpoints work remotely
- `/mcp` returns the expected OAuth challenge without a token
- scan, commercial brief, and export endpoints work remotely behind Access
- Access-protected app routes work on the chosen host (`workers.dev` or custom domain)
- `/authorize` works only after the `MCP_ACCESS_*` secrets are configured

## Demo Readiness

- demo domain set chosen and validated on the same day
- provider test already green
- tunnel route already validated if the demo includes the local model path
- desktop connector already paired on the demo machine
- demo script rehearsed end-to-end once

## Public Repo Hygiene

- choose the public license before package publishing
- decide whether screenshots or short recordings should be added to the repo
- confirm wiki Home page points to the current setup and demo docs
- keep packaged desktop binaries and generated output out of git history

## Deferred Until The Final Release Pass

- public GitHub packages
- notarized macOS distribution
- release tags and GitHub Releases
- deployed MCP smoke sign-off and Inspector verification
- full cybersecurity audit sign-off
