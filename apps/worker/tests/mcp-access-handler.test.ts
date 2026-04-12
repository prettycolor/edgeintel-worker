import { describe, expect, it, vi } from "vitest";
import { handleMcpAccessRequest } from "../src/mcp/access-handler";

describe("mcp access handler", () => {
  it("treats a bare authorize request as a bad request instead of a server error", async () => {
    const response = await handleMcpAccessRequest(
      new Request("https://edgeintel.example.com/authorize"),
      {
        MCP_ACCESS_CLIENT_ID: "client-id",
        MCP_ACCESS_CLIENT_SECRET: "client-secret",
        MCP_ACCESS_TOKEN_URL: "https://team.cloudflareaccess.com/token",
        MCP_ACCESS_AUTHORIZATION_URL:
          "https://team.cloudflareaccess.com/authorization",
        MCP_ACCESS_JWKS_URL: "https://team.cloudflareaccess.com/jwks",
        OAUTH_PROVIDER: {
          parseAuthRequest: vi
            .fn()
            .mockRejectedValue(new Error("Missing OAuth request parameters.")),
        },
      } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing OAuth request parameters.",
    });
  });
});
