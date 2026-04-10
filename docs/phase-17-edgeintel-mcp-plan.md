# Phase 17: EdgeIntel MCP Plan

## Decision

EdgeIntel **should** get its own remote MCP surface.

The Phase 16 deferral was correct. It prevented us from exposing the existing
control plane as a generic tool endpoint before the auth, secret, and tunnel
boundaries were explicit. That gate is now closed cleanly enough to make the
next decision:

- **Go:** yes, build a dedicated authenticated remote MCP server for EdgeIntel.
- **Do not do:** expose the current `/api/*` routes wholesale as MCP.
- **Next implementation phase:** build a separate MCP layer with its own auth,
  scopes, and tool registration rules.

## Why The Conclusion Changed

Two things are now true at the same time:

1. EdgeIntel already has a mature tool-shaped product surface.
2. The current Cloudflare and MCP guidance is now specific enough to implement
   this correctly on Workers.

That means the question is no longer "should we defer MCP?" The question is now
"what is the correct EdgeIntel-specific MCP shape?"

## What MCP Adds To EdgeIntel

An EdgeIntel MCP server would unlock four concrete capabilities:

1. Claude, Codex, Cursor, ChatGPT-compatible MCP clients, and internal copilots
   can invoke EdgeIntel directly as tools.
2. EdgeIntel becomes model-agnostic at the interface layer. The host chooses the
   model; EdgeIntel supplies the posture and remediation operations.
3. Higher-end users with their own local-model stack can use EdgeIntel without
   EdgeIntel itself paying per-request model costs.
4. Cloudflare Access and MCP portals can later govern which EdgeIntel tools are
   available to which audience.

The third point matters for this project. In MCP, the model often already lives
in the host. That means EdgeIntel does not need to own the entire reasoning
layer just to be useful. For many MCP workflows, EdgeIntel should focus on
delivering clean structured evidence and let the connected client model do the
reasoning.

## Official Constraints That Matter

These are the current facts the design must respect:

- Cloudflare’s `createMcpHandler()` is the correct Worker-native path for a
  **stateless** MCP server, and it serves the **Streamable HTTP** transport.
- Cloudflare explicitly supports authenticated MCP on Workers and exposes auth
  context to tools through `getMcpAuthContext()`.
- The MCP authorization spec for HTTP transports is OAuth-based and requires
  protected resource metadata discovery.
- The current MCP spec treats OAuth authorization and Streamable HTTP as the
  modern baseline, not the older HTTP+SSE pattern.
- MCP tool metadata now supports behavior hints such as read-only,
  destructive, idempotent, and open-world annotations.

For EdgeIntel, that means the current browser-oriented
`Cf-Access-Jwt-Assertion` gate is not enough for a standards-compliant remote
MCP server. It remains correct for the app shell, but MCP needs its own OAuth
flow.

## Recommended Server Shape

Build EdgeIntel MCP as a **stateless remote MCP server** on the existing Worker.

### Recommended route layout

- `/mcp`
  Streamable HTTP MCP endpoint
- `/oauth/authorize`
  OAuth authorization entry
- `/oauth/token`
  OAuth token exchange
- `/oauth/register`
  Dynamic client registration
- well-known metadata endpoints
  served by the OAuth provider layer for client discovery

### Recommended implementation pattern

- Use `createMcpHandler()` for the MCP transport.
- Create a **fresh** `McpServer` instance per request.
- Register tools conditionally based on resolved scopes/permissions.
- Return `structuredContent` plus text summaries for the tools that already
  produce typed data.
- Keep long-running scan execution asynchronous: create the job, return the job
  ID, and let the client poll status with a second tool.

This is the right fit because EdgeIntel’s state already lives in D1, R2,
Durable Objects, and Workflows. The first MCP surface does not need a stateful
`McpAgent`.

## Recommended Auth Model

### Phase 18 default

Use **Cloudflare Access as the OAuth provider** for the first EdgeIntel MCP
implementation.

Why this is the right choice:

- EdgeIntel is currently a private operator-facing system.
- The control plane already assumes Cloudflare Access for operator identity.
- Cloudflare explicitly documents Access as an OAuth provider for secure remote
  MCP.
- This gives us policy control and a cleaner internal/private deployment story
  than inventing a second auth system just for MCP.

### What not to do

Do **not** front `/mcp` with only the existing Access JWT header check and call
it complete. That is not the correct standards-based remote MCP flow for
general MCP clients.

### Scope model

Start with explicit tool scopes:

- `edgeintel.scan.read`
- `edgeintel.scan.create`
- `edgeintel.export.generate`
- `edgeintel.catalog.read`
- `edgeintel.zone.read`
- `edgeintel.hostname.validate`
- `edgeintel.tunnel.read`
- `edgeintel.tunnel.test`

Reserve but do not expose by default:

- `edgeintel.provider.write`
- `edgeintel.tunnel.write`
- `edgeintel.secret.manage`

Conditionally registering tools is preferred over only checking permissions
inside handlers. If the user cannot use a tool, the model should ideally never
see it.

## Tool Boundary

The safest initial EdgeIntel MCP server is not read-only, but it is still
**bounded**.

### Allow in the first implementation

- read-heavy scan retrieval
- bounded scan creation
- bounded export creation
- catalog and validation tools
- tunnel observability reads

### Keep out of the first implementation

- provider CRUD that stores or changes secrets
- tunnel creation and deletion
- tunnel token rotation
- pairing creation or exchange
- heartbeat submission
- any raw secret retrieval
- any surface that returns local bootstrap material or private topology details

The key rule is simple:

MCP gets the **operator workflow layer**, not the **secret/bootstrap layer**.

## EdgeIntel-Specific Product Insight

For EdgeIntel, MCP makes the current `ai-brief` surface less central.

When an MCP client is already connected, the client model can reason over:

- `latest posture`
- `history`
- `commercial brief`
- `recommendations`
- `exports`

That means EdgeIntel should not over-rotate toward server-side model
summarization inside the MCP server. The stronger design is:

- EdgeIntel returns clean structured evidence.
- The connected model does the reasoning.
- Server-side AI stays optional for the web app and non-MCP automation paths.

This directly supports the project’s local-model goal. A user can connect a
local-model-capable MCP host to EdgeIntel and get high-value behavior without
EdgeIntel itself making paid frontier-model calls for the reasoning step.

## Recommended Rollout

### Phase 18A: Core authenticated MCP

- add the OAuth provider layer
- add `/mcp` with stateless `createMcpHandler()`
- expose the first safe tool set
- add MCP Inspector verification
- document Claude/Codex/Cursor connection steps

### Phase 18B: Richer MCP ergonomics

- add resources for persisted scan outputs and commercial briefs
- add prompt templates for common SE workflows
- add rate-limit and quota telemetry for MCP tool use

### Phase 18C: Governed expansion

- add carefully-scoped tunnel test tools
- add portal-specific curated tool subsets
- evaluate Cloudflare MCP portals for internal vs customer vs partner views

## Non-Negotiable Security Rules

- Never expose provider secrets, tunnel secrets, pairing secrets, or bootstrap
  payloads as MCP tools.
- Never expose pairings or heartbeat endpoints as general MCP tools.
- Redact or omit sensitive local topology where the current HTTP API exposes
  operator-only details.
- Use per-tool scope checks and conditional registration.
- Use tool annotations honestly so clients can distinguish read-only,
  destructive, idempotent, and open-world behavior.
- Rate-limit scan creation and export generation.
- Keep scan inputs restricted to the same bounded public-domain posture rules
  already enforced by EdgeIntel.

## Final Conclusion

The correct outcome of Phase 17 is:

- **MCP deferral is over.**
- **EdgeIntel MCP is approved for implementation.**
- **The implementation must be a dedicated OAuth-protected tool layer, not a
  raw projection of the current API.**

The next correct phase is implementation, not more generic evaluation.

## Sources

- [Cloudflare createMcpHandler](https://developers.cloudflare.com/agents/api-reference/mcp-handler-api/)
- [Cloudflare MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)
- [Cloudflare Access for SaaS MCP guide](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/)
- [Cloudflare MCP governance](https://developers.cloudflare.com/agents/model-context-protocol/governance/)
- [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP Tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP changelog: Streamable HTTP and annotations](https://modelcontextprotocol.io/specification/2025-03-26/changelog)
- [MCP changelog: protected resource metadata and structured output](https://modelcontextprotocol.io/specification/2025-06-18/changelog)
- [MCP sampling concept](https://modelcontextprotocol.io/docs/concepts/sampling)
- [Cloudflare Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)
