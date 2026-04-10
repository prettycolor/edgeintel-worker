import { describe, expect, it } from "vitest";
import {
  DEFAULT_MCP_SCOPES,
  MCP_SCOPE_SCAN_CREATE,
  MCP_SCOPE_SCAN_READ,
  hasMcpScope,
  normalizeMcpProps,
  resolveRequestedMcpScopes,
} from "../src/mcp/scopes";

describe("mcp scope helpers", () => {
  it("falls back to the default scope set when no scopes are requested", () => {
    expect(resolveRequestedMcpScopes(undefined)).toEqual(DEFAULT_MCP_SCOPES);
    expect(resolveRequestedMcpScopes([])).toEqual(DEFAULT_MCP_SCOPES);
  });

  it("filters unsupported scopes and de-duplicates the requested set", () => {
    expect(
      resolveRequestedMcpScopes([
        MCP_SCOPE_SCAN_READ,
        "unsupported.scope",
        MCP_SCOPE_SCAN_READ,
        MCP_SCOPE_SCAN_CREATE,
      ]),
    ).toEqual([MCP_SCOPE_SCAN_READ, MCP_SCOPE_SCAN_CREATE]);
  });

  it("normalizes operator props and preserves explicit grants", () => {
    expect(
      normalizeMcpProps({
        email: "owner@example.com",
        login: "user-123",
        grantedScopes: [MCP_SCOPE_SCAN_READ],
      }),
    ).toEqual({
      email: "owner@example.com",
      name: null,
      login: "user-123",
      grantedScopes: [MCP_SCOPE_SCAN_READ],
    });
  });

  it("checks granted scopes against normalized props", () => {
    const props = normalizeMcpProps({
      login: "user-123",
      grantedScopes: [MCP_SCOPE_SCAN_READ],
    });

    expect(hasMcpScope(props, MCP_SCOPE_SCAN_READ)).toBe(true);
    expect(hasMcpScope(props, MCP_SCOPE_SCAN_CREATE)).toBe(false);
  });
});
