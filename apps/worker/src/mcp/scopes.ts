export const MCP_SCOPE_SCAN_READ = "edgeintel.scan.read";
export const MCP_SCOPE_SCAN_CREATE = "edgeintel.scan.create";
export const MCP_SCOPE_EXPORT_GENERATE = "edgeintel.export.generate";
export const MCP_SCOPE_CATALOG_READ = "edgeintel.catalog.read";
export const MCP_SCOPE_ZONE_READ = "edgeintel.zone.read";
export const MCP_SCOPE_HOSTNAME_VALIDATE = "edgeintel.hostname.validate";
export const MCP_SCOPE_TUNNEL_READ = "edgeintel.tunnel.read";

export const SUPPORTED_MCP_SCOPES = [
  MCP_SCOPE_SCAN_READ,
  MCP_SCOPE_SCAN_CREATE,
  MCP_SCOPE_EXPORT_GENERATE,
  MCP_SCOPE_CATALOG_READ,
  MCP_SCOPE_ZONE_READ,
  MCP_SCOPE_HOSTNAME_VALIDATE,
  MCP_SCOPE_TUNNEL_READ,
] as const;

export const DEFAULT_MCP_SCOPES = [...SUPPORTED_MCP_SCOPES];

export type SupportedMcpScope = (typeof SUPPORTED_MCP_SCOPES)[number];

export interface EdgeIntelMcpProps {
  email: string | null;
  name: string | null;
  login: string;
  grantedScopes: string[];
}

function trimScope(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolveRequestedMcpScopes(requested: string[] | null | undefined): string[] {
  const supported = new Set<string>(SUPPORTED_MCP_SCOPES);
  const requestedScopes =
    requested
      ?.map((scope) => trimScope(scope))
      .filter((scope): scope is string => Boolean(scope)) ?? [];

  if (requestedScopes.length === 0) {
    return [...DEFAULT_MCP_SCOPES];
  }

  return Array.from(new Set(requestedScopes.filter((scope) => supported.has(scope))));
}

export function normalizeMcpProps(props: Record<string, unknown> | null | undefined): EdgeIntelMcpProps {
  const grantedScopes = Array.isArray(props?.grantedScopes)
    ? resolveRequestedMcpScopes(
        props?.grantedScopes.filter((value): value is string => typeof value === "string"),
      )
    : [...DEFAULT_MCP_SCOPES];

  return {
    email: typeof props?.email === "string" ? props.email : null,
    name: typeof props?.name === "string" ? props.name : null,
    login:
      typeof props?.login === "string" && props.login.trim().length > 0
        ? props.login
        : "unknown-operator",
    grantedScopes,
  };
}

export function hasMcpScope(
  props: EdgeIntelMcpProps | Record<string, unknown> | null | undefined,
  scope: SupportedMcpScope,
): boolean {
  const normalized =
    props && "grantedScopes" in props
      ? normalizeMcpProps(props as Record<string, unknown>)
      : normalizeMcpProps(props as Record<string, unknown> | null | undefined);
  return normalized.grantedScopes.includes(scope);
}
