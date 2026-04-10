import { describe, expect, it } from "vitest";
import { routeRequiresOperatorSession } from "../src/lib/route-auth";

describe("route auth policy", () => {
  it("keeps health unauthenticated", () => {
    expect(
      routeRequiresOperatorSession(new Request("https://edgeintel.example.com/health"), "/health"),
    ).toBe(false);
  });

  it("keeps pairing exchange and connector heartbeat unauthenticated", () => {
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/pairings/pairing-1/exchange", {
          method: "POST",
        }),
        "/api/pairings/pairing-1/exchange",
      ),
    ).toBe(false);

    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/tunnels/tunnel-1/heartbeat", {
          method: "POST",
        }),
        "/api/tunnels/tunnel-1/heartbeat",
      ),
    ).toBe(false);
  });

  it("protects app-shell, scan, report, export, and settings APIs", () => {
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/app/providers"),
        "/app/providers",
      ),
    ).toBe(true);
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/scan", { method: "POST" }),
        "/api/scan",
      ),
    ).toBe(true);
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/scans/run-1/commercial-brief"),
        "/api/scans/run-1/commercial-brief",
      ),
    ).toBe(true);
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/exports/export-1"),
        "/api/exports/export-1",
      ),
    ).toBe(true);
    expect(
      routeRequiresOperatorSession(
        new Request("https://edgeintel.example.com/api/settings/providers"),
        "/api/settings/providers",
      ),
    ).toBe(true);
  });
});
