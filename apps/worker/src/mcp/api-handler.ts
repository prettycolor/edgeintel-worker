import { createMcpHandler } from "agents/mcp";
import type { Env } from "../env";
import { buildMcpServer } from "./server";

export async function handleMcpApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const props = ((ctx as ExecutionContext & { props?: Record<string, unknown> }).props ??
    {}) as Record<string, unknown>;
  const server = buildMcpServer(env, props);
  const handler = createMcpHandler(server, {
    route: "/mcp",
    authContext: {
      props,
    },
  });
  return handler(request, env, ctx);
}
