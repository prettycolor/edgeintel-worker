import type {
  DesktopActionResult,
  DesktopCloudflaredState,
  DesktopConnectorLogEntry,
  DesktopConnectorSnapshot,
  DesktopConnectorSettingsInput,
  DesktopPairingResult,
  DesktopTunnelBootstrapView,
  PairingSessionView,
} from "@edgeintel/shared-contracts";
import {
  buildHeartbeatPayload,
  exchangePairing,
  getCloudflaredVersion,
  probeLocalService,
  sendHeartbeat,
} from "@edgeintel/connector-core";
import { app } from "electron";
import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { DesktopConnectorStore } from "./store";
import { inspectCloudflaredBinary, installManagedCloudflared } from "./cloudflared";

interface SecretState {
  connectorToken: string | null;
  connectorSessionExpiresAt: string | null;
  pairing: PairingSessionView | null;
  bootstrap: DesktopTunnelBootstrapView | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toBootstrapView(
  bootstrap: {
    publicHostname: string;
    localServiceUrl: string;
    cloudflareTunnelId: string | null;
    cloudflareTunnelName: string | null;
    tunnelTokenPresent: boolean;
    accessHeaders: Record<string, string>;
    notes: string[];
    command: string | null;
    launchArgs: string[] | null;
  },
  connectorSessionExpiresAt: string | null,
): DesktopTunnelBootstrapView {
  return {
    publicHostname: bootstrap.publicHostname,
    localServiceUrl: bootstrap.localServiceUrl,
    cloudflareTunnelId: bootstrap.cloudflareTunnelId,
    cloudflareTunnelName: bootstrap.cloudflareTunnelName,
    tunnelTokenPresent: bootstrap.tunnelTokenPresent,
    accessHeadersPresent: Object.keys(bootstrap.accessHeaders ?? {}).length > 0,
    notes: bootstrap.notes,
    command: bootstrap.command,
    launchArgs: bootstrap.launchArgs,
    connectorTokenExpiresAt: connectorSessionExpiresAt,
  };
}

export class ConnectorService extends EventEmitter {
  private readonly store = new DesktopConnectorStore();
  private readonly logs: DesktopConnectorLogEntry[] = [];
  private snapshot: DesktopConnectorSnapshot;
  private secrets: SecretState = {
    connectorToken: null,
    connectorSessionExpiresAt: null,
    pairing: null,
    bootstrap: null,
  };
  private child: ChildProcess | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;

  constructor() {
    super();

    const persisted = this.store.read();
    this.secrets = persisted.secrets;
    this.snapshot = {
      lifecycle: persisted.secrets.bootstrap ? "paired" : "unconfigured",
      connectorName: persisted.plain.connectorName,
      platform: process.platform,
      appVersion: app.getVersion(),
      apiBase: persisted.plain.apiBase,
      pairingId: persisted.plain.pairingId,
      pairedAt: persisted.plain.pairedAt,
      autoLaunchOnLogin: persisted.plain.autoLaunchOnLogin,
      publicHostname: persisted.plain.publicHostname,
      pairing: persisted.secrets.pairing,
      bootstrap: persisted.secrets.bootstrap,
      cloudflared: inspectCloudflaredBinary(this.store.getManagedCloudflaredPath()),
      localProbe: {
        url: persisted.secrets.bootstrap?.localServiceUrl ?? null,
        reachable: null,
        status: null,
        latencyMs: null,
        error: null,
        testedAt: null,
      },
      runtime: {
        status: "stopped",
        cloudflaredPid: null,
        startedAt: null,
        stoppedAt: null,
        lastHeartbeatAt: null,
        lastHeartbeatNote: null,
      },
      lastError: null,
      logs: [],
    };

    if (persisted.secrets.bootstrap && this.snapshot.cloudflared.status === "ready") {
      this.snapshot.lifecycle = "ready";
    }
  }

  async initialize(): Promise<DesktopConnectorSnapshot> {
    this.setAutoLaunchOnLogin(this.snapshot.autoLaunchOnLogin);
    this.logExternal({
      level: "info",
      scope: "app",
      message: "EdgeIntel Connector initialized.",
      detail: null,
    });

    if (this.snapshot.autoLaunchOnLogin && this.snapshot.bootstrap && this.snapshot.cloudflared.status === "ready") {
      await this.startRuntime().catch((error) => {
        this.fail(error instanceof Error ? error.message : "Auto-start failed.");
      });
    }

    return this.getSnapshot();
  }

  getSnapshot(): DesktopConnectorSnapshot {
    return structuredClone(this.snapshot);
  }

  async pairConnector(input: DesktopConnectorSettingsInput): Promise<DesktopPairingResult> {
    this.updateSnapshot({
      lifecycle: "pairing",
      lastError: null,
      connectorName: input.connectorName,
      apiBase: input.apiBase,
      pairingId: input.pairingId,
      autoLaunchOnLogin: input.autoLaunchOnLogin,
    });
    this.log({
      level: "info",
      scope: "pairing",
      message: `Exchanging one-time pairing for ${input.connectorName}.`,
      detail: null,
    });

    const response = await exchangePairing({
      apiBase: input.apiBase,
      pairingId: input.pairingId,
      pairingToken: input.pairingToken,
      connectorName: input.connectorName,
      connectorVersion: app.getVersion(),
    });

    const bootstrap = toBootstrapView(
      response.bootstrap,
      response.connectorSession.expiresAt,
    );
    this.secrets = {
      connectorToken: response.connectorSession.token,
      connectorSessionExpiresAt: response.connectorSession.expiresAt,
      pairing: response.pairing,
      bootstrap,
    };
    this.store.writePlain({
      apiBase: input.apiBase,
      pairingId: input.pairingId,
      connectorName: input.connectorName,
      autoLaunchOnLogin: input.autoLaunchOnLogin,
      pairedAt: nowIso(),
      publicHostname: response.tunnel.publicHostname,
    });
    this.store.writeSecrets(this.secrets);
    this.setAutoLaunchOnLogin(input.autoLaunchOnLogin);

    const cloudflared = await this.refreshCloudflaredState();
    const probe = await this.runLocalProbe(false);
    this.updateSnapshot({
      lifecycle: cloudflared.status === "ready" ? "ready" : "paired",
      pairing: response.pairing,
      bootstrap,
      pairedAt: nowIso(),
      publicHostname: response.tunnel.publicHostname,
      localProbe: probe,
    });

    this.log({
      level: "info",
      scope: "pairing",
      message: `Connector paired for ${response.tunnel.publicHostname}.`,
      detail: null,
    });

    return {
      snapshot: this.getSnapshot(),
      pairing: response.pairing,
      bootstrap,
      connectorSessionExpiresAt: response.connectorSession.expiresAt,
    };
  }

  async refreshCloudflared(): Promise<DesktopActionResult> {
    await this.refreshCloudflaredState();
    return { snapshot: this.getSnapshot() };
  }

  logExternal(entry: Omit<DesktopConnectorLogEntry, "id" | "timestamp">): void {
    this.log(entry);
  }

  async installCloudflared(): Promise<DesktopActionResult> {
    this.updateSnapshot({
      lifecycle: "installing_cloudflared",
      lastError: null,
    });
    this.log({
      level: "info",
      scope: "cloudflared",
      message: "Downloading and verifying cloudflared.",
      detail: null,
    });

    const installed = await installManagedCloudflared(app.getPath("userData"));
    this.store.writePlain({
      managedCloudflaredPath: installed.binaryPath,
      managedCloudflaredReleaseTag: installed.releaseTag,
      managedCloudflaredAssetName: installed.assetName,
    });

    this.updateSnapshot({
      cloudflared: installed,
      lifecycle: this.snapshot.bootstrap ? "ready" : "unconfigured",
    });
    this.log({
      level: "info",
      scope: "cloudflared",
      message: installed.message ?? "cloudflared installed.",
      detail: installed.binaryPath,
    });

    return { snapshot: this.getSnapshot() };
  }

  async testLocalService(): Promise<DesktopActionResult> {
    await this.runLocalProbe(true);
    return { snapshot: this.getSnapshot() };
  }

  async startRuntime(): Promise<DesktopActionResult> {
    if (this.child) {
      return { snapshot: this.getSnapshot() };
    }

    const bootstrap = this.requireBootstrap();
    const pairing = this.requirePairing();
    const connectorToken = this.requireConnectorToken();
    const binary = this.requireCloudflaredBinary();
    if (!Array.isArray(bootstrap.launchArgs) || bootstrap.launchArgs.length === 0) {
      throw new Error("Tunnel bootstrap is missing cloudflared launch arguments.");
    }

    const cloudflaredVersion = getCloudflaredVersion(binary);
    if (!cloudflaredVersion) {
      throw new Error("cloudflared is not available.");
    }

    this.updateSnapshot({
      lifecycle: "starting",
      runtime: {
        ...this.snapshot.runtime,
        status: "stopped",
      },
      lastError: null,
    });
    this.log({
      level: "info",
      scope: "runtime",
      message: `Starting cloudflared for ${bootstrap.publicHostname}.`,
      detail: bootstrap.command,
    });

    const initialProbe = await this.runLocalProbe(false);
    const child = spawn(binary, bootstrap.launchArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    try {
      this.child = child;
      this.stopping = false;

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => this.log({
        level: "info",
        scope: "cloudflared",
        message: String(chunk).trim() || "cloudflared output",
        detail: null,
      }));
      child.stderr?.on("data", (chunk) => this.log({
        level: "warning",
        scope: "cloudflared",
        message: String(chunk).trim() || "cloudflared warning",
        detail: null,
      }));
      child.on("exit", (code) => {
        void this.handleChildExit(code ?? 0);
      });

      await sendHeartbeat({
        apiBase: this.snapshot.apiBase ?? "",
        tunnelId: this.snapshot.pairing?.tunnelId ?? "",
        pairingId: pairing.id,
        connectorToken,
        payload: buildHeartbeatPayload({
          probe: {
            url: initialProbe.url ?? bootstrap.localServiceUrl ?? "",
            reachable: Boolean(initialProbe.reachable),
            status: initialProbe.status,
            latencyMs: initialProbe.latencyMs ?? 0,
            testedAt: initialProbe.testedAt ?? nowIso(),
            error: initialProbe.error ?? undefined,
          },
          cloudflaredVersion,
          model: null,
          noteWhenReachable: "Connector runtime started successfully.",
          noteWhenUnreachable: initialProbe.error ?? "Local service degraded during startup.",
        }),
      });
    } catch (error) {
      child.kill("SIGTERM");
      this.child = null;
      throw error;
    }

    this.updateSnapshot({
      lifecycle: "running",
      runtime: {
        status: initialProbe.reachable ? "running" : "degraded",
        cloudflaredPid: child.pid ?? null,
        startedAt: nowIso(),
        stoppedAt: null,
        lastHeartbeatAt: nowIso(),
        lastHeartbeatNote: initialProbe.reachable
          ? "Connector runtime started successfully."
          : initialProbe.error ?? "Local service degraded during startup.",
      },
    });

    this.heartbeatTimer = setInterval(() => {
      void this.runHeartbeat(cloudflaredVersion).catch((error) => {
        this.log({
          level: "warning",
          scope: "heartbeat",
          message: "Heartbeat attempt failed.",
          detail: error instanceof Error ? error.message : "Unknown heartbeat failure.",
        });
      });
    }, 30_000);

    return { snapshot: this.getSnapshot() };
  }

  async stopRuntime(): Promise<DesktopActionResult> {
    if (!this.child) {
      this.updateSnapshot({
        lifecycle: this.snapshot.bootstrap
          ? this.snapshot.cloudflared.status === "ready"
            ? "ready"
            : "paired"
          : "unconfigured",
        runtime: {
          ...this.snapshot.runtime,
          status: "stopped",
          stoppedAt: nowIso(),
        },
      });
      return { snapshot: this.getSnapshot() };
    }

    this.stopping = true;
    this.updateSnapshot({
      lifecycle: "stopping",
    });
    this.log({
      level: "info",
      scope: "runtime",
      message: "Stopping connector runtime.",
      detail: null,
    });

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const child = this.child;
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 4_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    return { snapshot: this.getSnapshot() };
  }

  async updatePreferences(input: Partial<DesktopConnectorSettingsInput>): Promise<DesktopActionResult> {
    const plain = this.store.writePlain({
      apiBase: input.apiBase ?? this.snapshot.apiBase,
      pairingId: input.pairingId ?? this.snapshot.pairingId,
      connectorName: input.connectorName ?? this.snapshot.connectorName,
      autoLaunchOnLogin: input.autoLaunchOnLogin ?? this.snapshot.autoLaunchOnLogin,
    });
    this.setAutoLaunchOnLogin(plain.autoLaunchOnLogin);
    this.updateSnapshot({
      apiBase: plain.apiBase,
      pairingId: plain.pairingId,
      connectorName: plain.connectorName,
      autoLaunchOnLogin: plain.autoLaunchOnLogin,
    });

    return { snapshot: this.getSnapshot() };
  }

  async resetConfiguration(): Promise<DesktopActionResult> {
    await this.stopRuntime().catch(() => {});
    this.store.clear();
    this.secrets = {
      connectorToken: null,
      connectorSessionExpiresAt: null,
      pairing: null,
      bootstrap: null,
    };
    const cloudflared = inspectCloudflaredBinary(this.store.getManagedCloudflaredPath());
    this.snapshot = {
      ...this.snapshot,
      lifecycle: "unconfigured",
      connectorName: "EdgeIntel Connector",
      apiBase: null,
      pairingId: null,
      pairedAt: null,
      autoLaunchOnLogin: false,
      publicHostname: null,
      pairing: null,
      bootstrap: null,
      cloudflared,
      localProbe: {
        url: null,
        reachable: null,
        status: null,
        latencyMs: null,
        error: null,
        testedAt: null,
      },
      runtime: {
        status: "stopped",
        cloudflaredPid: null,
        startedAt: null,
        stoppedAt: nowIso(),
        lastHeartbeatAt: null,
        lastHeartbeatNote: null,
      },
      lastError: null,
      logs: this.logs,
    };
    this.setAutoLaunchOnLogin(false);
    this.emitSnapshot();
    return { snapshot: this.getSnapshot() };
  }

  private async refreshCloudflaredState(): Promise<DesktopCloudflaredState> {
    const cloudflared = inspectCloudflaredBinary(this.store.getManagedCloudflaredPath());
    this.updateSnapshot({
      cloudflared,
      lifecycle: this.snapshot.bootstrap
        ? cloudflared.status === "ready"
          ? "ready"
          : "paired"
        : "unconfigured",
    });
    return cloudflared;
  }

  private async runLocalProbe(logResult: boolean): Promise<DesktopConnectorSnapshot["localProbe"]> {
    const bootstrap = this.snapshot.bootstrap;
    if (!bootstrap?.localServiceUrl) {
      const next = {
        url: null,
        reachable: null,
        status: null,
        latencyMs: null,
        error: "Pair the connector before testing the local service.",
        testedAt: nowIso(),
      };
      this.updateSnapshot({ localProbe: next });
      return next;
    }

    const probe = await probeLocalService(bootstrap.localServiceUrl);
    const next = {
      url: bootstrap.localServiceUrl,
      reachable: probe.reachable,
      status: probe.status,
      latencyMs: probe.latencyMs,
      error: probe.error ?? null,
      testedAt: probe.testedAt,
    };
    this.updateSnapshot({ localProbe: next });
    if (logResult) {
      this.log({
        level: probe.reachable ? "info" : "warning",
        scope: "local-probe",
        message: probe.reachable
          ? `Local service reachable at ${bootstrap.localServiceUrl}.`
          : `Local service probe failed for ${bootstrap.localServiceUrl}.`,
        detail: probe.error ?? null,
      });
    }
    return next;
  }

  private async runHeartbeat(cloudflaredVersion: string | null): Promise<void> {
    const bootstrap = this.requireBootstrap();
    const pairing = this.requirePairing();
    const connectorToken = this.requireConnectorToken();
    const probe = await this.runLocalProbe(false);
    const payload = buildHeartbeatPayload({
      probe: {
        url: probe.url ?? bootstrap.localServiceUrl ?? "",
        reachable: Boolean(probe.reachable),
        status: probe.status,
        latencyMs: probe.latencyMs ?? 0,
        testedAt: probe.testedAt ?? nowIso(),
        error: probe.error ?? undefined,
      },
      cloudflaredVersion,
      model: null,
      noteWhenReachable: "Connector heartbeat OK.",
      noteWhenUnreachable: probe.error ?? "Local service degraded.",
    });

    await sendHeartbeat({
      apiBase: this.snapshot.apiBase ?? "",
      tunnelId: pairing.tunnelId,
      pairingId: pairing.id,
      connectorToken,
      payload,
    });

    this.updateSnapshot({
      runtime: {
        ...this.snapshot.runtime,
        status: payload.connectorStatus === "connected" ? "running" : "degraded",
        lastHeartbeatAt: nowIso(),
        lastHeartbeatNote: payload.note,
      },
    });
  }

  private async handleChildExit(code: number): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.child = null;
    const previousProbe = this.snapshot.localProbe;
    const pairing = this.snapshot.pairing;
    const connectorToken = this.secrets.connectorToken;
    const version = this.snapshot.cloudflared.version;
    const note = this.stopping
      ? "Connector runtime stopped."
      : `cloudflared exited with code ${code}.`;

    if (pairing && connectorToken) {
      await sendHeartbeat({
        apiBase: this.snapshot.apiBase ?? "",
        tunnelId: pairing.tunnelId,
        pairingId: pairing.id,
        connectorToken,
        payload: {
          connectorStatus: "offline",
          version,
          localServiceReachable: Boolean(previousProbe.reachable),
          model: null,
          note,
        },
      }).catch(() => {});
    }

    this.updateSnapshot({
      lifecycle: this.snapshot.bootstrap
        ? this.snapshot.cloudflared.status === "ready"
          ? "ready"
          : "paired"
        : "unconfigured",
      runtime: {
        status: this.stopping ? "stopped" : "error",
        cloudflaredPid: null,
        startedAt: this.snapshot.runtime.startedAt,
        stoppedAt: nowIso(),
        lastHeartbeatAt: nowIso(),
        lastHeartbeatNote: note,
      },
      lastError: this.stopping ? null : note,
    });
    this.log({
      level: this.stopping ? "info" : "warning",
      scope: "runtime",
      message: note,
      detail: null,
    });
    this.stopping = false;
  }

  private requireBootstrap(): DesktopTunnelBootstrapView {
    if (!this.snapshot.bootstrap) {
      throw new Error("Pair the connector before starting the runtime.");
    }
    return this.snapshot.bootstrap;
  }

  private requirePairing(): PairingSessionView {
    if (!this.snapshot.pairing) {
      throw new Error("Pair the connector before starting the runtime.");
    }
    return this.snapshot.pairing;
  }

  private requireConnectorToken(): string {
    if (!this.secrets.connectorToken) {
      throw new Error("Connector bearer token is not available.");
    }
    return this.secrets.connectorToken;
  }

  private requireCloudflaredBinary(): string {
    const binary = this.snapshot.cloudflared.binaryPath;
    if (!binary) {
      throw new Error("Install or detect cloudflared before starting the runtime.");
    }
    return binary;
  }

  private setAutoLaunchOnLogin(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: enabled,
    });
  }

  private updateSnapshot(patch: Partial<DesktopConnectorSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      logs: this.logs,
    };
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.emit("snapshot", this.getSnapshot());
  }

  private log(entry: Omit<DesktopConnectorLogEntry, "id" | "timestamp">): void {
    this.logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: nowIso(),
      ...entry,
    });
    this.logs.splice(120);
    this.snapshot.logs = this.logs;
    this.emit("log", this.logs[0]);
    this.emitSnapshot();
  }

  private fail(message: string): void {
    this.updateSnapshot({
      lifecycle: "error",
      lastError: message,
    });
    this.log({
      level: "error",
      scope: "app",
      message,
      detail: null,
    });
  }
}
