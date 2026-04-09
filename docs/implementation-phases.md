# EdgeIntel Implementation Phases

This roadmap is grounded in the current repository state. The Worker scaffold, D1 schema, Durable Object, Workflow, queue handlers, scan pipeline, findings engine, recommendation engine, and export layer already exist in initial form.

The goal of the next buildout is not to re-architect from scratch. It is to harden, deepen, and connect the existing pieces until `EdgeIntel` becomes a strong production-style domain posture and Cloudflare remediation platform for the `hostingtool.dev` / `hostinginfo.gg` environment.

## Execution Protocol

Every phase follows the same build discipline:

1. implement the phase deliverables
2. run review and verification for that phase
3. tighten polish and fix issues found in review
4. only then move to the next phase

This repo should advance one verified phase at a time rather than accumulating speculative unfinished layers.

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

The highest-value next sprint is:

- environment bootstrap
- D1 migration workflow
- module timing and per-module scan errors
- stronger HTTP evidence capture
- richer Markdown report export

That sprint turns the repo from “excellent scaffold” into “credible working product.”
