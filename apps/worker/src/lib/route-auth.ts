export function isConnectorExchangeRoute(request: Request, path: string): boolean {
  return (
    request.method === "POST" &&
    /^\/api\/pairings\/[^/]+\/exchange$/.test(path)
  );
}

export function isConnectorHeartbeatRoute(request: Request, path: string): boolean {
  return (
    request.method === "POST" &&
    /^\/api\/tunnels\/[^/]+\/heartbeat$/.test(path)
  );
}

export function routeRequiresOperatorSession(
  request: Request,
  path: string,
): boolean {
  if (path === "/health") return false;
  if (isConnectorExchangeRoute(request, path)) return false;
  if (isConnectorHeartbeatRoute(request, path)) return false;

  if (path === "/app" || path.startsWith("/app/")) {
    return true;
  }

  if (path.startsWith("/api/")) {
    return true;
  }

  return false;
}
