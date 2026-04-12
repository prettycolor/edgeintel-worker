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
    requireOperatorSession: vi.fn(async () => ({
      mode: "access",
      subject: "operator-1",
      email: "care@okaybabe.co",
      name: "Care",
      issuer: "https://issuer.example.com",
      audience: ["edgeintel"],
      groups: [],
      issuedAt: null,
      expiresAt: null,
    })),
  };
});

const mockRun = {
  id: "run-1",
  jobId: "job-1",
  domain: "example.com",
  status: "completed",
  sourceUrl: "https://example.com",
  finalUrl: "https://www.example.com",
  scanSummaryJson: JSON.stringify({
    finalUrl: "https://www.example.com",
    edgeProvider: { provider: "Cloudflare" },
    dnsProvider: { provider: "Cloudflare DNS" },
  }),
  rawResultJson: JSON.stringify({
    findings: [{ id: "finding-1" }, { id: "finding-2" }],
    recommendations: [{ id: "rec-1" }],
    modules: {
      dns: { ok: true },
      waf: { ok: true },
    },
  }),
  failureReason: null,
  createdAt: "2026-04-12T00:00:00.000Z",
  updatedAt: "2026-04-12T00:05:00.000Z",
  startedAt: "2026-04-12T00:00:15.000Z",
  completedAt: "2026-04-12T00:02:00.000Z",
} as const;

vi.mock("../src/lib/repository", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/repository")>(
    "../src/lib/repository",
  );
  return {
    ...actual,
    listRecentScanRuns: vi.fn(async () => [mockRun]),
    getScanRun: vi.fn(async () => mockRun),
    listExportRecordsForRun: vi.fn(async () => [
      {
        id: "export-1",
        scanRunId: "run-1",
        format: "markdown",
        status: "ready",
        objectKey: "exports/example.com/run-1/markdown-1.md",
        contentType: "text/markdown; charset=utf-8",
        payloadJson: JSON.stringify({ generatedAt: "2026-04-12T00:03:00.000Z" }),
        createdAt: "2026-04-12T00:03:00.000Z",
      },
    ]),
  };
});

import EdgeIntelWorker from "../src/index";

function createWorker() {
  const ctx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;

  return new EdgeIntelWorker(ctx, {} as never);
}

describe("workspace routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the overview route", async () => {
    const response = await createWorker().fetch(
      new Request("https://edgeintel.example.com/app"),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("EdgeIntel Operator Workspace");
  });

  it("renders scan and export workspaces separately", async () => {
    const scanResponse = await createWorker().fetch(
      new Request("https://edgeintel.example.com/app/scans"),
    );
    const exportResponse = await createWorker().fetch(
      new Request("https://edgeintel.example.com/app/exports"),
    );

    expect(scanResponse.status).toBe(200);
    expect(exportResponse.status).toBe(200);
    await expect(scanResponse.text()).resolves.toContain("EdgeIntel Scan Workspace");
    await expect(exportResponse.text()).resolves.toContain("EdgeIntel Export Studio");
  });

  it("lists recent scans for the scan workspace", async () => {
    const response = await createWorker().fetch(
      new Request("https://edgeintel.example.com/api/scans/recent"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scans: [
        {
          run: {
            id: "run-1",
            domain: "example.com",
          },
          metrics: {
            findingCount: 2,
            recommendationCount: 1,
          },
        },
      ],
    });
  });

  it("lists exports for a specific scan run", async () => {
    const response = await createWorker().fetch(
      new Request("https://edgeintel.example.com/api/scans/run-1/exports"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scanRun: {
        run: {
          id: "run-1",
        },
      },
      exports: [
        {
          id: "export-1",
          downloadUrl: "/api/exports/export-1?download=1",
        },
      ],
    });
  });
});
