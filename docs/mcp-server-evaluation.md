# MCP Server Evaluation

This document answers one question:

Should EdgeIntel expose its own MCP server?

## Short Answer

Yes, and the research/design gate is now complete.

An EdgeIntel MCP server would be a strong addition because it would let Claude,
Codex, ChatGPT-compatible MCP clients, and internal SE copilots invoke EdgeIntel
as a real tool surface instead of only using the HTTP API or app shell.

Phase 16 is closed, and Phase 17 has now completed the design work needed to
move forward.

The current conclusion is:

- do **not** mirror the existing HTTP API directly into MCP
- do build a **dedicated authenticated remote MCP surface**
- implement it as the next phase using Cloudflare’s Worker-native MCP stack

The decision-complete design artifacts are:

- [Phase 17: EdgeIntel MCP Plan](./phase-17-edgeintel-mcp-plan.md)
- [EdgeIntel MCP Tool Matrix](./edgeintel-mcp-tool-matrix.md)

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

## Phase 17 Outcome

The research gates are now closed:

1. current Cloudflare remote MCP patterns and auth guidance were reviewed
2. current MCP transport, authorization, and tool-behavior requirements were reviewed
3. EdgeIntel’s auth, mutation routes, and secret boundaries were audited
4. the safe first tool set was identified
5. relevant repo-local MCP patterns were reviewed where they materially helped

The conclusion is now specific:

- EdgeIntel MCP is approved
- the first implementation should use a stateless Worker MCP server
- it should use OAuth-based authentication rather than the current browser-only
  Access JWT gate
- it should start with read-heavy and bounded tools only
- provider secrets, tunnel bootstrap, pairings, and heartbeat flows stay out of
  MCP

## Logical Conclusion For EdgeIntel

For this use case, MCP is no longer a likely future addition. It is the correct
next expansion, provided it follows the Phase 17 design artifacts.

## Recommended Future Phase

- **Phase 18: Authenticated EdgeIntel MCP implementation**
  - remote MCP endpoint on Workers
  - Access-backed OAuth flow
  - read-oriented and bounded tools first
  - MCP Inspector verification
  - Claude/Codex/Cursor connection guide
  - mutation tools only after the initial MCP release is stable
