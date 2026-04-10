import { describe, expect, it } from "vitest";
import { renderProviderControlPlaneApp } from "../src/lib/app-shell";

describe("provider control plane app shell", () => {
  it("renders the worker-served provider workspace with the expected API hooks", () => {
    const markup = renderProviderControlPlaneApp({
      providersEndpoint: "/api/settings/providers",
      providerCatalogEndpoint: "/api/settings/provider-catalog",
    });

    expect(markup).toContain("EdgeIntel Provider Control Plane");
    expect(markup).toContain(
      'window.EDGEINTEL_APP = {"providersEndpoint":"/api/settings/providers","providerCatalogEndpoint":"/api/settings/provider-catalog"};',
    );
    expect(markup).toContain('id="provider-form"');
    expect(markup).toContain('id="provider-list"');
    expect(markup).toContain('id="providerPreset"');
    expect(markup).toContain('id="authStrategy"');
    expect(markup).toContain('id="clear-provider-secret"');
    expect(markup).toContain("Run test");
    expect(markup).toContain("Save provider");
  });
});
