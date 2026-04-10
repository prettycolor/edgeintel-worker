import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "../env";
import type { ExportFormat } from "../types";
import {
  createExportArtifact,
  createBoundedScanJob,
  getCommercialBriefView,
  getDomainHistoryView,
  getInferenceCapabilityView,
  getLatestDomainPosture,
  getScanJobStatus,
  getTunnelObservabilityView,
  listProviderCatalogView,
  listZoneView,
  validateHostnameView,
} from "./operations";
import {
  DEFAULT_MCP_SCOPES,
  MCP_SCOPE_CATALOG_READ,
  MCP_SCOPE_EXPORT_GENERATE,
  MCP_SCOPE_HOSTNAME_VALIDATE,
  MCP_SCOPE_SCAN_CREATE,
  MCP_SCOPE_SCAN_READ,
  MCP_SCOPE_TUNNEL_READ,
  MCP_SCOPE_ZONE_READ,
  type EdgeIntelMcpProps,
  hasMcpScope,
  normalizeMcpProps,
} from "./scopes";

function renderStructuredToolResult<T extends Record<string, unknown>>(
  summary: string,
  structuredContent: T,
) {
  return {
    content: [
      {
        type: "text" as const,
        text: `${summary}\n\n${JSON.stringify(structuredContent, null, 2)}`,
      },
    ],
    structuredContent,
  };
}

function buildMcpServer(env: Env, rawProps: Record<string, unknown> | null | undefined) {
  const props = normalizeMcpProps(rawProps);
  const server = new McpServer({
    name: "edgeintel-mcp",
    version: "0.1.0",
  });

  if (hasMcpScope(props, MCP_SCOPE_SCAN_CREATE)) {
    server.tool(
      "edgeintel.scan.create",
      "Create a bounded EdgeIntel posture scan job for one or more public domains.",
      {
        domain: z.string().optional().describe("Single domain to scan."),
        domains: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Optional batch of public domains to scan."),
      },
      {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "Create EdgeIntel Scan",
      },
      async ({ domain, domains }) => {
        const created = await createBoundedScanJob(env, { domain, domains });
        return renderStructuredToolResult(
          `Created scan job ${created.jobId} for ${created.domains.length} domain(s).`,
          created,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_SCAN_READ)) {
    server.tool(
      "edgeintel.job.status.get",
      "Get current status, run state, and batch progress for an existing EdgeIntel job.",
      {
        jobId: z.string().describe("EdgeIntel scan job identifier."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "Get EdgeIntel Job Status",
      },
      async ({ jobId }) => {
        const job = await getScanJobStatus(env, jobId);
        return renderStructuredToolResult(
          `Loaded job ${jobId} with status ${job.job.status}.`,
          job,
        );
      },
    );

    server.tool(
      "edgeintel.domain.latest.get",
      "Get the latest persisted posture snapshot for a domain.",
      {
        domain: z.string().describe("Domain to look up."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "Get Latest Domain Posture",
      },
      async ({ domain }) => {
        const latest = await getLatestDomainPosture(env, domain);
        return renderStructuredToolResult(
          `Loaded the latest persisted posture for ${latest.domain}.`,
          latest,
        );
      },
    );

    server.tool(
      "edgeintel.domain.history.list",
      "List the recent scan history and posture deltas for a domain.",
      {
        domain: z.string().describe("Domain to inspect."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "List Domain History",
      },
      async ({ domain }) => {
        const history = await getDomainHistoryView(env, domain);
        return renderStructuredToolResult(
          `Loaded ${history.history.length} historical entries for ${history.domain}.`,
          history,
        );
      },
    );

    server.tool(
      "edgeintel.scan.commercial_brief.get",
      "Get the SE-grade Cloudflare fit and commercial brief for a completed scan run.",
      {
        scanRunId: z.string().describe("Scan run identifier."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "Get Commercial Brief",
      },
      async ({ scanRunId }) => {
        const brief = await getCommercialBriefView(env, scanRunId);
        return renderStructuredToolResult(
          `Loaded the commercial brief for scan run ${scanRunId}.`,
          brief,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_EXPORT_GENERATE)) {
    server.tool(
      "edgeintel.export.create",
      "Generate a persisted export bundle for a scan run.",
      {
        scanRunId: z.string().describe("Scan run identifier."),
        format: z
          .enum(["markdown", "json", "terraform", "cf-api"] satisfies ExportFormat[])
          .default("markdown")
          .describe("Export format to generate."),
      },
      {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        title: "Create Scan Export",
      },
      async ({ scanRunId, format }) => {
        const exportView = await createExportArtifact(env, scanRunId, format);
        return renderStructuredToolResult(
          `Generated ${format} export ${exportView.exportId} for scan run ${scanRunId}.`,
          exportView,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_CATALOG_READ)) {
    server.tool(
      "edgeintel.provider.catalog.list",
      "List the supported provider presets, auth strategies, and connection tests.",
      {
        includeDefaultScopes: z
          .boolean()
          .optional()
          .describe("Include the default MCP scopes in the response."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "List Provider Catalog",
      },
      async ({ includeDefaultScopes }) => {
        const catalog = listProviderCatalogView();
        const result = includeDefaultScopes
          ? {
              ...catalog,
              defaultMcpScopes: DEFAULT_MCP_SCOPES,
            }
          : catalog;
        return renderStructuredToolResult(
          `Loaded ${catalog.catalog.length} provider catalog entries.`,
          result,
        );
      },
    );

    server.tool(
      "edgeintel.inference.capabilities.get",
      "Inspect the current hosted and local inference capability routes configured for EdgeIntel.",
      {},
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "Get Inference Capabilities",
      },
      async () => {
        const capabilities = getInferenceCapabilityView(env);
        return renderStructuredToolResult(
          "Loaded EdgeIntel inference capabilities.",
          capabilities,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_ZONE_READ)) {
    server.tool(
      "edgeintel.zone.list",
      "List Cloudflare zones discovered from the configured control-plane token.",
      {},
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "List Cloudflare Zones",
      },
      async () => {
        const zones = await listZoneView(env);
        return renderStructuredToolResult(
          `Loaded ${zones.zones.length} Cloudflare zone(s).`,
          zones,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_HOSTNAME_VALIDATE)) {
    server.tool(
      "edgeintel.hostname.validate",
      "Validate that a hostname fits an available Cloudflare zone and detect DNS conflicts before provisioning.",
      {
        publicHostname: z.string().describe("Public hostname to validate."),
        cloudflareZoneId: z
          .string()
          .nullable()
          .optional()
          .describe("Optional Cloudflare zone override."),
        tunnelId: z
          .string()
          .nullable()
          .optional()
          .describe("Optional existing tunnel identifier."),
      },
      {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "Validate Tunnel Hostname",
      },
      async ({ publicHostname, cloudflareZoneId, tunnelId }) => {
        const validation = await validateHostnameView(env, {
          publicHostname,
          cloudflareZoneId: cloudflareZoneId ?? null,
          tunnelId: tunnelId ?? null,
        });
        return renderStructuredToolResult(
          `Validated hostname ${publicHostname}.`,
          validation,
        );
      },
    );
  }

  if (hasMcpScope(props, MCP_SCOPE_TUNNEL_READ)) {
    server.tool(
      "edgeintel.tunnel.observability.get",
      "Get tunnel observability, test history, and failure delta without exposing local bootstrap secrets.",
      {
        tunnelId: z.string().describe("Tunnel identifier."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        title: "Get Tunnel Observability",
      },
      async ({ tunnelId }) => {
        const observability = await getTunnelObservabilityView(env, tunnelId);
        return renderStructuredToolResult(
          `Loaded redacted observability for tunnel ${tunnelId}.`,
          observability,
        );
      },
    );
  }

  return server;
}
export { buildMcpServer };
