#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import {
  buildHeartbeatPayload,
  exchangePairing,
  getCloudflaredVersion,
  parseCliArgs,
  probeLocalService,
  requireConnectorConfig,
  sendHeartbeat,
} from "./index";

async function main() {
  const config = parseCliArgs(process.argv.slice(2));
  requireConnectorConfig(config);

  const payload = await exchangePairing({
    apiBase: config.apiBase,
    pairingId: config.pairingId,
    pairingToken: config.pairingToken,
    connectorName: config.connectorName,
    connectorVersion: config.connectorVersion,
  });
  const pairing = payload.pairing;
  const tunnel = payload.tunnel;
  const bootstrap = payload.bootstrap;
  const connectorSession = payload.connectorSession;
  const cloudflaredVersion = getCloudflaredVersion(config.cloudflaredBin);

  if (!cloudflaredVersion) {
    await sendHeartbeat({
      apiBase: config.apiBase,
      tunnelId: tunnel.id,
      pairingId: pairing.id,
      connectorToken: connectorSession.token,
      payload: {
        connectorStatus: "offline",
        version: null,
        localServiceReachable: false,
        model: (tunnel.metadata?.connector as { model?: string } | undefined)?.model ?? null,
        note: "cloudflared is not installed or not on PATH.",
      },
    });
    throw new Error("cloudflared is not installed or not on PATH.");
  }

  const localProbe = await probeLocalService(tunnel.localServiceUrl);
  const heartbeatPayload = buildHeartbeatPayload({
    probe: localProbe,
    cloudflaredVersion,
    model: (tunnel.metadata?.connector as { model?: string } | undefined)?.model ?? null,
  });

  if (config.once || config.dryRun) {
    await sendHeartbeat({
      apiBase: config.apiBase,
      tunnelId: tunnel.id,
      pairingId: pairing.id,
      connectorToken: connectorSession.token,
      payload: heartbeatPayload,
    });
    console.log(
      JSON.stringify(
        {
          mode: config.dryRun ? "dry-run" : "once",
          tunnelId: tunnel.id,
          publicHostname: tunnel.publicHostname,
          localServiceUrl: tunnel.localServiceUrl,
          pairing: {
            id: pairing.id,
            status: pairing.status,
            connectorExpiresAt: pairing.connectorExpiresAt,
          },
          bootstrap: {
            mode: bootstrap.mode,
            publicHostname: bootstrap.publicHostname,
            localServiceUrl: bootstrap.localServiceUrl,
            cloudflareTunnelId: bootstrap.cloudflareTunnelId,
            cloudflareTunnelName: bootstrap.cloudflareTunnelName,
            tunnelTokenPresent: bootstrap.tunnelTokenPresent,
            accessHeadersPresent: Object.keys(bootstrap.accessHeaders || {}).length > 0,
          },
          localProbe,
          cloudflaredVersion,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!Array.isArray(bootstrap.launchArgs) || bootstrap.launchArgs.length === 0) {
    throw new Error("Tunnel bootstrap did not include cloudflared launch arguments.");
  }

  const child = spawn(config.cloudflaredBin, bootstrap.launchArgs, {
    stdio: "inherit",
  });

  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = async (status: "offline" | "degraded", note: string) => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    await sendHeartbeat({
      apiBase: config.apiBase,
      tunnelId: tunnel.id,
      pairingId: pairing.id,
      connectorToken: connectorSession.token,
      payload: {
        connectorStatus: status,
        version: cloudflaredVersion,
        localServiceReachable: localProbe.reachable,
        model: (tunnel.metadata?.connector as { model?: string } | undefined)?.model ?? null,
        note,
      },
    }).catch(() => {});
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  await sendHeartbeat({
    apiBase: config.apiBase,
    tunnelId: tunnel.id,
    pairingId: pairing.id,
    connectorToken: connectorSession.token,
    payload: heartbeatPayload,
  });

  timer = setInterval(async () => {
    const probe = await probeLocalService(tunnel.localServiceUrl);
    await sendHeartbeat({
      apiBase: config.apiBase,
      tunnelId: tunnel.id,
      pairingId: pairing.id,
      connectorToken: connectorSession.token,
      payload: buildHeartbeatPayload({
        probe,
        cloudflaredVersion,
        model: (tunnel.metadata?.connector as { model?: string } | undefined)?.model ?? null,
        noteWhenReachable: "Tunnel connector heartbeat OK.",
        noteWhenUnreachable: probe.error ?? "Local service degraded.",
      }),
    }).catch(() => {});
  }, config.heartbeatIntervalMs);

  child.on("exit", async (code) => {
    await stop("offline", `cloudflared exited with code ${code ?? 0}.`);
    process.exit(code ?? 0);
  });

  process.on("SIGINT", async () => {
    await stop("offline", "Connector interrupted.");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await stop("offline", "Connector terminated.");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
