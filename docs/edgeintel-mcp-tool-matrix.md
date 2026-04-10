# EdgeIntel MCP Tool Matrix

This matrix defines what the first EdgeIntel MCP server should and should not
expose.

## Tool Tiers

### Tier 1: Approved for first MCP implementation

| Tool | Backing surface | Scope | Why it is allowed | Notes |
| --- | --- | --- | --- | --- |
| `edgeintel.scan.create` | `POST /api/scan` | `edgeintel.scan.create` | High-value, bounded, external-only posture job creation | Mark as non-read-only, non-destructive, non-idempotent, open-world |
| `edgeintel.job.status.get` | `GET /api/jobs/:jobId` | `edgeintel.scan.read` | Pure status retrieval over an existing async job | Read-only |
| `edgeintel.domain.latest.get` | `GET /api/domains/:domain/latest` | `edgeintel.scan.read` | Core posture retrieval | Read-only |
| `edgeintel.domain.history.list` | `GET /api/domains/:domain/history` | `edgeintel.scan.read` | Useful for deltas and trend analysis | Read-only |
| `edgeintel.scan.commercial_brief.get` | `GET /api/scans/:scanRunId/commercial-brief` | `edgeintel.scan.read` | Core SE/upsell output | Read-only |
| `edgeintel.export.create` | `POST /api/exports/:scanRunId` | `edgeintel.export.generate` | Bounded artifact generation from persisted data | Non-read-only but additive |
| `edgeintel.provider.catalog.list` | `GET /api/settings/provider-catalog` | `edgeintel.catalog.read` | Safe descriptive metadata only | Read-only |
| `edgeintel.inference.capabilities.get` | `GET /api/inference/capabilities` | `edgeintel.catalog.read` | Safe descriptive metadata only | Read-only |
| `edgeintel.zone.list` | `GET /api/zones` | `edgeintel.zone.read` | Needed for operator routing choices | Read-only |
| `edgeintel.hostname.validate` | `POST /api/hostnames/validate` | `edgeintel.hostname.validate` | Bounded validation without mutating Cloudflare resources | Non-read-only, idempotent |
| `edgeintel.tunnel.observability.get` | `GET /api/tunnels/:id/observability` | `edgeintel.tunnel.read` | Valuable diagnostics surface | Redact sensitive local target details |

### Tier 2: Valid, but only after the first MCP release is stable

| Tool | Backing surface | Scope | Why it is deferred |
| --- | --- | --- | --- |
| `edgeintel.tunnel.test.run` | `POST /api/tunnels/:id/test` | `edgeintel.tunnel.test` | Still safe enough eventually, but it touches a more sensitive runtime path |
| `edgeintel.scan.ai_brief.create` | `POST /api/scans/:scanRunId/ai-brief` | `edgeintel.scan.read` plus provider-specific policy | Useful, but MCP clients often already have a model, so this is lower priority |
| `edgeintel.domain.watch.upsert` | `POST /api/domains/:domain/watch` | `edgeintel.scan.create` plus watch scope | Valuable for automation, but it increases background-job blast radius |
| `edgeintel.domain.watch.delete` | `DELETE /api/domains/:domain/watch` | watch-delete scope | Same reason as above |

### Tier 3: Do not expose as general MCP tools

| Surface | Why it stays out of MCP |
| --- | --- |
| `POST /api/pairings` | Creates bootstrap material and machine-scoped connector access |
| `POST /api/pairings/:id/exchange` | One-time secret-bearing bootstrap exchange |
| `POST /api/tunnels/:id/heartbeat` | Machine-to-control-plane telemetry, not an operator tool |
| `POST /api/tunnels` | Creates Cloudflare resources and secrets; too much blast radius for v1 MCP |
| `PATCH /api/tunnels/:id` | Mutates live control-plane configuration |
| `DELETE /api/tunnels/:id` | Deletes live resources |
| `POST /api/tunnels/:id/rotate-token` | Secret rotation surface |
| `POST /api/settings/providers` | Stores or changes credentials |
| `PATCH /api/settings/providers/:id` | Credential and route mutation surface |
| `DELETE /api/settings/providers/:id/secret` | Secret-management action |
| any direct provider or tunnel secret read | Secrets must never be an MCP payload |

## Recommended Resource Surfaces For Phase 18B

These are better as MCP resources than as tools because they represent persisted
state rather than imperative actions.

- `edgeintel://domain/{domain}/latest`
- `edgeintel://scan/{scanRunId}/commercial-brief`
- `edgeintel://scan/{scanRunId}/recommendations`
- `edgeintel://scan/{scanRunId}/artifacts/manifest`
- `edgeintel://tunnel/{tunnelId}/observability`

## Recommended Prompt Surfaces For Phase 18B

These are optional, but useful once the core tools are stable.

- `edgeintel.prompt.cloudflare-motion`
  Turn the latest posture and commercial brief into a Cloudflare expansion plan.
- `edgeintel.prompt.domain-triage`
  Summarize the most important risks and next actions for a scanned domain.
- `edgeintel.prompt.tunnel-regression-review`
  Explain what changed between the last-known-good tunnel state and the latest failure.

## Tool Annotation Guidance

### Read-only tools

Mark these with:

- `readOnlyHint: true`
- `openWorldHint: false` unless they trigger external lookups beyond EdgeIntel’s persisted state

### Bounded write tools

For `edgeintel.scan.create`, `edgeintel.export.create`, and
`edgeintel.hostname.validate`:

- `readOnlyHint: false`
- `destructiveHint: false`
- `idempotentHint`
  - `false` for scan creation
  - `true` for hostname validation
- `openWorldHint: true` for scan creation because it probes public internet surfaces

## Important Product Note

If the MCP client already has a capable model, EdgeIntel should usually return
typed data and let the client reason over it. This is why the commercial brief,
history, recommendations, and exports are first-class MCP candidates, while
server-side `ai-brief` generation is a secondary addition instead of the center
of the MCP design.
