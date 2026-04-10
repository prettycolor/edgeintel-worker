#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    apiBase: process.env.EDGEINTEL_API_BASE || "",
    tunnelId: process.env.EDGEINTEL_TUNNEL_ID || "",
    cloudflaredBin: process.env.EDGEINTEL_CLOUDFLARED_BIN || "cloudflared",
    once: false,
    dryRun: false,
    heartbeatIntervalMs: Number(process.env.EDGEINTEL_HEARTBEAT_MS || "30000"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--api-base" && next) {
      args.apiBase = next;
      index += 1;
      continue;
    }

    if (arg === "--tunnel-id" && next) {
      args.tunnelId = next;
      index += 1;
      continue;
    }

    if (arg === "--cloudflared-bin" && next) {
      args.cloudflaredBin = next;
      index += 1;
      continue;
    }

    if (arg === "--once") {
      args.once = true;
      continue;
    }

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function requireConfig(config) {
  if (!config.apiBase) {
    throw new Error("Missing --api-base or EDGEINTEL_API_BASE.");
  }
  if (!config.tunnelId) {
    throw new Error("Missing --tunnel-id or EDGEINTEL_TUNNEL_ID.");
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }
  return payload;
}

function getCloudflaredVersion(bin) {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || result.stderr.trim() || "unknown";
}

async function probeLocalService(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
    });
    return {
      reachable: response.status < 500,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : "Local probe failed.",
    };
  }
}

async function sendHeartbeat(apiBase, tunnelId, payload) {
  await fetchJson(`${apiBase.replace(/\/+$/, "")}/api/tunnels/${encodeURIComponent(tunnelId)}/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function loadBootstrap(apiBase, tunnelId) {
  const payload = await fetchJson(
    `${apiBase.replace(/\/+$/, "")}/api/tunnels/${encodeURIComponent(tunnelId)}`,
    {
      method: "GET",
    },
  );

  if (!payload.bootstrap?.tunnelTokenPresent) {
    throw new Error("Tunnel bootstrap did not include a tunnel token.");
  }

  return payload;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  requireConfig(config);

  const payload = await loadBootstrap(config.apiBase, config.tunnelId);
  const tunnel = payload.tunnel;
  const bootstrap = payload.bootstrap;
  const cloudflaredVersion = getCloudflaredVersion(config.cloudflaredBin);

  if (!cloudflaredVersion) {
    await sendHeartbeat(config.apiBase, config.tunnelId, {
      connectorStatus: "offline",
      version: null,
      localServiceReachable: false,
      model: tunnel?.metadata?.connector?.model || null,
      note: "cloudflared is not installed or not on PATH.",
    });
    throw new Error("cloudflared is not installed or not on PATH.");
  }

  const localProbe = await probeLocalService(tunnel.localServiceUrl);
  const heartbeatPayload = {
    connectorStatus: localProbe.reachable ? "connected" : "degraded",
    version: cloudflaredVersion,
    localServiceReachable: localProbe.reachable,
    model: tunnel?.metadata?.connector?.model || null,
    note: localProbe.reachable
      ? "Local service reachable."
      : localProbe.error || "Local service probe failed.",
  };

  if (config.once || config.dryRun) {
    await sendHeartbeat(config.apiBase, config.tunnelId, heartbeatPayload);
    console.log(
      JSON.stringify(
        {
          mode: config.dryRun ? "dry-run" : "once",
          tunnelId: config.tunnelId,
          publicHostname: tunnel.publicHostname,
          localServiceUrl: tunnel.localServiceUrl,
          bootstrap,
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
  let timer = null;

  const stop = async (status, note) => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    await sendHeartbeat(config.apiBase, config.tunnelId, {
      connectorStatus: status,
      version: cloudflaredVersion,
      localServiceReachable: localProbe.reachable,
      model: tunnel?.metadata?.connector?.model || null,
      note,
    }).catch(() => {});
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  await sendHeartbeat(config.apiBase, config.tunnelId, heartbeatPayload);

  timer = setInterval(async () => {
    const probe = await probeLocalService(tunnel.localServiceUrl);
    await sendHeartbeat(config.apiBase, config.tunnelId, {
      connectorStatus: probe.reachable ? "connected" : "degraded",
      version: cloudflaredVersion,
      localServiceReachable: probe.reachable,
      model: tunnel?.metadata?.connector?.model || null,
      note: probe.reachable ? "Tunnel connector heartbeat OK." : probe.error || "Local service degraded.",
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
