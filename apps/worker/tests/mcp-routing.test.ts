import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {
    protected ctx: ExecutionContext;
    protected env: unknown;

    constructor(ctx: ExecutionContext, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
  DurableObject: class {
    protected ctx: DurableObjectState;
    protected env: unknown;

    constructor(ctx: DurableObjectState, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
  WorkflowEntrypoint: class {
    protected ctx: ExecutionContext;
    protected env: unknown;

    constructor(ctx: ExecutionContext, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const providerFetch = vi.fn(async () => new Response("mcp", { status: 202 }));

vi.mock("@cloudflare/workers-oauth-provider", () => ({
  default: class {
    fetch = providerFetch;
  },
}));

vi.mock("../src/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/auth")>(
    "../src/lib/auth",
  );
  return {
    ...actual,
    requireOperatorSession: vi.fn(async () =>
      new Response(JSON.stringify({ error: "blocked by auth" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      }),
    ),
  };
});

import EdgeIntelWorker from "../src/index";
import { requireOperatorSession } from "../src/lib/auth";

function createWorker() {
  const ctx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;

  return new EdgeIntelWorker(ctx, {} as never);
}

describe("mcp route dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends MCP requests through the OAuth provider instead of operator auth", async () => {
    const response = await createWorker().fetch(
      new Request("https://edgeintel.example.com/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "initialize",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requireOperatorSession)).not.toHaveBeenCalled();
  });

  it("routes OAuth metadata discovery through the MCP provider surface", async () => {
    const response = await createWorker().fetch(
      new Request(
        "https://edgeintel.example.com/.well-known/oauth-authorization-server",
      ),
    );

    expect(response.status).toBe(202);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requireOperatorSession)).not.toHaveBeenCalled();
  });

  it("keeps ordinary app routes on the existing EdgeIntel control-plane handler", async () => {
    const response = await createWorker().fetch(
      new Request("https://edgeintel.example.com/api/scan", {
        method: "POST",
        body: JSON.stringify({ domain: "example.com" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(providerFetch).not.toHaveBeenCalled();
    expect(vi.mocked(requireOperatorSession)).toHaveBeenCalledTimes(1);
  });
});
