# MCP Server Evaluation

This document answers one question:

Should EdgeIntel expose its own MCP server?

## Short Answer

Yes, but not as the next phase.

An EdgeIntel MCP server would be a strong addition because it would let Claude,
Codex, ChatGPT-compatible MCP clients, and internal SE copilots invoke EdgeIntel
as a real tool surface instead of only using the HTTP API or app shell.

The right implementation order is:

1. finish the release-ready Worker and operator flows
2. close Phase 16 security and hardening
3. only then add an **authenticated remote MCP surface**

## Why It Is Worth Building

EdgeIntel already exposes naturally tool-shaped operations:

- create a scan job
- poll scan status
- fetch the latest posture for a domain
- fetch the commercial brief
- generate exports
- validate hostnames
- inspect tunnel health

That maps extremely well to MCP.

The value is not just "another API wrapper". The value is:

- EdgeIntel becomes directly callable from AI tooling
- SEs can ask an agent to run posture discovery and return the commercial motion
- internal copilots can reason over the same bounded, persisted evidence that the
  UI uses
- customers with their own AI workflows can integrate EdgeIntel without custom
  one-off API glue

## Why Cloudflare Workers Is The Right Host

Cloudflare’s current guidance supports remote MCP servers on Workers over
Streamable HTTP, and supports both public and authenticated deployments.

Relevant references:

- [Build a Remote MCP server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Secure MCP servers with Access for SaaS](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/saas-mcp/)
- [MCP Transports](https://modelcontextprotocol.io/specification/draft/basic/transports)
- [MCP Tools](https://modelcontextprotocol.io/specification/draft/server/tools)

## Recommended Technical Shape

### Phase 1

Use a **stateless remote MCP server** with Streamable HTTP.

For EdgeIntel’s initial tool surface, Cloudflare’s `createMcpHandler()` style is
the right default because most of the work is request-driven and persisted in
D1 already. We do not need per-session conversational state to expose the first
useful tool set.

### Phase 2

Add authenticated remote MCP access using Cloudflare Access or another OAuth 2.0
provider.

### Phase 3

Only after read-oriented tools are stable, add controlled mutation tools with a
human confirmation model.

## Recommended Tool Set

### Start with read-heavy or bounded tools

- `edgeintel_scan_domain`
- `edgeintel_get_job_status`
- `edgeintel_get_latest_posture`
- `edgeintel_get_commercial_brief`
- `edgeintel_generate_export`
- `edgeintel_list_provider_catalog`
- `edgeintel_validate_hostname`
- `edgeintel_get_tunnel_observability`

### Add cautious write tools later

- `edgeintel_create_tunnel`
- `edgeintel_rotate_tunnel_token`
- `edgeintel_save_provider_setting`
- `edgeintel_run_tunnel_test`

These should not be public-first tools.

## Security Position

Do not treat MCP as "just another client."

The protocol is explicitly tool-oriented, which means it increases the blast
radius of bad authorization, weak confirmation UX, or unclear tool boundaries.

Rules for EdgeIntel MCP:

- start read-only or low-risk first
- require explicit auth
- scope tools by operator identity
- require confirmation for meaningful mutation
- keep AI away from raw secrets
- keep private-network and exploit behavior out of scope

## Research Gates Before Implementation

Do not implement EdgeIntel MCP until these are closed:

1. review the latest Cloudflare remote MCP patterns and auth guidance
2. review current MCP spec requirements for Streamable HTTP and tool behavior
3. audit EdgeIntel’s existing auth, mutation routes, and secret handling
4. identify which tools are safe to expose without mutation
5. perform targeted repo research across relevant internal/public repos only if
   it materially improves the design

That research should be evidence-based. Do not implement MCP on instinct.

## Logical Conclusion For EdgeIntel

For this use case, MCP is a strong likely addition, but it is not logically
correct to build it before the security phase.

The right sequence is:

- Phase 16: security, threat modeling, and adversarial test suite
- Phase 17: authenticated EdgeIntel MCP, only if Phase 16 closes cleanly

## Recommended Future Phase

- **Phase 17: Authenticated EdgeIntel MCP**
  - remote MCP endpoint on Workers
  - read-oriented tools first
  - Access or OAuth auth
  - MCP Inspector verification
  - Claude/Codex connection guide
  - mutation tools only after security review
