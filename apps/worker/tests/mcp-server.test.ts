import { describe, expect, it } from "vitest";
import { buildMcpServer } from "../src/mcp/server";
import {
  DEFAULT_MCP_SCOPES,
  MCP_SCOPE_EXPORT_GENERATE,
  MCP_SCOPE_SCAN_READ,
} from "../src/mcp/scopes";

function listRegisteredTools(server: unknown): string[] {
  return Object.keys(
    (server as {
      _registeredTools: Record<string, unknown>;
    })._registeredTools,
  ).sort();
}

describe("mcp server registration", () => {
  it("registers the full tier-one tool set for the default scope bundle", () => {
    const server = buildMcpServer({} as never, {
      login: "owner-1",
      grantedScopes: DEFAULT_MCP_SCOPES,
    });

    expect(listRegisteredTools(server)).toEqual(
      [
        "edgeintel.domain.history.list",
        "edgeintel.domain.latest.get",
        "edgeintel.export.create",
        "edgeintel.hostname.validate",
        "edgeintel.inference.capabilities.get",
        "edgeintel.job.status.get",
        "edgeintel.provider.catalog.list",
        "edgeintel.scan.commercial_brief.get",
        "edgeintel.scan.create",
        "edgeintel.tunnel.observability.get",
        "edgeintel.zone.list",
      ].sort(),
    );
  });

  it("limits the registered tools to the granted scopes", () => {
    const server = buildMcpServer({} as never, {
      login: "owner-1",
      grantedScopes: [MCP_SCOPE_SCAN_READ],
    });

    expect(listRegisteredTools(server)).toEqual(
      [
        "edgeintel.domain.history.list",
        "edgeintel.domain.latest.get",
        "edgeintel.job.status.get",
        "edgeintel.scan.commercial_brief.get",
      ].sort(),
    );
  });

  it("does not register export creation without the export scope", () => {
    const readOnlyServer = buildMcpServer({} as never, {
      login: "owner-1",
      grantedScopes: [MCP_SCOPE_SCAN_READ],
    });

    const exportOnlyServer = buildMcpServer({} as never, {
      login: "owner-1",
      grantedScopes: [MCP_SCOPE_EXPORT_GENERATE],
    });

    expect(listRegisteredTools(readOnlyServer)).not.toContain("edgeintel.export.create");
    expect(listRegisteredTools(exportOnlyServer)).toEqual(["edgeintel.export.create"]);
  });
});
