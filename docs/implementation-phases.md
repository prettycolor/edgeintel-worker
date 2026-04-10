# EdgeIntel Implementation Phases

This roadmap is grounded in the current repository state. The Worker scaffold, D1 schema, Durable Object, Workflow, queue handlers, scan pipeline, findings engine, recommendation engine, and export layer already exist in initial form.

The goal of the next buildout is not to re-architect from scratch. It is to harden, deepen, and connect the existing pieces until `EdgeIntel` becomes a strong production-style domain posture and Cloudflare remediation platform for the `hostingtool.dev` / `hostinginfo.gg` environment.

## Current Status

- Phases 0 through 6 are implemented and verified in the current repo.
- Phase 7 UI direction is aligned around the in-app app-shell prototype.
- Phase 7A provider control-plane backend is implemented:
  - provider settings schema
  - encrypted secret persistence
  - provider CRUD APIs
  - provider connection tests and persisted test results
- Phase 7B provider control-plane UI is implemented at `/app/providers`.
- Phase 7C tunnel orchestration backend is implemented:
  - remotely managed Tunnel creation
  - proxied DNS route management
  - optional Access policy, token, and app creation
  - tunnel runtime testing and bootstrap rotation
- Phase 7D reference connector runtime is implemented and now lives in `packages/connector-core/`.
- Phase 7E local-model tunnel workspace is implemented at `/app/tunnels`.
- Remaining Phase 7 work is now primarily packaging, visual polish, and deeper connector UX rather than missing control-plane fundamentals.
- Phase 8 monorepo uplift is implemented:
  - `apps/worker` is now the canonical Worker package
  - `apps/control-plane-web` provides the React control-plane foundation
  - `apps/desktop-connector` provides the Electron macOS tray/window scaffold
  - root scripts proxy the existing Worker commands from the repo root
- Phase 9 Access-first auth and scoped bootstrap delivery is implemented:
  - `/app`, `/app/providers`, `/app/tunnels`, and secret-bearing provider/tunnel
    APIs now require Cloudflare Access JWT validation in the Worker
  - `/api/session` exposes the authenticated operator session to the app shell
  - tunnel bootstrap is no longer returned by normal tunnel detail APIs
  - `/api/pairings` plus `/api/pairings/:id/exchange` provide one-time pairing
    handoff for the connector
  - connector heartbeat now requires a scoped bearer token tied to the pairing
- Phase 10 zone discovery and hostname validation is implemented:
  - `/api/zones` exposes discovered Cloudflare zones from the control-plane token
  - `/api/hostnames/validate` auto-matches hostnames to the best zone suffix
  - the tunnel workspace now uses discovered zones instead of manual zone-ID-only input
  - inline DNS conflict checks run before the operator provisions a route
- Phase 11 tunnel observability is implemented:
  - `/api/tunnels/:id/events` exposes a durable event timeline
  - `/api/tunnels/:id/observability` exposes recent tests, last-known-good, version drift, and failure deltas
  - tunnel actions now emit stored events instead of only mutating the latest row state
  - the tunnel workspace surfaces event history and regression context inline
- Phase 12 macOS desktop connector is implemented:
  - `apps/desktop-connector` now ships a real pairing and runtime workspace instead of demo copy
  - the app stores local connector secrets with Electron `safeStorage`
  - `cloudflared` can be detected from the machine or installed into an app-managed path from the official Cloudflare release feed
  - desktop runtime controls now supervise `cloudflared`, probe the local service, and send connector heartbeats back to EdgeIntel
  - desktop tests and packaging smoke checks now gate the phase alongside the repo-wide verification flow
- Phase 13 provider auth matrix and credential UX is implemented:
  - `/api/settings/provider-catalog` exposes the supported provider presets and auth strategies
  - provider records now persist `authStrategy` explicitly instead of relying on an implied OAuth checkbox
  - `/app/providers` now shows provider capability notes, supported auth paths, secret health summaries, and secret-clearing controls
  - provider tests now treat unsupported auth modes as explicit warnings instead of pretending every provider supports the same flow
  - Gemini and OpenRouter are now first-class API-key presets beside OpenAI, Anthropic, Workers AI, Ollama, and custom OpenAI-compatible routes
- Phase 14 commercial output and hosting intelligence uplift is implemented:
  - `@edgeintel/intelligence-rules` now carries worker-safe canonical hosting/provider rules extracted from the hostinginfo intelligence layer
  - scan summaries now separate DNS, edge, WAF, and origin provider attribution more deliberately
  - `/api/scans/:scanRunId/commercial-brief` exposes Cloudflare fit, access-hardening, latency/resilience, and expansion-motion summaries
  - export v1.6 now embeds the commercial brief into Markdown, JSON, and API payload outputs
- Phase 15 demo and interview layer is implemented:
  - the repo now includes a canonical demo script, demo domain set, architecture story, and visual QA checklist
  - the React operator-shell scaffold now reflects the completed control-plane and commercial-output story
  - the remaining work is now release packaging and future expansions rather than missing core product layers
- The release layer baseline is implemented:
  - deploy runbook for a signed-in Cloudflare account
  - operator quickstart for the current app and API surfaces
  - public repo release checklist
  - MCP server evaluation and future phase definition
  - maintenance and security roadmap
  - CI plus Dependabot for baseline repo upkeep
- There are no known missing core implementation items from the current product
  roadmap that need to land before the security phase.
- Remaining non-security work is now release-finalization work:
  - final visual QA and polish
  - notarized macOS distribution
  - release tags / GitHub Releases
  - public package publishing at the very end

Public package publishing remains intentionally deferred until the final release
pass.

## Execution Protocol

Every phase follows the same build discipline:

1. implement the phase deliverables
2. run review and verification for that phase
3. tighten polish and fix issues found in review
4. only then move to the next phase

This repo should advance one verified phase at a time rather than accumulating speculative unfinished layers.

## Next Logical Phases

The next phase is **Phase 16: Security, Threat Modeling, And Adversarial Test
Suite**.

The phase after that is **Phase 17: Authenticated EdgeIntel MCP**, but only if
Phase 16 closes cleanly and the MCP decision gate still holds.

## Phase 0: Foundation Lock-In

### Goal

Stabilize the repo as the single source of truth and make local and remote Cloudflare development repeatable.

### Deliverables

- Clean local setup and documented environment bootstrapping
- D1 migrations runnable locally and remotely
- Wrangler environments for `dev` and `prod`
- baseline secrets and vars documented
- one command path for local development and one for deploy validation

### Concrete work

- Add `.dev.vars.example` or equivalent environment template for:
  - `AI_GATEWAY_BASE_URL`
  - `AI_GATEWAY_TOKEN`
  - `AI_GATEWAY_MODEL`
  - `AI_GATEWAY_PROVIDER`
  - `BROWSER_RENDERING_REST_BASE_URL`
  - `BROWSER_RENDERING_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Add npm scripts for D1 local migration/apply/reset workflows.
- Add a lightweight `scripts/bootstrap.sh` or README-first bootstrap path for:
  - install
  - D1 local creation
  - migration apply
  - `wrangler dev --remote`
- Decide whether Browser Rendering stays REST-first in v1 or moves to the Workers browser binding immediately.

### Acceptance criteria

- A fresh local checkout can boot the Worker without guessing env setup.
- D1 schema can be applied without manual SQL copy/paste.
- `/health` and the current scan routes work in dev mode.

## Phase 1: Scan Engine Hardening

### Goal

Take the current scan path from “good scaffold” to “trustworthy public posture collector.”

### Current state

- Domain normalization exists.
- DoH-based DNS collection exists.
- HTTP/HTTPS probing exists.
- Provider attribution exists.
- Findings and recommendations already derive from collected data.

### Deliverables

- more robust redirect and response handling
- bounded retry behavior for fetch-based collectors
- better evidence capture for DNS, HTTP, and provider attribution
- explicit scan module timing and per-module failure reporting

### Concrete work

- Split `performEdgeScan()` into named modules with timing metadata:
  - `dns`
  - `http`
  - `attribution`
  - `findings`
  - `recommendations`
- Extend the stored `raw_result_json` shape to include module timing and errors.
- Add safe retry wrappers around DoH and public HTTP probes.
- Capture richer DNS evidence:
  - TTL summaries
  - DNS provider confidence details
  - MX/TXT-derived hints for email or SaaS footprint
- Improve HTTP evidence:
  - content-type tracking
  - normalized redirect reasons
  - alternate host/protocol result notes
  - stronger asset and route extraction heuristics
- Add explicit handling for:
  - `403` edge-denied surfaces
  - infinite or cyclic redirect suspicion
  - DNS-success / HTTP-failure split

### Acceptance criteria

- Every completed scan exposes machine-readable module-level evidence.
- Failures are partial and explainable instead of collapsing the whole scan.
- Scan results feel credible for a real domain posture review.

## Phase 2: Artifact And Evidence Expansion

### Goal

Make the evidence layer visually convincing enough for demo, SE, and operator workflows.

### Current state

- raw HTML artifact capture exists
- Browser Rendering REST integration is optional
- screenshot and rendered markdown capture exist behind config

### Deliverables

- deterministic artifact generation policy
- stronger screenshot and rendered-content capture
- artifact metadata that explains what was captured and why

### Concrete work

- Promote Browser Rendering into a first-class feature path:
  - fallback behavior when unavailable
  - artifact status reporting in scan results
- Add artifact categories:
  - `raw-html`
  - `rendered-markdown`
  - `screenshot`
  - `redirect-trace`
  - `response-headers`
  - `dns-snapshot`
- Persist artifact provenance:
  - source module
  - target URL
  - timestamp
  - capture mode
- Add artifact retrieval helpers and signed/public delivery strategy if needed.
- Consider adding one summary artifact per scan:
  - `scan-evidence.json`

### Acceptance criteria

- A finished scan has enough artifacts to support a customer or interview walkthrough.
- Missing Browser Rendering does not break the scan, but is surfaced clearly.

## Phase 3: Cloudflare Upgrade Planner v1

### Goal

Turn findings into a credible Solutions Engineer recommendation layer.

### Current state

- Recommendation mapping already exists for:
  - `WAF`
  - `BOT_MANAGEMENT`
  - `TURNSTILE`
  - `API_SHIELD`
  - `LOAD_BALANCING`
  - `CACHE_RULES`
  - `SMART_ROUTING`
  - `ADVANCED_CERTIFICATE_MANAGER`

### Deliverables

- better scoring, confidence, and rollout ordering
- recommendation rationale tied explicitly to evidence
- deployment-ready export payloads that are less placeholder-like

### Concrete work

- Replace simple recommendation triggers with weighted policy logic:
  - finding severity
  - evidence count
  - provider posture
  - auth/API/cache surface presence
- Introduce recommendation ordering fields:
  - `phase`
  - `sequence`
  - `blockedBy`
- Add stronger export payload structures:
  - WAF managed rules + custom rule sketches
  - Turnstile placement suggestions
  - API Shield rollout stages
  - cache rule candidates
  - load balancer origin hints
- Add recommendation views:
  - technical operator view
  - executive summary view

### Acceptance criteria

- The recommendation layer reads like a real Cloudflare SE artifact, not generic best practices.
- Every recommendation can point back to one or more findings and evidence elements.

## Phase 4: Export System v1.5

### Goal

Make exports strong enough to be practically useful in customer conversations and implementation prep.

### Current state

- Markdown, JSON, Terraform, and Cloudflare API payload exports already exist.

### Deliverables

- richer Markdown reports
- more realistic Terraform/API payload drafts
- export metadata and versioning

### Concrete work

- Expand Markdown export into sections:
  - executive summary
  - detected posture
  - findings by severity
  - recommended Cloudflare products
  - rollout order
  - artifacts index
- Improve Terraform draft realism with resource stubs and variable expectations.
- Improve API export realism by grouping payloads by Cloudflare product.
- Add export manifest metadata:
  - schema version
  - generated at
  - scan run id
  - artifact refs
- Add export regeneration endpoint behavior guarantees:
  - exports must derive from persisted findings only

### Acceptance criteria

- The Markdown export can be shown directly in a demo or interview.
- JSON/API exports are structured enough to support future automation.

## Phase 5: Job UX, History, And Diffing

### Goal

Turn the scan system into a durable posture platform, not a one-shot scanner.

### Current state

- jobs, runs, findings, artifacts, recommendations, and exports are stored
- domain history endpoint exists
- SSE event stream exists

### Deliverables

- richer job progress
- run comparisons and posture diffs
- batch scan visibility
- scheduled rescan support

### Concrete work

- Add scan module progress events, not just run-level status.
- Add history comparison helpers:
  - new findings
  - resolved findings
  - recommendation changes
  - provider posture changes
- Add scheduled scan trigger path via cron or explicit queue/workflow kickoff.
- Add batch scan guardrails:
  - bounded size
  - throughput controls
  - resumable status semantics
- Add `latest` and `history diff` API shapes.

### Acceptance criteria

- You can show how a domain posture changed over time.
- Batch and recurring scans look deliberate and durable.

## Phase 6: AI Gateway And Hosted/Hybrid Inference

### Goal

Add bounded AI value without making AI the system of record.

### Current state

- AI Gateway config placeholders exist
- no first-class inference integration is implemented yet

### Deliverables

- hosted provider integration through AI Gateway
- optional self-hosted model path behind HTTPS
- evidence-bounded summaries or recommendation explanations
- setup documentation that is fast to follow and easy to mirror into a public wiki

### Concrete work

- Build a provider client that only operates on persisted findings and summaries.
- Add an inference capabilities surface so operators can see which hosted and local routes are configured.
- Start with one low-risk use case:
  - recommendation explanation polishing
  - executive summary drafting
  - artifact synopsis generation
- Keep strict prompt inputs:
  - findings
  - summary
  - recommendations
  - no uncontrolled raw crawl spam
- Add hosted provider path first.
- Add Ollama/Gemma4 only through an HTTPS-exposed endpoint or tunnel-backed gateway, never `localhost`.
- Document the local-model path with Cloudflare Tunnel plus optional Access service tokens so higher-end engineers can use self-hosted compute without losing production safety.

### Acceptance criteria

- AI output is clearly grounded and optional.
- The system still works fully when AI is unavailable.
- A new engineer can configure either a hosted model or a Tunnel-backed local model by following the repo docs.

## Phase 7: Demo And Interview Layer

### Goal

Package the system into a strong interview narrative and live demo flow.

### Deliverables

- one canonical demo script
- one canonical test domain set
- one polished report example
- one “why Workers, why Cloudflare” architectural explanation

### Concrete work

- Pick 3-5 public domains with distinct posture patterns:
  - already on Cloudflare
  - not on Cloudflare
  - auth-heavy
  - API-visible
  - weak cache/security posture
- Add canned commands and expected output flow for the demo.
- Prepare one walkthrough that shows:
  - job creation
  - live progress
  - findings
  - artifact review
  - Upgrade Planner output
  - export generation
- Document explicit platform boundaries so the project reads as responsible, not reckless.

### Acceptance criteria

- You can explain the architecture in under 10 minutes.
- You can demo the product live without improvising the system story.

## Recommended Build Order From Here

1. Finish Phase 0 so the repo is easy to boot repeatedly.
2. Deepen Phase 1 so scan outputs are more trustworthy.
3. Strengthen Phase 2 so the evidence layer becomes visually persuasive.
4. Upgrade Phase 3 and 4 together because recommendation quality and export quality should evolve in lockstep.
5. Add Phase 5 once the core scan output is stable.
6. Add Phase 6 only after the deterministic product is strong on its own.
7. Use Phase 7 to package the finished system into the interview story.

## Immediate Next Sprint

The highest-value next sprint now is:

- hosted provider settings UI in the app shell
- connection-test UX with operator-grade diagnostics
- tunnel orchestration control-plane APIs
- connector pairing and local-model onboarding design

That sprint turns Phase 7 from architectural direction into a usable onboarding surface.
