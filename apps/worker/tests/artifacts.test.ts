import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { insertArtifactMock } = vi.hoisted(() => ({
  insertArtifactMock: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/repository", () => ({
  insertArtifact: insertArtifactMock,
}));

import { generateArtifacts } from "../src/lib/artifacts";

describe("artifact generation", () => {
  beforeEach(() => {
    insertArtifactMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("records manifest evidence when browser rendering is unavailable", async () => {
    const put = vi.fn(
      async (_key: string, _value: unknown, _options?: unknown) => undefined,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html><title>Example</title></html>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            server: "edgeintel-test",
          },
        })),
    );

    const artifacts = await generateArtifacts(
      {
        EDGE_ARTIFACTS: { put },
        BROWSER_RENDERING_REST_BASE_URL: "",
        BROWSER_RENDERING_API_TOKEN: "",
      } as never,
      "run-1",
      "example.com",
      "https://example.com",
    );

    expect(artifacts.map((artifact) => artifact.kind)).toEqual([
      "response-metadata",
      "raw-html",
      "artifact-manifest",
    ]);
    expect(artifacts[0]?.objectKey).toMatch(/response-metadata-.*\.json$/);
    expect(artifacts[1]?.objectKey).toMatch(/raw-html-.*\.html$/);
    expect(artifacts[2]?.objectKey).toMatch(/artifact-manifest-.*\.json$/);

    const manifestCall = put.mock.calls.find((call) =>
      String(call[0]).includes("artifact-manifest"),
    );
    expect(manifestCall).toBeDefined();

    const manifest = JSON.parse(String(manifestCall?.[1]));
    expect(manifest.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "response-metadata",
          status: "captured",
        }),
        expect.objectContaining({
          kind: "raw-html",
          status: "captured",
        }),
        expect.objectContaining({
          kind: "rendered-markdown",
          status: "skipped",
        }),
        expect.objectContaining({
          kind: "screenshot",
          status: "skipped",
        }),
      ]),
    );
  });

  it("captures browser-rendered markdown and screenshot artifacts when configured", async () => {
    const put = vi.fn(
      async (_key: string, _value: unknown, _options?: unknown) => undefined,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/markdown")) {
          return new Response("# Example", {
            status: 200,
            headers: {
              "content-type": "text/markdown; charset=utf-8",
            },
          });
        }

        if (url.endsWith("/screenshot")) {
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: {
              "content-type": "image/png",
            },
          });
        }

        return new Response("<html><title>Example</title></html>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        });
      }),
    );

    const artifacts = await generateArtifacts(
      {
        EDGE_ARTIFACTS: { put },
        BROWSER_RENDERING_REST_BASE_URL: "https://browser.example.com",
        BROWSER_RENDERING_API_TOKEN: "token",
      } as never,
      "run-2",
      "example.com",
      "https://example.com",
    );

    expect(artifacts.map((artifact) => artifact.kind)).toEqual([
      "response-metadata",
      "raw-html",
      "rendered-markdown",
      "screenshot",
      "artifact-manifest",
    ]);
    expect(
      artifacts.find((artifact) => artifact.kind === "rendered-markdown")?.objectKey,
    ).toMatch(/rendered-markdown-.*\.md$/);
    expect(
      artifacts.find((artifact) => artifact.kind === "screenshot")?.objectKey,
    ).toMatch(/screenshot-.*\.png$/);
  });
});
