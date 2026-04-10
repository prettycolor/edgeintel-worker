import { describe, expect, it } from "vitest";
import { renderTunnelControlPlaneApp } from "../src/lib/tunnel-app-shell";

describe("tunnel control plane app shell", () => {
  it("renders the worker-served tunnel workspace with expected API hooks", () => {
    const markup = renderTunnelControlPlaneApp({
      tunnelsEndpoint: "/api/tunnels",
      providersEndpoint: "/api/settings/providers",
    });

    expect(markup).toContain("EdgeIntel Tunnel Control Plane");
    expect(markup).toContain(
      'window.EDGEINTEL_TUNNEL_APP = {"tunnelsEndpoint":"/api/tunnels","providersEndpoint":"/api/settings/providers"};',
    );
    expect(markup).toContain('id="route-form"');
    expect(markup).toContain('id="route-list"');
    expect(markup).toContain("Rotate bootstrap");
    expect(markup).toContain("Save route");
  });
});
