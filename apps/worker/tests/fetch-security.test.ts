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

vi.mock("../src/lib/repository", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/repository")>(
    "../src/lib/repository",
  );
  return {
    ...actual,
    getPairingSession: vi.fn(),
  };
});

import EdgeIntelWorker from "../src/index";
import { requireOperatorSession } from "../src/lib/auth";
import { getPairingSession } from "../src/lib/repository";

function createWorker() {
  const ctx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;

  return new EdgeIntelWorker(ctx, {} as never);
}

describe("fetch security boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks scan creation behind operator auth", async () => {
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
    expect(vi.mocked(requireOperatorSession)).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      error: "blocked by auth",
    });
  });

  it("allows pairing exchange to bypass operator auth and fail on the pairing token instead", async () => {
    vi.mocked(getPairingSession).mockResolvedValue({
      id: "pairing-1",
      tunnelId: "tunnel-1",
      issuedBySubject: "user-1",
      issuedByEmail: "owner@example.com",
      status: "pending",
      pairingTokenHash: "expected-hash",
      connectorTokenHash: null,
      connectorName: null,
      connectorVersion: null,
      exchangeCount: 0,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      exchangedAt: null,
      connectorExpiresAt: null,
      lastSeenAt: null,
      revokedAt: null,
      expiredAt: null,
      metadataJson: "{}",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await createWorker().fetch(
      new Request(
        "https://edgeintel.example.com/api/pairings/pairing-1/exchange",
        {
          method: "POST",
          body: JSON.stringify({
            pairingToken: "wrong-token",
          }),
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(vi.mocked(requireOperatorSession)).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "Pairing token is invalid.",
    });
  });
});
