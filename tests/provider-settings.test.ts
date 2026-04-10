import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import {
  buildOpenAiCompatibleModelsUrl,
  normalizeProviderSettingsInput,
  serializeProviderSetting,
  testProviderConnection,
} from "../src/lib/provider-settings";
import type { PersistedProviderSetting } from "../src/types";

const provider: PersistedProviderSetting = {
  id: "provider-1",
  kind: "local-direct",
  providerCode: "ollama",
  displayName: "Ollama tunnel route",
  baseUrl: "https://ollama.example.com",
  defaultModel: "gemma3:27b",
  usesAiGateway: false,
  oauthConnected: false,
  status: "ready",
  secretConfigured: true,
  secretEnvelopeJson: null,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestResultJson: null,
  metadataJson: JSON.stringify({ route: "local-direct" }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider settings helpers", () => {
  it("normalizes provider settings input and defaults known provider URLs", () => {
    const normalized = normalizeProviderSettingsInput({
      kind: "hosted-api-key",
      providerCode: "openai",
      displayName: "OpenAI",
      defaultModel: "gpt-5.4",
      usesAiGateway: true,
      secret: {
        apiKey: "test-key",
      },
    });

    expect(normalized.baseUrl).toBe("https://api.openai.com/v1");
    expect(normalized.providerCode).toBe("openai");
    expect(normalized.secret?.apiKey).toBe("test-key");
  });

  it("builds a models endpoint for OpenAI-compatible providers", () => {
    expect(buildOpenAiCompatibleModelsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/models",
    );
    expect(buildOpenAiCompatibleModelsUrl("https://ollama.example.com")).toBe(
      "https://ollama.example.com/v1/models",
    );
  });

  it("serializes provider settings without leaking encrypted secrets", () => {
    const view = serializeProviderSetting({
      ...provider,
      lastTestResultJson: JSON.stringify({
        status: "passed",
        message: "ok",
        latencyMs: 120,
        transport: "openai-compatible-models",
        targetUrl: "https://ollama.example.com/v1/models",
        providerCode: "ollama",
        model: "gemma3:27b",
        details: {},
        testedAt: new Date().toISOString(),
      }),
    });

    expect(view.secretConfigured).toBe(true);
    expect("secretEnvelopeJson" in view).toBe(false);
    expect(view.lastTestResult?.status).toBe("passed");
  });

  it("tests an OpenAI-compatible provider with auth and Access headers", async () => {
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [{ id: "gemma3:27b" }] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await testProviderConnection(
      {} as Env,
      provider,
      {
        apiKey: "ollama-demo",
        accessClientId: "access-id",
        accessClientSecret: "access-secret",
      },
      {},
    );

    expect(result.status).toBe("passed");
    expect(result.transport).toBe("openai-compatible-models");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    const targetUrl = call?.[0] as string;
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(targetUrl).toBe("https://ollama.example.com/v1/models");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ollama-demo");
    expect(headers["CF-Access-Client-Id"]).toBe("access-id");
    expect(headers["CF-Access-Client-Secret"]).toBe("access-secret");
  });

  it("tests a Workers AI provider through the AI binding", async () => {
    const run = vi.fn(async () => "pong");

    const result = await testProviderConnection(
      {
        AI: {
          run,
        },
        AI_GATEWAY_MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      } as unknown as Env,
      {
        ...provider,
        kind: "hosted-api-key",
        providerCode: "workers-ai",
        baseUrl: null,
      },
      null,
      {},
    );

    expect(result.status).toBe("passed");
    expect(result.transport).toBe("workers-ai-binding");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
