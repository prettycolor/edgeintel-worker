import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { requireOperatorSession } from "../src/lib/auth";

describe("operator session auth", () => {
  it("allows an explicit localhost dev bypass", async () => {
    const result = await requireOperatorSession(
      new Request("http://localhost:8787/app/tunnels", {
        headers: {
          "x-edgeintel-dev-email": "owner@example.com",
          "x-edgeintel-dev-name": "Owner",
        },
      }),
      {
        ACCESS_ALLOW_DEV_BYPASS: "true",
      } as Env,
    );

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) {
      throw new Error("Expected an operator session, received a Response.");
    }

    expect(result.mode).toBe("dev-bypass");
    expect(result.email).toBe("owner@example.com");
    expect(result.name).toBe("Owner");
  });

  it("rejects control-plane requests without an Access JWT", async () => {
    const result = await requireOperatorSession(
      new Request("https://edgeintel.example.com/app/tunnels"),
      {
        ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        ACCESS_AUD: "aud-value",
      } as Env,
    );

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      throw new Error("Expected a Response for a missing JWT.");
    }

    expect(result.status).toBe(401);
    await expect(result.json()).resolves.toMatchObject({
      error: "Missing Cf-Access-Jwt-Assertion header.",
    });
  });
});
