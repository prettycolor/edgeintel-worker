import { describe, expect, it } from "vitest";
import {
  renderScanWorkspaceApp,
  renderWorkspaceOverviewApp,
} from "../src/lib/workspace-app-shell";

describe("workspace app shells", () => {
  it("renders the overview workspace with real route links and data hooks", () => {
    const markup = renderWorkspaceOverviewApp({
      sessionEndpoint: "/api/session",
      providersEndpoint: "/api/settings/providers",
      tunnelsEndpoint: "/api/tunnels",
      recentScansEndpoint: "/api/scans/recent",
    });

    expect(markup).toContain("EdgeIntel Operator Workspace");
    expect(markup).toContain(
      'window.EDGEINTEL_WORKSPACE_APP = {"sessionEndpoint":"/api/session","providersEndpoint":"/api/settings/providers","tunnelsEndpoint":"/api/tunnels","recentScansEndpoint":"/api/scans/recent"};',
    );
    expect(markup).toContain('href="/app/scans"');
    expect(markup).toContain('href="/app/exports"');
    expect(markup).toContain('id="overview-providers"');
    expect(markup).toContain('id="overview-routes"');
    expect(markup).toContain('id="overview-scans"');
  });

  it("renders the scan workspace with export studio controls", () => {
    const markup = renderScanWorkspaceApp({
      createScanEndpoint: "/api/scan",
      recentScansEndpoint: "/api/scans/recent",
      scanEndpointBase: "/api/scans",
      domainEndpointBase: "/api/domains",
      exportEndpointBase: "/api/exports",
      initialView: "exports",
    });

    expect(markup).toContain("EdgeIntel Export Studio");
    expect(markup).toContain(
      'window.EDGEINTEL_SCAN_WORKSPACE = {"createScanEndpoint":"/api/scan","recentScansEndpoint":"/api/scans/recent","scanEndpointBase":"/api/scans","domainEndpointBase":"/api/domains","exportEndpointBase":"/api/exports","initialView":"exports"};',
    );
    expect(markup).toContain('id="scan-form"');
    expect(markup).toContain('id="scan-run-list"');
    expect(markup).toContain('id="scan-detail"');
    expect(markup).toContain('id="export-studio"');
    expect(markup).toContain('data-export-format="terraform"');
  });
});
