import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import {
  buildTunnelConnectorBootstrap,
  listCloudflareZones,
  normalizeTunnelSettingsInput,
  provisionTunnelResources,
  testTunnelConnection,
  validateTunnelHostname,
} from "../src/lib/tunnels";
import type { PersistedProviderSetting, PersistedTunnelRecord } from "../src/types";

function createEnv(): Env {
  return {
    CLOUDFLARE_ACCOUNT_ID: "acct-123",
    CLOUDFLARE_API_TOKEN: "api-token",
    CLOUDFLARE_ZONE_ID: "zone-123",
  } as Env;
}

function cfResponse(result: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      errors: [],
      messages: [],
      result,
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}

const localProvider: PersistedProviderSetting = {
  id: "provider-1",
  kind: "local-direct",
  providerCode: "ollama",
  displayName: "Local Ollama",
  baseUrl: "https://llm.example.com",
  defaultModel: "gemma3:27b",
  authStrategy: "none",
  usesAiGateway: false,
  oauthConnected: false,
  status: "ready",
  secretConfigured: true,
  secretEnvelopeJson: null,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestResultJson: null,
  metadataJson: "{}",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const tunnelRecord: PersistedTunnelRecord = {
  id: "tunnel-record-1",
  providerSettingId: "provider-1",
  cloudflareTunnelId: "cf-tunnel-1",
  cloudflareTunnelName: "edgeintel-demo",
  cloudflareZoneId: "zone-123",
  publicHostname: "llm.example.com",
  localServiceUrl: "http://localhost:11434",
  accessProtected: true,
  accessAppId: "access-app-1",
  accessPolicyId: "access-policy-1",
  accessServiceTokenId: "service-token-1",
  dnsRecordId: "dns-1",
  secretConfigured: true,
  secretEnvelopeJson: null,
  connectorStatus: "awaiting_connector",
  status: "ready",
  lastConnectorHeartbeatAt: null,
  lastTunnelHealthAt: null,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestResultJson: null,
  metadataJson: "{}",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tunnel helpers", () => {
  it("normalizes tunnel input with env defaults and generated name", () => {
    const normalized = normalizeTunnelSettingsInput(
      {
        publicHostname: "LLM.EXAMPLE.COM",
        localServiceUrl: "http://localhost:11434/",
        accessProtected: true,
      },
      createEnv(),
    );

    expect(normalized.cloudflareZoneId).toBe("zone-123");
    expect(normalized.publicHostname).toBe("llm.example.com");
    expect(normalized.localServiceUrl).toBe("http://localhost:11434");
    expect(normalized.tunnelName).toContain("edgeintel-llm-example-com");
  });

  it("rejects local service URLs with embedded credentials", () => {
    expect(() =>
      normalizeTunnelSettingsInput(
        {
          publicHostname: "llm.example.com",
          localServiceUrl: "http://user:secret@localhost:11434",
        },
        createEnv(),
      ),
    ).toThrow("localServiceUrl must not embed credentials in the URL.");
  });

  it("builds a connector bootstrap payload with tunnel and Access secrets", () => {
    const bootstrap = buildTunnelConnectorBootstrap(tunnelRecord, {
      tunnelToken: "secret-token",
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    });

    expect(bootstrap.command).toBe("cloudflared tunnel run --token secret-token");
    expect(bootstrap.launchArgs).toEqual([
      "tunnel",
      "run",
      "--token",
      "secret-token",
    ]);
    expect(bootstrap.accessHeaders["CF-Access-Client-Id"]).toBe("client-id");
    expect(bootstrap.accessHeaders["CF-Access-Client-Secret"]).toBe("client-secret");
  });

  it("provisions a remotely managed tunnel, dns route, and Access resources", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const parsed = new URL(url);

      if (parsed.pathname === "/client/v4/accounts/acct-123/cfd_tunnel" && init?.method === "POST") {
        return cfResponse({
          id: "cf-tunnel-1",
          name: "edgeintel-llm-example-com",
        });
      }

      if (
        parsed.pathname ===
          "/client/v4/accounts/acct-123/cfd_tunnel/cf-tunnel-1/configurations" &&
        init?.method === "PUT"
      ) {
        return cfResponse({});
      }

      if (
        parsed.pathname ===
          "/client/v4/accounts/acct-123/cfd_tunnel/cf-tunnel-1/token" &&
        init?.method === "GET"
      ) {
        return cfResponse({
          token: "tunnel-token-123",
        });
      }

      if (
        parsed.pathname === "/client/v4/zones/zone-123/dns_records" &&
        init?.method === "GET"
      ) {
        return cfResponse([]);
      }

      if (
        parsed.pathname === "/client/v4/zones/zone-123/dns_records" &&
        init?.method === "POST"
      ) {
        return cfResponse({
          id: "dns-1",
        });
      }

      if (
        parsed.pathname === "/client/v4/accounts/acct-123/access/policies" &&
        init?.method === "POST"
      ) {
        return cfResponse({
          id: "policy-1",
        });
      }

      if (
        parsed.pathname === "/client/v4/accounts/acct-123/access/service_tokens" &&
        init?.method === "POST"
      ) {
        return cfResponse({
          id: "service-token-1",
          client_id: "access-client-id",
          client_secret: "access-client-secret",
        });
      }

      if (
        parsed.pathname === "/client/v4/accounts/acct-123/access/apps" &&
        init?.method === "POST"
      ) {
        return cfResponse({
          id: "access-app-1",
        });
      }

      throw new Error(`Unexpected fetch: ${init?.method} ${parsed.pathname}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await provisionTunnelResources(createEnv(), {
      providerSettingId: "provider-1",
      cloudflareZoneId: "zone-123",
      publicHostname: "llm.example.com",
      tunnelName: "edgeintel-llm-example-com",
      localServiceUrl: "http://localhost:11434",
      accessProtected: true,
      status: "draft",
      connectorStatus: "unpaired",
      metadata: {
        source: "test",
      },
    });

    expect(result.cloudflareTunnelId).toBe("cf-tunnel-1");
    expect(result.dnsRecordId).toBe("dns-1");
    expect(result.accessPolicyId).toBe("policy-1");
    expect(result.accessServiceTokenId).toBe("service-token-1");
    expect(result.accessAppId).toBe("access-app-1");
    expect(result.secrets?.tunnelToken).toBe("tunnel-token-123");
    expect(result.secrets?.accessClientId).toBe("access-client-id");
    expect(result.secrets?.accessClientSecret).toBe("access-client-secret");

    const dnsCreateCall = fetchMock.mock.calls.find((call) => {
      const url = new URL(String(call[0]));
      return (
        url.pathname === "/client/v4/zones/zone-123/dns_records" &&
        (call[1] as RequestInit | undefined)?.method === "POST"
      );
    });
    expect(dnsCreateCall).toBeTruthy();
    expect(String((dnsCreateCall?.[1] as RequestInit).body)).toContain(
      "\"content\":\"cf-tunnel-1.cfargotunnel.com\"",
    );
  });

  it("tests the public tunnel with Cloudflare control-plane and runtime probes", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (
        url === "https://api.cloudflare.com/client/v4/accounts/acct-123/cfd_tunnel/cf-tunnel-1" &&
        init?.method === "GET"
      ) {
        return cfResponse({
          status: "healthy",
          remote_config: true,
          connections: [{ client_id: "connector-1" }],
        });
      }

      if (url === "https://llm.example.com/v1/models" && init?.method === "GET") {
        return new Response(JSON.stringify({ data: [{ id: "gemma3:27b" }] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      throw new Error(`Unexpected fetch: ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testTunnelConnection(
      createEnv(),
      tunnelRecord,
      {
        tunnelToken: "token",
        accessClientId: "client-id",
        accessClientSecret: "client-secret",
      },
      localProvider,
      {},
    );

    expect(result.status).toBe("passed");
    expect(result.message).toContain("public hostname successfully");

    const runtimeCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).startsWith("https://llm.example.com/v1/models"),
    );
    const headers = (runtimeCall?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["CF-Access-Client-Id"]).toBe("client-id");
    expect(headers["CF-Access-Client-Secret"]).toBe("client-secret");
  });

  it("lists Cloudflare zones and marks the configured default zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const parsed = new URL(typeof input === "string" ? input : input.toString());

        if (parsed.pathname === "/client/v4/zones") {
          return cfResponse([
            {
              id: "zone-123",
              name: "example.com",
              status: "active",
              plan: { name: "Pro" },
            },
            {
              id: "zone-456",
              name: "demo.net",
              status: "active",
              plan: { name: "Free" },
            },
          ]);
        }

        throw new Error(`Unexpected fetch: ${parsed.pathname}`);
      }),
    );

    const zones = await listCloudflareZones(createEnv());

    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({
      id: "zone-456",
      name: "demo.net",
      isDefault: false,
    });
    expect(zones[1]).toMatchObject({
      id: "zone-123",
      name: "example.com",
      isDefault: true,
    });
  });

  it("validates a hostname and reports conflicting DNS records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const parsed = new URL(typeof input === "string" ? input : input.toString());

        if (
          parsed.pathname === "/client/v4/zones" &&
          (init?.method ?? "GET") === "GET"
        ) {
          return cfResponse([
            {
              id: "zone-123",
              name: "example.com",
              status: "active",
            },
          ]);
        }

        if (
          parsed.pathname === "/client/v4/zones/zone-123/dns_records" &&
          (init?.method ?? "GET") === "GET"
        ) {
          return cfResponse([
            {
              id: "record-1",
              name: "llm.example.com",
              type: "CNAME",
              content: "other-target.example.net",
              proxied: true,
            },
          ]);
        }

        throw new Error(`Unexpected fetch: ${parsed.pathname}`);
      }),
    );

    const result = await validateTunnelHostname(createEnv(), {
      publicHostname: "llm.example.com",
      existingTunnelId: "cf-tunnel-1",
    });

    expect(result.status).toBe("warning");
    expect(result.zone?.id).toBe("zone-123");
    expect(result.matchedBy).toBe("suffix-match");
    expect(result.conflicts[0]).toMatchObject({
      type: "CNAME",
      content: "other-target.example.net",
    });
  });
});
