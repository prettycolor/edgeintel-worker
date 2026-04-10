import type {
  DesktopConnectorEventPayload,
  DesktopConnectorLogEventPayload,
  DesktopConnectorSettingsInput,
  DesktopConnectorSnapshot,
} from "@edgeintel/shared-contracts";

declare global {
  interface Window {
    edgeIntelDesktop: {
      platform: string;
      versions: Record<string, string>;
      getSnapshot(): Promise<DesktopConnectorSnapshot>;
      pairConnector(input: DesktopConnectorSettingsInput): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      refreshCloudflared(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      installCloudflared(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      testLocalService(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      startRuntime(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      stopRuntime(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      updatePreferences(input: Partial<DesktopConnectorSettingsInput>): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      resetConfiguration(): Promise<{ snapshot: DesktopConnectorSnapshot }>;
      openExternal(url: string): Promise<void>;
      onSnapshot(listener: (payload: DesktopConnectorEventPayload) => void): () => void;
      onLog(listener: (payload: DesktopConnectorLogEventPayload) => void): () => void;
    };
  }
}

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Desktop app root is missing.");
}

appRoot.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1016;
      --bg-alt: #101722;
      --panel: rgba(255, 255, 255, 0.06);
      --panel-strong: rgba(255, 255, 255, 0.1);
      --line: rgba(255, 255, 255, 0.09);
      --line-strong: rgba(255, 255, 255, 0.16);
      --text: rgba(255, 255, 255, 0.94);
      --text-muted: rgba(255, 255, 255, 0.62);
      --success: #91f463;
      --warning: #ffcb6b;
      --danger: #ff7b6e;
      --info: #6dd8ff;
      --accent: #9be4ff;
      --accent-soft: rgba(109, 216, 255, 0.16);
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(109, 216, 255, 0.16), transparent 24%),
        radial-gradient(circle at top right, rgba(145, 244, 99, 0.14), transparent 20%),
        linear-gradient(180deg, #0f1520 0%, var(--bg) 60%, #091018 100%);
    }

    button,
    input {
      font: inherit;
    }

    button {
      cursor: pointer;
      border: 0;
      border-radius: 14px;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, background 160ms ease;
    }

    button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    }

    button:disabled {
      cursor: default;
      opacity: 0.56;
    }

    input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.18);
      color: var(--text);
      transition: border-color 140ms ease, background 140ms ease;
    }

    input:focus {
      outline: none;
      border-color: rgba(109, 216, 255, 0.52);
      background: rgba(0, 0, 0, 0.26);
    }

    .shell {
      min-height: 100vh;
      padding: 24px;
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      gap: 20px;
    }

    .sidebar,
    .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      backdrop-filter: blur(22px);
      box-shadow: var(--shadow);
    }

    .sidebar {
      padding: 22px;
      border-radius: 28px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .brand {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.2) 52%, transparent 54%),
        linear-gradient(135deg, rgba(109, 216, 255, 0.9), rgba(145, 244, 99, 0.48));
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
    }

    .eyebrow {
      margin: 0 0 8px;
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    h1, h2, h3, h4, p {
      margin: 0;
    }

    h1, h2, h3 {
      font-family: "Space Grotesk", "Avenir Next", sans-serif;
      letter-spacing: -0.04em;
    }

    .sidebar-card {
      padding: 18px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.06);
      display: grid;
      gap: 8px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: capitalize;
      border: 1px solid transparent;
    }

    .badge::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
      box-shadow: 0 0 0 8px color-mix(in srgb, currentColor 20%, transparent);
    }

    .tone-success { color: var(--success); background: rgba(145, 244, 99, 0.08); border-color: rgba(145, 244, 99, 0.18); }
    .tone-warning { color: var(--warning); background: rgba(255, 203, 107, 0.08); border-color: rgba(255, 203, 107, 0.18); }
    .tone-danger { color: var(--danger); background: rgba(255, 123, 110, 0.08); border-color: rgba(255, 123, 110, 0.18); }
    .tone-info { color: var(--info); background: rgba(109, 216, 255, 0.08); border-color: rgba(109, 216, 255, 0.18); }
    .tone-muted { color: var(--text-muted); background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }

    .meta-grid {
      display: grid;
      gap: 10px;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .metric-row strong {
      color: var(--text);
      font-weight: 600;
      text-align: right;
    }

    .main {
      display: grid;
      gap: 18px;
    }

    .hero {
      padding: 22px 24px;
      border-radius: 28px;
      display: grid;
      grid-template-columns: 1.3fr 0.7fr;
      gap: 18px;
      background:
        radial-gradient(circle at top right, rgba(145, 244, 99, 0.16), transparent 28%),
        linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255,255,255,0.04));
    }

    .lede {
      margin-top: 10px;
      color: var(--text-muted);
      line-height: 1.7;
      max-width: 760px;
    }

    .hero-actions,
    .control-grid,
    .setup-grid,
    .status-grid {
      display: grid;
      gap: 14px;
    }

    .hero-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: start;
    }

    .panel {
      border-radius: 24px;
      padding: 20px;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
      gap: 18px;
    }

    .setup-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field {
      display: grid;
      gap: 8px;
    }

    .field-span {
      grid-column: 1 / -1;
    }

    .field label {
      font-size: 12px;
      color: var(--text-muted);
      letter-spacing: 0.02em;
    }

    .button-primary {
      padding: 12px 14px;
      background: linear-gradient(135deg, #9be4ff, #6dd8ff 58%, #91f463 130%);
      color: #07131b;
      font-weight: 700;
    }

    .button-secondary {
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255,255,255,0.1);
    }

    .button-danger {
      padding: 12px 14px;
      background: rgba(255, 123, 110, 0.12);
      color: var(--danger);
      border: 1px solid rgba(255, 123, 110, 0.18);
    }

    .inline-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .helper {
      font-size: 12px;
      line-height: 1.6;
      color: var(--text-muted);
    }

    .toggle {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      margin-top: 12px;
    }

    .toggle input {
      width: 18px;
      height: 18px;
      accent-color: #6dd8ff;
    }

    .status-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .status-card {
      padding: 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255,255,255,0.06);
      display: grid;
      gap: 10px;
    }

    .status-card strong {
      font-size: 18px;
      font-family: "Space Grotesk", "Avenir Next", sans-serif;
    }

    .stack {
      display: grid;
      gap: 6px;
    }

    .status-list {
      display: grid;
      gap: 12px;
    }

    .status-list-item {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: grid;
      gap: 6px;
    }

    .status-list-item:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .muted {
      color: var(--text-muted);
    }

    .terminal {
      border-radius: 22px;
      padding: 0;
      overflow: hidden;
      background: rgba(4, 8, 12, 0.78);
      border: 1px solid rgba(255,255,255,0.08);
    }

    .terminal-header {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.04);
    }

    .terminal-body {
      max-height: 280px;
      overflow: auto;
      padding: 14px 18px 18px;
      font-family: "SFMono-Regular", "JetBrains Mono", ui-monospace, monospace;
      font-size: 12px;
      display: grid;
      gap: 10px;
    }

    .log-entry {
      display: grid;
      gap: 4px;
      padding-left: 16px;
      position: relative;
    }

    .log-entry::before {
      content: "";
      position: absolute;
      left: 0;
      top: 6px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--info);
      opacity: 0.9;
    }

    .log-entry.warning::before { background: var(--warning); }
    .log-entry.error::before { background: var(--danger); }

    .banner {
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid transparent;
      display: none;
    }

    .banner.visible {
      display: block;
    }

    .banner.info {
      color: var(--info);
      background: rgba(109,216,255,0.09);
      border-color: rgba(109,216,255,0.18);
    }

    .banner.error {
      color: var(--danger);
      background: rgba(255,123,110,0.09);
      border-color: rgba(255,123,110,0.18);
    }

    .pulse {
      animation: pulse 1.8s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.04); opacity: 0.9; }
    }

    @media (max-width: 1180px) {
      .shell,
      .workspace,
      .hero,
      .setup-grid,
      .status-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <main class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <p class="eyebrow">EdgeIntel</p>
          <h1>Connector</h1>
        </div>
      </div>

      <div class="sidebar-card">
        <p class="eyebrow">Lifecycle</p>
        <div id="sidebar-lifecycle-badge"></div>
        <div class="meta-grid">
          <div class="metric-row"><span>Platform</span><strong id="sidebar-platform"></strong></div>
          <div class="metric-row"><span>App version</span><strong id="sidebar-version"></strong></div>
          <div class="metric-row"><span>Public route</span><strong id="sidebar-hostname">Not paired</strong></div>
          <div class="metric-row"><span>Heartbeat</span><strong id="sidebar-heartbeat">No runtime</strong></div>
        </div>
      </div>

      <div class="sidebar-card">
        <p class="eyebrow">Current route</p>
        <div class="stack">
          <h3 id="sidebar-connector-name">EdgeIntel Connector</h3>
          <p class="muted" id="sidebar-route-copy">Pair the desktop app to claim its scoped tunnel bootstrap and runtime token.</p>
        </div>
      </div>

      <div class="sidebar-card">
        <p class="eyebrow">Current focus</p>
        <p class="muted">Pair, verify <code>cloudflared</code>, test the local service, then run the tunnel without touching CLI or launchctl.</p>
      </div>
    </aside>

    <section class="main">
      <section class="panel hero">
        <div>
          <p class="eyebrow">Phase 12</p>
          <h2>macOS connector orchestration, pairing, install, and live diagnostics.</h2>
          <p class="lede">
            This app owns the machine-local work the Worker cannot do: storing scoped bootstrap
            material, supervising <code>cloudflared</code>, probing the model route, and keeping the
            tunnel healthy over time.
          </p>
        </div>
        <div class="hero-actions">
          <button class="button-primary" id="action-start">Start route</button>
          <button class="button-secondary" id="action-stop">Stop route</button>
          <button class="button-secondary" id="action-install">Install / update cloudflared</button>
          <button class="button-secondary" id="action-test">Test local service</button>
        </div>
      </section>

      <div id="banner" class="banner info"></div>

      <section class="workspace">
        <div class="control-grid">
          <section class="panel">
            <p class="eyebrow">Pairing wizard</p>
            <h3>Connect this Mac to EdgeIntel</h3>
            <p class="helper" style="margin-top:10px">
              Paste the one-time pairing generated in the Worker control plane. The desktop app exchanges it
              for a scoped bootstrap and its own connector token, then keeps those local secrets on this machine.
            </p>

            <div class="setup-grid" style="margin-top:18px">
              <div class="field field-span">
                <label for="api-base">EdgeIntel API base</label>
                <input id="api-base" placeholder="https://edgeintel.example.com" />
              </div>
              <div class="field">
                <label for="pairing-id">Pairing ID</label>
                <input id="pairing-id" placeholder="pair_..." />
              </div>
              <div class="field">
                <label for="pairing-token">Pairing token</label>
                <input id="pairing-token" type="password" placeholder="One-time secret" />
              </div>
              <div class="field field-span">
                <label for="connector-name">Connector name</label>
                <input id="connector-name" placeholder="EdgeIntel Connector" />
              </div>
            </div>

            <label class="toggle">
              <input id="auto-launch" type="checkbox" />
              <span>
                <strong style="display:block">Launch connector at login</strong>
                <span class="helper">When enabled, the desktop app opens at login and automatically rehydrates the paired route.</span>
              </span>
            </label>

            <div class="inline-actions" style="margin-top:18px">
              <button class="button-primary" id="action-pair">Pair connector</button>
              <button class="button-secondary" id="action-save">Save preferences</button>
              <button class="button-danger" id="action-reset">Reset pairing</button>
            </div>
          </section>

          <section class="panel">
            <p class="eyebrow">Runtime controls</p>
            <h3>Daemon and route state</h3>
            <div class="status-grid" style="margin-top:16px">
              <article class="status-card">
                <p class="eyebrow">cloudflared</p>
                <strong id="cloudflared-status-copy">Not detected</strong>
                <div class="stack muted">
                  <span id="cloudflared-version">Version unavailable</span>
                  <span id="cloudflared-source">No binary detected yet</span>
                </div>
              </article>
              <article class="status-card">
                <p class="eyebrow">Local service</p>
                <strong id="probe-status-copy">Not tested</strong>
                <div class="stack muted">
                  <span id="probe-url">Route not paired yet</span>
                  <span id="probe-detail">No probe data available</span>
                </div>
              </article>
            </div>
            <div class="inline-actions" style="margin-top:16px">
              <button class="button-secondary" id="action-refresh">Refresh daemon state</button>
              <button class="button-secondary" id="action-open-hostname">Open public hostname</button>
            </div>
          </section>
        </div>

        <div class="control-grid">
          <section class="panel">
            <p class="eyebrow">Diagnostics</p>
            <h3>Scoped route snapshot</h3>
            <div class="status-list" style="margin-top:16px">
              <div class="status-list-item">
                <span class="muted">Public hostname</span>
                <strong id="diag-public-hostname">Not paired</strong>
                <span class="muted" id="diag-public-note">Create a pairing in the control plane, then exchange it here.</span>
              </div>
              <div class="status-list-item">
                <span class="muted">Tunnel</span>
                <strong id="diag-tunnel-name">Unavailable</strong>
                <span class="muted" id="diag-tunnel-id">No Cloudflare tunnel bound yet</span>
              </div>
              <div class="status-list-item">
                <span class="muted">Connector token</span>
                <strong id="diag-token-expiry">Unavailable</strong>
                <span class="muted" id="diag-token-note">Issued only after pairing exchange succeeds.</span>
              </div>
              <div class="status-list-item">
                <span class="muted">Runtime</span>
                <strong id="diag-runtime">Stopped</strong>
                <span class="muted" id="diag-runtime-note">No active \`cloudflared\` process.</span>
              </div>
            </div>
          </section>

          <section class="panel terminal">
            <div class="terminal-header">
              <div>
                <p class="eyebrow">Connector log</p>
                <h3>Recent events</h3>
              </div>
              <span class="muted">Live from the main process</span>
            </div>
            <div id="log-stream" class="terminal-body"></div>
          </section>
        </div>
      </section>
    </section>
  </main>
`;

const ui = {
  banner: document.querySelector<HTMLDivElement>("#banner")!,
  apiBase: document.querySelector<HTMLInputElement>("#api-base")!,
  pairingId: document.querySelector<HTMLInputElement>("#pairing-id")!,
  pairingToken: document.querySelector<HTMLInputElement>("#pairing-token")!,
  connectorName: document.querySelector<HTMLInputElement>("#connector-name")!,
  autoLaunch: document.querySelector<HTMLInputElement>("#auto-launch")!,
  start: document.querySelector<HTMLButtonElement>("#action-start")!,
  stop: document.querySelector<HTMLButtonElement>("#action-stop")!,
  install: document.querySelector<HTMLButtonElement>("#action-install")!,
  test: document.querySelector<HTMLButtonElement>("#action-test")!,
  pair: document.querySelector<HTMLButtonElement>("#action-pair")!,
  save: document.querySelector<HTMLButtonElement>("#action-save")!,
  reset: document.querySelector<HTMLButtonElement>("#action-reset")!,
  refresh: document.querySelector<HTMLButtonElement>("#action-refresh")!,
  openHostname: document.querySelector<HTMLButtonElement>("#action-open-hostname")!,
  sidebarLifecycleBadge: document.querySelector<HTMLDivElement>("#sidebar-lifecycle-badge")!,
  sidebarPlatform: document.querySelector<HTMLSpanElement>("#sidebar-platform")!,
  sidebarVersion: document.querySelector<HTMLSpanElement>("#sidebar-version")!,
  sidebarHostname: document.querySelector<HTMLSpanElement>("#sidebar-hostname")!,
  sidebarHeartbeat: document.querySelector<HTMLSpanElement>("#sidebar-heartbeat")!,
  sidebarConnectorName: document.querySelector<HTMLHeadingElement>("#sidebar-connector-name")!,
  sidebarRouteCopy: document.querySelector<HTMLParagraphElement>("#sidebar-route-copy")!,
  cloudflaredStatusCopy: document.querySelector<HTMLHeadingElement>("#cloudflared-status-copy")!,
  cloudflaredVersion: document.querySelector<HTMLSpanElement>("#cloudflared-version")!,
  cloudflaredSource: document.querySelector<HTMLSpanElement>("#cloudflared-source")!,
  probeStatusCopy: document.querySelector<HTMLHeadingElement>("#probe-status-copy")!,
  probeUrl: document.querySelector<HTMLSpanElement>("#probe-url")!,
  probeDetail: document.querySelector<HTMLSpanElement>("#probe-detail")!,
  diagPublicHostname: document.querySelector<HTMLHeadingElement>("#diag-public-hostname")!,
  diagPublicNote: document.querySelector<HTMLSpanElement>("#diag-public-note")!,
  diagTunnelName: document.querySelector<HTMLHeadingElement>("#diag-tunnel-name")!,
  diagTunnelId: document.querySelector<HTMLSpanElement>("#diag-tunnel-id")!,
  diagTokenExpiry: document.querySelector<HTMLHeadingElement>("#diag-token-expiry")!,
  diagTokenNote: document.querySelector<HTMLSpanElement>("#diag-token-note")!,
  diagRuntime: document.querySelector<HTMLHeadingElement>("#diag-runtime")!,
  diagRuntimeNote: document.querySelector<HTMLSpanElement>("#diag-runtime-note")!,
  logStream: document.querySelector<HTMLDivElement>("#log-stream")!,
};

let snapshot: DesktopConnectorSnapshot | null = null;
const busy = new Set<string>();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatRelative(value: string | null): string {
  if (!value) return "Unavailable";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.round(deltaMs / 60000);
  if (Math.abs(deltaMinutes) < 1) return "Just now";
  if (Math.abs(deltaMinutes) < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function formatAbsolute(value: string | null): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function toneForLifecycle(lifecycle: DesktopConnectorSnapshot["lifecycle"]): string {
  switch (lifecycle) {
    case "running":
    case "ready":
      return "tone-success";
    case "pairing":
    case "starting":
    case "installing_cloudflared":
    case "stopping":
      return "tone-info";
    case "paired":
      return "tone-warning";
    case "error":
      return "tone-danger";
    default:
      return "tone-muted";
  }
}

function toneForBoolean(value: boolean | null): string {
  if (value === null) return "tone-muted";
  return value ? "tone-success" : "tone-warning";
}

function showBanner(message: string, tone: "info" | "error" = "info") {
  ui.banner.textContent = message;
  ui.banner.className = `banner visible ${tone}`;
}

function clearBanner() {
  ui.banner.className = "banner info";
  ui.banner.textContent = "";
}

function setBusy(name: string, value: boolean) {
  if (value) busy.add(name);
  else busy.delete(name);
  render(snapshot);
}

function collectSettings(includeSecret: boolean): DesktopConnectorSettingsInput {
  return {
    apiBase: ui.apiBase.value.trim(),
    pairingId: ui.pairingId.value.trim(),
    pairingToken: includeSecret ? ui.pairingToken.value.trim() : "",
    connectorName: ui.connectorName.value.trim() || "EdgeIntel Connector",
    autoLaunchOnLogin: ui.autoLaunch.checked,
  };
}

async function runAction<T>(name: string, action: () => Promise<T>, successMessage?: string) {
  setBusy(name, true);
  clearBanner();
  try {
    const result = await action();
    if (successMessage) showBanner(successMessage, "info");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    showBanner(message, "error");
    throw error;
  } finally {
    setBusy(name, false);
  }
}

function syncForm(next: DesktopConnectorSnapshot) {
  ui.apiBase.value = next.apiBase ?? ui.apiBase.value;
  ui.pairingId.value = next.pairingId ?? ui.pairingId.value;
  ui.connectorName.value = next.connectorName;
  ui.autoLaunch.checked = next.autoLaunchOnLogin;
  if (next.pairing) {
    ui.pairingToken.value = "";
  }
}

function renderLogs(next: DesktopConnectorSnapshot) {
  if (!next.logs.length) {
    ui.logStream.innerHTML = `<div class="muted">No events yet. Pair the connector or start the runtime to begin streaming machine-side diagnostics.</div>`;
    return;
  }

  ui.logStream.innerHTML = next.logs
    .map(
      (entry) => `
        <article class="log-entry ${entry.level}">
          <strong>${escapeHtml(entry.scope)} · ${escapeHtml(entry.message)}</strong>
          <span class="muted">${escapeHtml(formatAbsolute(entry.timestamp))}</span>
          ${entry.detail ? `<span class="muted">${escapeHtml(entry.detail)}</span>` : ""}
        </article>
      `,
    )
    .join("");
}

function render(next: DesktopConnectorSnapshot | null) {
  if (!next) return;
  snapshot = next;
  syncForm(next);

  const runtimeLive = next.runtime.status === "running" || next.runtime.status === "degraded";
  ui.sidebarLifecycleBadge.innerHTML = `<span class="badge ${toneForLifecycle(next.lifecycle)} ${busy.size ? "pulse" : ""}">${next.lifecycle.replaceAll("_", " ")}</span>`;
  ui.sidebarPlatform.textContent = next.platform;
  ui.sidebarVersion.textContent = next.appVersion;
  ui.sidebarHostname.textContent = next.publicHostname ?? "Not paired";
  ui.sidebarHeartbeat.textContent = next.runtime.lastHeartbeatAt
    ? `${formatRelative(next.runtime.lastHeartbeatAt)}`
    : "No runtime";
  ui.sidebarConnectorName.textContent = next.connectorName;
  ui.sidebarRouteCopy.textContent = next.bootstrap
    ? `${next.bootstrap.localServiceUrl ?? "Local URL unavailable"} routed to ${next.bootstrap.publicHostname ?? "public hostname unavailable"}.`
    : "Pair the desktop app to claim its scoped tunnel bootstrap and runtime token.";

  ui.cloudflaredStatusCopy.textContent =
    next.cloudflared.status === "ready"
      ? "Ready"
      : next.cloudflared.status === "installing"
        ? "Installing"
        : next.cloudflared.status === "error"
          ? "Error"
          : "Missing";
  ui.cloudflaredVersion.textContent =
    next.cloudflared.version ?? "Version unavailable";
  ui.cloudflaredSource.textContent = next.cloudflared.binaryPath
    ? `${next.cloudflared.source ?? "system"} · ${next.cloudflared.binaryPath}`
    : next.cloudflared.message ?? "No binary detected yet";

  ui.probeStatusCopy.textContent =
    next.localProbe.reachable === null
      ? "Not tested"
      : next.localProbe.reachable
        ? "Reachable"
        : "Unreachable";
  ui.probeUrl.textContent = next.localProbe.url ?? "Route not paired yet";
  ui.probeDetail.textContent =
    next.localProbe.reachable === null
      ? "No probe data available"
      : next.localProbe.reachable
        ? `HTTP ${next.localProbe.status ?? "?"} · ${next.localProbe.latencyMs ?? 0} ms`
        : next.localProbe.error ?? "Local service probe failed.";

  ui.diagPublicHostname.textContent = next.bootstrap?.publicHostname ?? "Not paired";
  ui.diagPublicNote.textContent = next.bootstrap
    ? `Access headers ${next.bootstrap.accessHeadersPresent ? "are" : "are not"} required for this route.`
    : "Create a pairing in the control plane, then exchange it here.";
  ui.diagTunnelName.textContent = next.bootstrap?.cloudflareTunnelName ?? "Unavailable";
  ui.diagTunnelId.textContent = next.bootstrap?.cloudflareTunnelId ?? "No Cloudflare tunnel bound yet";
  ui.diagTokenExpiry.textContent = next.bootstrap?.connectorTokenExpiresAt
    ? formatAbsolute(next.bootstrap.connectorTokenExpiresAt)
    : "Unavailable";
  ui.diagTokenNote.textContent = next.bootstrap?.connectorTokenExpiresAt
    ? `Expires ${formatRelative(next.bootstrap.connectorTokenExpiresAt)}`
    : "Issued only after pairing exchange succeeds.";
  ui.diagRuntime.textContent = runtimeLive
    ? `${next.runtime.status} · PID ${next.runtime.cloudflaredPid ?? "?"}`
    : "Stopped";
  ui.diagRuntimeNote.textContent = next.runtime.lastHeartbeatNote ?? "No active `cloudflared` process.";

  if (next.lastError && !busy.size) {
    showBanner(next.lastError, "error");
  } else if (!busy.size && ui.banner.classList.contains("visible") && ui.banner.classList.contains("error")) {
    showBanner(ui.banner.textContent || "", "error");
  }

  renderLogs(next);

  const hasBootstrap = Boolean(next.bootstrap);
  const hasCloudflared = next.cloudflared.status === "ready";
  const runtimeRunningState = next.runtime.status === "running" || next.runtime.status === "degraded";
  const pairingBusy = busy.has("pair");
  const runtimeBusy = busy.has("start") || busy.has("stop");

  ui.pair.disabled = pairingBusy;
  ui.save.disabled = busy.has("save");
  ui.install.disabled = busy.has("install");
  ui.refresh.disabled = busy.has("refresh");
  ui.test.disabled = !hasBootstrap || busy.has("test");
  ui.start.disabled = !hasBootstrap || !hasCloudflared || runtimeRunningState || runtimeBusy;
  ui.stop.disabled = !runtimeRunningState || runtimeBusy;
  ui.reset.disabled = busy.has("reset");
  ui.openHostname.disabled = !Boolean(next.bootstrap?.publicHostname);
  ui.start.textContent = runtimeRunningState ? "Route running" : "Start route";
  ui.stop.textContent = busy.has("stop") ? "Stopping..." : "Stop route";
}

ui.pair.addEventListener("click", async () => {
  const input = collectSettings(true);
  await runAction(
    "pair",
    async () => {
      const result = await window.edgeIntelDesktop.pairConnector(input);
      render(result.snapshot);
      return result;
    },
    "Connector paired successfully.",
  );
});

ui.save.addEventListener("click", async () => {
  const input = collectSettings(false);
  await runAction(
    "save",
    async () => {
      const result = await window.edgeIntelDesktop.updatePreferences(input);
      render(result.snapshot);
      return result;
    },
    "Preferences updated.",
  );
});

ui.install.addEventListener("click", async () => {
  await runAction(
    "install",
    async () => {
      const result = await window.edgeIntelDesktop.installCloudflared();
      render(result.snapshot);
      return result;
    },
    "cloudflared installation complete.",
  );
});

ui.refresh.addEventListener("click", async () => {
  await runAction(
    "refresh",
    async () => {
      const result = await window.edgeIntelDesktop.refreshCloudflared();
      render(result.snapshot);
      return result;
    },
    "Daemon state refreshed.",
  );
});

ui.test.addEventListener("click", async () => {
  await runAction(
    "test",
    async () => {
      const result = await window.edgeIntelDesktop.testLocalService();
      render(result.snapshot);
      return result;
    },
    "Local service probe completed.",
  );
});

ui.start.addEventListener("click", async () => {
  await runAction(
    "start",
    async () => {
      const result = await window.edgeIntelDesktop.startRuntime();
      render(result.snapshot);
      return result;
    },
    "Connector runtime started.",
  );
});

ui.stop.addEventListener("click", async () => {
  await runAction(
    "stop",
    async () => {
      const result = await window.edgeIntelDesktop.stopRuntime();
      render(result.snapshot);
      return result;
    },
    "Connector runtime stopped.",
  );
});

ui.reset.addEventListener("click", async () => {
  await runAction(
    "reset",
    async () => {
      const result = await window.edgeIntelDesktop.resetConfiguration();
      render(result.snapshot);
      return result;
    },
    "Connector pairing reset.",
  );
});

ui.openHostname.addEventListener("click", () => {
  const hostname = snapshot?.bootstrap?.publicHostname;
  if (!hostname) return;
  void window.edgeIntelDesktop.openExternal(`https://${hostname}`);
});

window.edgeIntelDesktop.onSnapshot(({ snapshot: next }) => {
  render(next);
});

window.edgeIntelDesktop.onLog(({ entry }) => {
  if (!snapshot) return;
  render({
    ...snapshot,
    logs: [entry, ...snapshot.logs.filter((existing) => existing.id !== entry.id)].slice(0, 120),
  });
});

void window.edgeIntelDesktop
  .getSnapshot()
  .then((next) => {
    render(next);
    clearBanner();
  })
  .catch((error) => {
    showBanner(error instanceof Error ? error.message : "Failed to load connector state.", "error");
  });
