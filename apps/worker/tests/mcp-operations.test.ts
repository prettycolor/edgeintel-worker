import { describe, expect, it } from "vitest";
import { redactTunnelObservabilityForMcp } from "../src/mcp/operations";

describe("mcp tunnel observability redaction", () => {
  it("removes local bootstrap details while preserving operator-safe diagnostics", () => {
    const view = redactTunnelObservabilityForMcp({
      tunnel: {
        id: "tunnel-1",
        providerSettingId: "provider-1",
        cloudflareTunnelId: "cf-tunnel-1",
        cloudflareTunnelName: "edgeintel-demo",
        cloudflareZoneId: "zone-1",
        publicHostname: "llm.example.com",
        localServiceUrl: "https://localhost:11434",
        accessAppId: "access-app-1",
        accessPolicyId: "policy-1",
        accessServiceTokenId: "service-token-1",
        dnsRecordId: "dns-1",
        status: "ready",
        connectorStatus: "connected",
        lastConnectorHeartbeatAt: "2026-04-10T17:00:00.000Z",
        lastTunnelHealthAt: "2026-04-10T17:00:10.000Z",
        lastTestedAt: "2026-04-10T17:00:10.000Z",
        lastTestStatus: "warning",
        lastTestResultJson: null,
        accessProtected: true,
        secretConfigured: true,
        metadataJson: JSON.stringify({ providerCode: "ollama" }),
        secretEnvelopeJson: JSON.stringify({
          tunnelToken: "secret-token",
          accessClientId: "client-id",
        }),
        createdAt: "2026-04-10T16:45:00.000Z",
        updatedAt: "2026-04-10T17:00:10.000Z",
      },
      events: [
        {
          id: "event-1",
          tunnelId: "tunnel-1",
          kind: "connector.heartbeat",
          level: "info",
          summary: "Connector heartbeat accepted",
          detailJson: JSON.stringify({ version: "1.2.0" }),
          createdAt: "2026-04-10T17:00:00.000Z",
        },
      ],
      testRuns: [
        {
          id: "test-1",
          tunnelId: "tunnel-1",
          status: "warning",
          resultJson: JSON.stringify({
            status: "warning",
            latencyMs: 240,
            details: {
              runtime: {
                status: 502,
              },
            },
          }),
          testedAt: "2026-04-10T17:00:10.000Z",
          createdAt: "2026-04-10T17:00:10.000Z",
        },
      ],
      lastKnownGood: {
        id: "test-0",
        tunnelId: "tunnel-1",
        status: "passed",
        resultJson: JSON.stringify({
          status: "passed",
          latencyMs: 110,
          details: {
            runtime: {
              status: 200,
            },
          },
        }),
        testedAt: "2026-04-10T16:50:00.000Z",
        createdAt: "2026-04-10T16:50:00.000Z",
      },
    });

    expect(view.tunnel).toMatchObject({
      id: "tunnel-1",
      publicHostname: "llm.example.com",
      cloudflareTunnelId: "cf-tunnel-1",
      accessProtected: true,
      secretConfigured: true,
    });
    expect(view.tunnel).not.toHaveProperty("localServiceUrl");
    expect(view.tunnel).not.toHaveProperty("secretEnvelopeJson");
    expect(view.observability.failureDelta).toMatchObject({
      previousRuntimeStatus: 200,
      currentRuntimeStatus: 502,
    });
  });
});
