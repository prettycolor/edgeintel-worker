interface TunnelAppConfig {
  tunnelsEndpoint: string;
  providersEndpoint: string;
  zonesEndpoint: string;
  hostnameValidationEndpoint: string;
}

const TUNNEL_APP_STYLES = `
  :root {
    --bg: #ebe5d8;
    --surface: rgba(255, 255, 255, 0.74);
    --surface-strong: #fffaf2;
    --surface-dark: #11161c;
    --surface-dark-2: #171d24;
    --ink: #14171a;
    --ink-soft: rgba(20, 23, 26, 0.68);
    --ink-faint: rgba(20, 23, 26, 0.42);
    --line: rgba(20, 23, 26, 0.08);
    --line-dark: rgba(255, 255, 255, 0.08);
    --signal: #8ef061;
    --signal-soft: rgba(142, 240, 97, 0.18);
    --cyan: #7fd6ff;
    --warn: #ffae6d;
    --danger: #f36a5c;
    --radius-xl: 30px;
    --radius-lg: 22px;
    --radius-md: 16px;
    --shadow: 0 24px 70px rgba(20, 23, 26, 0.12);
  }

  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.7), transparent 24%),
      linear-gradient(180deg, #f0eadf 0%, var(--bg) 100%);
  }
  button, input, select, textarea { font: inherit; }
  button { cursor: pointer; }

  .viewport {
    width: min(1540px, calc(100vw - 36px));
    margin: 18px auto;
    padding: 20px;
    border-radius: 40px;
    background: rgba(255, 250, 242, 0.58);
    border: 1px solid rgba(255, 255, 255, 0.66);
    box-shadow: var(--shadow);
    backdrop-filter: blur(16px);
  }

  .shell {
    min-height: calc(100vh - 72px);
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    border-radius: 32px;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(255, 252, 246, 0.82), rgba(247, 241, 232, 0.88));
  }

  .sidebar {
    padding: 24px 18px 20px;
    background: linear-gradient(180deg, #111419, #171c22);
    color: white;
    border-right: 1px solid var(--line-dark);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--signal), var(--cyan));
  }

  .brand h1,
  h2,
  h3,
  h4 {
    margin: 0;
    font-family: "Space Grotesk", "Avenir Next", sans-serif;
    letter-spacing: -0.05em;
  }

  .brand h1 { font-size: 22px; }
  .brand p,
  .sidebar-copy,
  .muted,
  .label {
    margin: 0;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.55;
  }

  .sidebar-card {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 12px;
  }

  .sidebar-card strong {
    display: block;
    margin-bottom: 6px;
  }

  .nav-group { margin: 18px 0; }
  .nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.82);
    text-decoration: none;
    margin-top: 6px;
  }
  .nav-item.active { background: rgba(255,255,255,0.09); color: white; }
  .nav-item:not(.active) { color: rgba(255,255,255,0.7); }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 11px;
  }

  .main {
    position: relative;
    padding: 22px;
    overflow: hidden;
  }

  .main::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(20, 23, 26, 0.028) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20, 23, 26, 0.028) 1px, transparent 1px);
    background-size: 30px 30px;
    pointer-events: none;
  }

  .topbar, .hero, .grid {
    position: relative;
    z-index: 1;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 18px;
  }

  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 18px;
    background: rgba(255,255,255,0.66);
    border: 1px solid rgba(20,23,26,0.07);
    color: var(--ink-soft);
  }

  .top-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.68);
    border: 1px solid rgba(20,23,26,0.06);
    font-size: 13px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--signal);
    box-shadow: 0 0 0 8px rgba(142,240,97,0.12);
  }

  .hero {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 18px;
    margin-bottom: 18px;
  }

  .hero-panel,
  .surface,
  .surface-dark {
    border-radius: 26px;
    padding: 22px;
    overflow: hidden;
    position: relative;
  }

  .hero-panel {
    min-height: 260px;
    background:
      radial-gradient(circle at top right, rgba(127,214,255,0.22), transparent 36%),
      linear-gradient(145deg, #151a20 0%, #10161c 50%, #1a222b 100%);
    color: white;
  }

  .surface {
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(20,23,26,0.06);
  }

  .surface-dark {
    background: linear-gradient(180deg, #12171d, #181f27);
    color: white;
  }

  .eyebrow, .step-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  .surface-dark .eyebrow,
  .surface-dark .step-label {
    color: rgba(255,255,255,0.5);
  }

  .hero-title {
    margin: 10px 0 12px;
    max-width: 11ch;
    font-size: clamp(30px, 4vw, 52px);
    line-height: 0.96;
    letter-spacing: -0.06em;
    font-family: "Space Grotesk", "Avenir Next", sans-serif;
  }

  .hero-copy {
    max-width: 62ch;
    color: rgba(255,255,255,0.72);
    line-height: 1.6;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 20px;
  }

  .hero-stat {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .hero-stat strong,
  .summary-stat strong {
    display: block;
    font-size: 22px;
    margin-top: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: 0.88fr 1.12fr 0.92fr;
    gap: 18px;
  }

  .stack { display: grid; gap: 18px; }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .summary-stat {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255,255,255,0.58);
    border: 1px solid rgba(20,23,26,0.06);
  }

  .route-table,
  .stepper,
  .diagnostic-list {
    display: grid;
    gap: 10px;
  }

  .route-row {
    width: 100%;
    text-align: left;
    border: 0;
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(255,255,255,0.58);
    border: 1px solid rgba(20,23,26,0.05);
    display: grid;
    gap: 8px;
    transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
  }

  .route-row:hover,
  .route-row.active {
    transform: translateY(-1px);
    border-color: rgba(127,214,255,0.34);
    background: rgba(255,255,255,0.84);
  }

  .row-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(20,23,26,0.06);
  }

  .status-chip.passed,
  .status-chip.ready,
  .status-chip.connected {
    background: var(--signal-soft);
    color: #29531d;
  }

  .status-chip.warning,
  .status-chip.provisioning,
  .status-chip.awaiting_connector {
    background: rgba(255,174,109,0.18);
    color: #7a4c18;
  }

  .status-chip.failed,
  .status-chip.error,
  .status-chip.offline,
  .status-chip.degraded {
    background: rgba(243,106,92,0.16);
    color: #8d362d;
  }

  .route-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--ink-soft);
    font-size: 13px;
  }

  .step {
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid rgba(20,23,26,0.06);
    background: rgba(255,255,255,0.62);
    transform: translateY(6px);
    opacity: 0.82;
    transition: transform 220ms ease, opacity 220ms ease, border-color 220ms ease;
  }

  .step.active {
    transform: translateY(0);
    opacity: 1;
    border-color: rgba(127,214,255,0.3);
  }

  .step strong {
    display: block;
    margin-top: 8px;
    margin-bottom: 6px;
  }

  .form-stack {
    display: grid;
    gap: 12px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 8px;
  }

  .field label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-soft);
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    border: 1px solid rgba(20,23,26,0.08);
    border-radius: 16px;
    padding: 12px 14px;
    background: rgba(255,255,255,0.74);
    color: var(--ink);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(20,23,26,0.08);
    background: rgba(255,255,255,0.74);
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 6px;
  }

  .button {
    border: 0;
    border-radius: 999px;
    padding: 12px 16px;
    font-weight: 600;
    transition: transform 180ms ease, opacity 180ms ease;
  }

  .button:hover { transform: translateY(-1px); }
  .button.primary { background: var(--surface-dark); color: white; }
  .button.secondary { background: rgba(20,23,26,0.08); color: var(--ink); }
  .button.warn { background: rgba(255,174,109,0.24); color: #7a4c18; }
  .button.danger { background: rgba(243,106,92,0.18); color: #8d362d; }

  .notice {
    padding: 12px 14px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.5;
    background: rgba(20,23,26,0.05);
  }

  .notice.error { background: rgba(243,106,92,0.14); color: #8d362d; }
  .notice.success { background: var(--signal-soft); color: #29531d; }

  .diagnostic-item {
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .surface .diagnostic-item {
    background: rgba(255,255,255,0.64);
    border-color: rgba(20,23,26,0.06);
  }

  .diagnostic-item strong { display: block; margin-bottom: 6px; }

  .code-block {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: "SFMono-Regular", "IBM Plex Mono", monospace;
    font-size: 12px;
    line-height: 1.7;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    max-height: 320px;
    overflow: auto;
  }

  .surface .code-block {
    background: rgba(20,23,26,0.04);
    border-color: rgba(20,23,26,0.06);
  }

  .empty-state {
    padding: 20px;
    border-radius: 18px;
    background: rgba(255,255,255,0.62);
    border: 1px dashed rgba(20,23,26,0.14);
    color: var(--ink-soft);
  }

  @media (max-width: 1180px) {
    .shell { grid-template-columns: 1fr; }
    .hero, .grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 720px) {
    .viewport { width: calc(100vw - 18px); margin: 9px auto; padding: 10px; }
    .shell { min-height: calc(100vh - 18px); }
    .main { padding: 14px; }
    .topbar, .row-top, .route-meta { display: grid; }
    .field-grid, .summary-grid, .hero-grid { grid-template-columns: 1fr; }
  }
`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TUNNEL_APP_SCRIPT = String.raw`
  const config = window.EDGEINTEL_TUNNEL_APP;
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const state = {
    providers: [],
    zones: [],
    tunnels: [],
    selectedId: null,
    selectedDetails: null,
    selectedObservability: null,
    latestPairingSecret: null,
    hostnameValidation: null,
    saving: false,
    testing: false,
    deleting: false,
    rotating: false,
    pairing: false,
  };

  const ui = {
    routeList: document.getElementById("route-list"),
    emptyState: document.getElementById("route-empty"),
    routeForm: document.getElementById("route-form"),
    notice: document.getElementById("route-notice"),
    validationMeta: document.getElementById("route-validation-meta"),
    validationPanel: document.getElementById("route-validation"),
    diagnosticsMeta: document.getElementById("route-diagnostics-meta"),
    diagnostics: document.getElementById("route-diagnostics"),
    observabilityMeta: document.getElementById("route-observability-meta"),
    observability: document.getElementById("route-observability"),
    pairingMeta: document.getElementById("route-pairing-meta"),
    pairingList: document.getElementById("route-pairing-list"),
    pairingOutput: document.getElementById("route-pairing-output"),
    stepConnect: document.getElementById("step-connect"),
    stepPublish: document.getElementById("step-publish"),
    stepProtect: document.getElementById("step-protect"),
    stepRun: document.getElementById("step-run"),
    statTotal: document.getElementById("stat-total-routes"),
    statProtected: document.getElementById("stat-protected-routes"),
    statConnected: document.getElementById("stat-connected-routes"),
    statPassing: document.getElementById("stat-passing-routes"),
    deleteButton: document.getElementById("delete-route"),
    testButton: document.getElementById("test-route"),
    rotateButton: document.getElementById("rotate-route"),
    pairButton: document.getElementById("pair-route"),
    resetButton: document.getElementById("reset-route"),
    routeMode: document.getElementById("route-mode"),
    controlPlaneMeta: document.getElementById("control-plane-meta"),
  };

  function setNotice(message, tone) {
    if (!message) {
      ui.notice.hidden = true;
      ui.notice.textContent = "";
      ui.notice.className = "notice";
      return;
    }

    ui.notice.hidden = false;
    ui.notice.textContent = message;
    ui.notice.className = "notice " + (tone || "success");
  }

  function relativeTimestamp(value) {
    if (!value) return "No activity yet";
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return value;
    const diffMs = Date.now() - then;
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return diffMinutes + "m ago";
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return diffHours + "h ago";
    const diffDays = Math.round(diffHours / 24);
    return diffDays + "d ago";
  }

  function findSelected() {
    return state.tunnels.find((entry) => entry.id === state.selectedId) || null;
  }

  async function loadProviders() {
    const response = await fetch(config.providersEndpoint, { method: "GET" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load providers.");
    state.providers = payload.providers || [];
  }

  async function loadZones() {
    const response = await fetch(config.zonesEndpoint, { method: "GET" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load zones.");
    state.zones = payload.zones || [];
  }

  async function loadTunnels(preferredId) {
    const response = await fetch(config.tunnelsEndpoint, { method: "GET" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load tunnels.");

    state.tunnels = payload.tunnels || [];
    const preferredExists = state.tunnels.some((entry) => entry.id === preferredId);
    state.selectedId = preferredExists ? preferredId : state.tunnels[0]?.id || null;
    ui.controlPlaneMeta.textContent = payload.controlPlane?.configured
      ? "Cloudflare control plane configured"
      : "Missing: " + (payload.controlPlane?.missing || []).join(", ");
  }

  async function loadTunnelDetails(tunnelId) {
    if (!tunnelId) {
      state.selectedDetails = null;
      return;
    }
    const response = await fetch(config.tunnelsEndpoint + "/" + encodeURIComponent(tunnelId), { method: "GET" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load tunnel details.");
    state.selectedDetails = payload;
  }

  async function loadTunnelObservability(tunnelId) {
    if (!tunnelId) {
      state.selectedObservability = null;
      return;
    }
    const response = await fetch(config.tunnelsEndpoint + "/" + encodeURIComponent(tunnelId) + "/observability", {
      method: "GET",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load tunnel observability.");
    state.selectedObservability = payload.observability || null;
  }

  function renderStats() {
    const total = state.tunnels.length;
    const protectedCount = state.tunnels.filter((entry) => entry.accessProtected).length;
    const connected = state.tunnels.filter((entry) => entry.connectorStatus === "connected").length;
    const passing = state.tunnels.filter((entry) => entry.lastTestStatus === "passed").length;
    ui.statTotal.textContent = String(total).padStart(2, "0");
    ui.statProtected.textContent = String(protectedCount).padStart(2, "0");
    ui.statConnected.textContent = String(connected).padStart(2, "0");
    ui.statPassing.textContent = total ? passing + "/" + total : "00/00";
  }

  function renderRouteList() {
    ui.emptyState.hidden = state.tunnels.length > 0;
    if (!state.tunnels.length) {
      ui.routeList.innerHTML = "";
      return;
    }

    ui.routeList.innerHTML = state.tunnels.map((entry) => {
      const active = entry.id === state.selectedId;
      const status = entry.lastTestStatus || entry.status;
      return '<button class="route-row' + (active ? ' active' : '') + '" data-route-id="' + entry.id + '">' +
        '<div class="row-top"><div><strong>' + escapeHtml(entry.publicHostname) + '</strong><div class="muted">' + escapeHtml(entry.localServiceUrl) + '</div></div>' +
        '<span class="status-chip ' + escapeHtml(status) + '">' + escapeHtml(status.replace(/_/g, ' ')) + '</span></div>' +
        '<div class="route-meta"><span>' + escapeHtml(entry.cloudflareTunnelName || "Unnamed tunnel") + '</span><span>' + escapeHtml(relativeTimestamp(entry.lastConnectorHeartbeatAt || entry.updatedAt)) + '</span></div>' +
        '</button>';
    }).join("");
  }

  function populateProviderSelect(selectedProviderId) {
    const select = ui.routeForm.elements.providerSettingId;
    const options = ['<option value="">No linked provider</option>'].concat(
      state.providers.map((provider) =>
        '<option value="' + escapeHtml(provider.id) + '"' + (provider.id === selectedProviderId ? ' selected' : '') + '>' +
        escapeHtml(provider.displayName + " · " + provider.providerCode) +
        '</option>'
      )
    );
    select.innerHTML = options.join("");
  }

  function populateZoneSelect(selectedZoneId, suggestedZoneId) {
    const select = ui.routeForm.elements.cloudflareZoneId;
    const activeZoneId = selectedZoneId || suggestedZoneId || "";
    const options = ['<option value="">Auto-match from hostname</option>'].concat(
      state.zones.map((zone) =>
        '<option value="' + escapeHtml(zone.id) + '"' + (zone.id === activeZoneId ? ' selected' : '') + '>' +
        escapeHtml(zone.name + (zone.isDefault ? " · default" : "")) +
        '</option>'
      )
    );
    select.innerHTML = options.join("");
  }

  function populateForm(entry) {
    populateProviderSelect(entry?.providerSettingId || "");
    populateZoneSelect(
      entry?.cloudflareZoneId || "",
      state.hostnameValidation?.suggestedZoneId || "",
    );
    ui.routeForm.elements.tunnelId.value = entry?.id || "";
    ui.routeForm.elements.publicHostname.value = entry?.publicHostname || "";
    ui.routeForm.elements.localServiceUrl.value = entry?.localServiceUrl || "http://localhost:11434";
    ui.routeForm.elements.tunnelName.value = entry?.cloudflareTunnelName || "";
    ui.routeForm.elements.accessProtected.checked = entry?.accessProtected !== false;
    ui.routeMode.textContent = entry ? "Update tunnel route" : "Provision local model route";
    ui.deleteButton.disabled = !entry || state.deleting;
    ui.testButton.disabled = !entry || state.testing;
    ui.rotateButton.disabled = !entry || state.rotating;
    ui.pairButton.disabled = !entry || state.pairing;
  }

  function renderStepper(entry) {
    const connected = entry?.connectorStatus === "connected";
    ui.stepConnect.classList.toggle("active", true);
    ui.stepPublish.classList.toggle("active", Boolean(entry?.cloudflareTunnelId));
    ui.stepProtect.classList.toggle("active", Boolean(entry?.accessProtected));
    ui.stepRun.classList.toggle("active", connected || Boolean(entry?.lastConnectorHeartbeatAt));
  }

  function renderDiagnostics(entry) {
    const details = state.selectedDetails;
    if (!entry || !details) {
      ui.diagnosticsMeta.textContent = "Awaiting route selection";
      ui.diagnostics.innerHTML = '<div class="empty-state"><strong>No tunnel selected.</strong><div class="muted">Provision a route or pick an existing one to inspect Access, connector, and runtime status.</div></div>';
      return;
    }

    const result = entry.lastTestResult;
    ui.diagnosticsMeta.textContent = result
      ? (result.status + " · " + relativeTimestamp(result.testedAt))
      : "No test run yet";

    const diagnostics = [
      {
        title: "Cloudflare route",
        detail: entry.cloudflareTunnelId || "Tunnel not provisioned",
        helper: entry.cloudflareTunnelName || "Awaiting tunnel creation",
      },
      {
        title: "Connector status",
        detail: entry.connectorStatus || "unpaired",
        helper: entry.lastConnectorHeartbeatAt
          ? "Heartbeat " + relativeTimestamp(entry.lastConnectorHeartbeatAt)
          : "No connector heartbeat received yet",
      },
      {
        title: "Runtime test",
        detail: result?.message || "No runtime test stored",
        helper: result?.details?.runtime?.url || entry.publicHostname,
      },
      {
        title: "Access protection",
        detail: entry.accessProtected ? "Service token gate enabled" : "Public route",
        helper: entry.accessProtected
          ? "Connector exchange returns CF-Access service-token headers for runtime probes."
          : "Access application is disabled for this route.",
      },
    ];

    ui.diagnostics.innerHTML = diagnostics.map((item) =>
      '<div class="diagnostic-item"><strong>' + escapeHtml(item.title) + '</strong><div>' + escapeHtml(item.detail) + '</div><div class="muted" style="margin-top:6px">' + escapeHtml(item.helper) + '</div></div>'
    ).join("");
  }

  function renderValidation() {
    const validation = state.hostnameValidation;
    if (!validation) {
      ui.validationMeta.textContent = "Auto-match the zone from the hostname or pick one manually.";
      ui.validationPanel.innerHTML = '<div class="empty-state"><strong>No hostname validation yet.</strong><div class="muted" style="margin-top:6px">Enter a hostname to discover the matching Cloudflare zone and catch DNS conflicts before provisioning.</div></div>';
      return;
    }

    ui.validationMeta.textContent = validation.message;
    const conflictMarkup = Array.isArray(validation.conflicts) && validation.conflicts.length
      ? validation.conflicts.map((conflict) =>
          '<div class="diagnostic-item">' +
            '<strong>' + escapeHtml(conflict.type + " · " + conflict.name) + '</strong>' +
            '<div>' + escapeHtml(conflict.content || "No record content") + '</div>' +
            '<div class="muted" style="margin-top:6px">' + escapeHtml(conflict.proxied === null ? "proxied unknown" : conflict.proxied ? "proxied" : "dns only") + '</div>' +
          '</div>'
        ).join("")
      : "";

    ui.validationPanel.innerHTML =
      '<div class="diagnostic-item"><strong>Matched zone</strong><div>' + escapeHtml(validation.zone?.name || "No matching zone") + '</div><div class="muted" style="margin-top:6px">' + escapeHtml(validation.matchedBy.replace(/-/g, " ")) + '</div></div>' +
      '<div class="diagnostic-item"><strong>Suggested tunnel name</strong><div>' + escapeHtml(validation.suggestedTunnelName) + '</div><div class="muted" style="margin-top:6px">' + escapeHtml(validation.status.replace(/_/g, " ")) + '</div></div>' +
      (conflictMarkup || '<div class="diagnostic-item"><strong>DNS conflicts</strong><div>None detected</div><div class="muted" style="margin-top:6px">The hostname is clear for provisioning in the matched zone.</div></div>');
  }

  async function runHostnameValidation() {
    const publicHostname = ui.routeForm.elements.publicHostname.value.trim();
    if (!publicHostname) {
      state.hostnameValidation = null;
      populateZoneSelect(ui.routeForm.elements.cloudflareZoneId.value || "", "");
      renderValidation();
      return;
    }

    const response = await fetch(config.hostnameValidationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicHostname,
        cloudflareZoneId: ui.routeForm.elements.cloudflareZoneId.value || null,
        tunnelId: ui.routeForm.elements.tunnelId.value || null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Hostname validation failed.");
    }

    state.hostnameValidation = payload.validation || null;
    if (!ui.routeForm.elements.cloudflareZoneId.value && state.hostnameValidation?.suggestedZoneId) {
      ui.routeForm.elements.cloudflareZoneId.value = state.hostnameValidation.suggestedZoneId;
    }
    if (!ui.routeForm.elements.tunnelName.value && state.hostnameValidation?.suggestedTunnelName) {
      ui.routeForm.elements.tunnelName.value = state.hostnameValidation.suggestedTunnelName;
    }
    populateZoneSelect(
      ui.routeForm.elements.cloudflareZoneId.value || "",
      state.hostnameValidation?.suggestedZoneId || "",
    );
    renderValidation();
  }

  function renderPairings(entry) {
    const details = state.selectedDetails;
    if (!entry || !details) {
      ui.pairingMeta.textContent = "Awaiting route selection";
      ui.pairingList.innerHTML = '<div class="empty-state"><strong>No pairing issued yet.</strong><div class="muted" style="margin-top:6px">Create a route or select an existing one to issue a connector pairing.</div></div>';
      ui.pairingOutput.textContent = "{}";
      return;
    }

    const pairings = Array.isArray(details.pairings) ? details.pairings : [];
    ui.pairingMeta.textContent = pairings.length
      ? pairings[0].status.replace(/_/g, " ") + " · " + relativeTimestamp(pairings[0].lastSeenAt || pairings[0].exchangedAt || pairings[0].issuedAt)
      : "No pairing issued yet";

    ui.pairingList.innerHTML = pairings.length
      ? pairings.map((pairing) =>
          '<div class="diagnostic-item">' +
            '<strong>' + escapeHtml(pairing.connectorName || pairing.issuedByEmail || "Pending connector") + '</strong>' +
            '<div>' + escapeHtml(pairing.status.replace(/_/g, " ")) + '</div>' +
            '<div class="muted" style="margin-top:6px">' +
              escapeHtml(
                pairing.connectorExpiresAt
                  ? "Connector token expires " + relativeTimestamp(pairing.connectorExpiresAt)
                  : "Pairing token expires " + relativeTimestamp(pairing.expiresAt)
              ) +
            '</div>' +
          '</div>'
        ).join("")
      : '<div class="empty-state"><strong>No pairings issued for this route.</strong><div class="muted" style="margin-top:6px">Generate a one-time pairing to onboard the connector without exposing raw tunnel secrets in the operator UI.</div></div>';

    const currentSecret = state.latestPairingSecret && state.latestPairingSecret.tunnelId === entry.id
      ? state.latestPairingSecret
      : {
          status: "No in-memory pairing secret",
          detail: "Create a fresh pairing to hand off bootstrap exchange to the connector.",
        };
    ui.pairingOutput.textContent = JSON.stringify(currentSecret, null, 2);
  }

  function renderObservability(entry) {
    const observability = state.selectedObservability;
    if (!entry || !observability) {
      ui.observabilityMeta.textContent = "Observability loads after a route is selected.";
      ui.observability.innerHTML = '<div class="empty-state"><strong>No observability loaded.</strong><div class="muted" style="margin-top:6px">Select a route to inspect event history, version drift, and the last known good runtime test.</div></div>';
      return;
    }

    const events = Array.isArray(observability.events) ? observability.events : [];
    const latestTest = observability.latestTest || null;
    const lastKnownGood = observability.lastKnownGood || null;
    const drift = observability.versionDrift || { changed: false, current: null, previous: null };
    const failureDelta = observability.failureDelta || null;

    ui.observabilityMeta.textContent = lastKnownGood
      ? "Last known good " + relativeTimestamp(lastKnownGood.testedAt)
      : "No passing runtime test captured yet";

    const summaryCards = [
      {
        title: "Latest test",
        detail: latestTest ? latestTest.message : "No test captured",
        helper: latestTest ? relativeTimestamp(latestTest.testedAt) : "Run a tunnel test to establish a baseline.",
      },
      {
        title: "Version drift",
        detail: drift.changed ? (drift.previous + " -> " + drift.current) : (drift.current || "Stable"),
        helper: drift.changed ? "Connector runtime version changed since the previous heartbeat." : "No connector runtime drift detected.",
      },
      {
        title: "Failure delta",
        detail: failureDelta ? failureDelta.summary : "No regression against the last known good test.",
        helper: failureDelta && typeof failureDelta.latencyDeltaMs === "number"
          ? "Latency delta " + failureDelta.latencyDeltaMs + "ms"
          : "Healthy routes do not emit a failure delta.",
      },
    ];

    const eventMarkup = events.length
      ? events.slice(0, 5).map((event) =>
          '<div class="diagnostic-item"><strong>' + escapeHtml(event.summary) + '</strong><div>' + escapeHtml(event.kind) + '</div><div class="muted" style="margin-top:6px">' + escapeHtml(relativeTimestamp(event.createdAt)) + '</div></div>'
        ).join("")
      : '<div class="empty-state"><strong>No tunnel events recorded yet.</strong><div class="muted" style="margin-top:6px">Provision, pair, test, or reconnect the route to build an event timeline.</div></div>';

    ui.observability.innerHTML = summaryCards
      .map((card) =>
        '<div class="diagnostic-item"><strong>' + escapeHtml(card.title) + '</strong><div>' + escapeHtml(card.detail) + '</div><div class="muted" style="margin-top:6px">' + escapeHtml(card.helper) + '</div></div>'
      )
      .join("") + eventMarkup;
  }

  function collectPayload() {
    return {
      providerSettingId: ui.routeForm.elements.providerSettingId.value || null,
      cloudflareZoneId: ui.routeForm.elements.cloudflareZoneId.value.trim() || null,
      publicHostname: ui.routeForm.elements.publicHostname.value.trim(),
      localServiceUrl: ui.routeForm.elements.localServiceUrl.value.trim(),
      tunnelName: ui.routeForm.elements.tunnelName.value.trim() || null,
      accessProtected: ui.routeForm.elements.accessProtected.checked,
    };
  }

  async function refresh(preferredId) {
    await Promise.all([loadProviders(), loadTunnels(preferredId), loadZones()]);
    await loadTunnelDetails(state.selectedId);
    await loadTunnelObservability(state.selectedId);
    const entry = findSelected();
    if (!entry || state.latestPairingSecret?.tunnelId !== entry.id) {
      state.latestPairingSecret = null;
    }
    state.hostnameValidation = null;
    renderStats();
    renderRouteList();
    populateForm(entry);
    await runHostnameValidation().catch((error) => {
      state.hostnameValidation = {
        status: "invalid",
        hostname: ui.routeForm.elements.publicHostname.value.trim(),
        zone: null,
        matchedBy: "none",
        suggestedZoneId: null,
        suggestedTunnelName: "",
        conflicts: [],
        existingTunnelRecordConflict: false,
        message: error instanceof Error ? error.message : "Hostname validation failed.",
      };
      renderValidation();
    });
    renderStepper(entry);
    renderDiagnostics(entry);
    renderObservability(entry);
    renderPairings(entry);
  }

  async function saveRoute(event) {
    event.preventDefault();
    state.saving = true;
    setNotice("Saving route…");
    try {
      const tunnelId = ui.routeForm.elements.tunnelId.value || null;
      const method = tunnelId ? "PATCH" : "POST";
      const target = tunnelId
        ? config.tunnelsEndpoint + "/" + encodeURIComponent(tunnelId)
        : config.tunnelsEndpoint;
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPayload()),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to save tunnel.");
      setNotice(tunnelId ? "Tunnel route updated." : "Tunnel route provisioned.");
      await refresh(payload.tunnel?.id || tunnelId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save tunnel.", "error");
    } finally {
      state.saving = false;
    }
  }

  async function runTest() {
    const entry = findSelected();
    if (!entry) return;
    state.testing = true;
    setNotice("Running tunnel test…");
    try {
      const response = await fetch(config.tunnelsEndpoint + "/" + encodeURIComponent(entry.id) + "/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persistResult: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.testResult?.message || "Tunnel test failed.");
      setNotice("Tunnel test completed.");
      await refresh(entry.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Tunnel test failed.", "error");
    } finally {
      state.testing = false;
    }
  }

  async function rotateToken() {
    const entry = findSelected();
    if (!entry) return;
    state.rotating = true;
    setNotice("Rotating scoped tunnel bootstrap…");
    try {
      const response = await fetch(config.tunnelsEndpoint + "/" + encodeURIComponent(entry.id) + "/rotate-token", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Token rotation failed.");
      state.latestPairingSecret = null;
      setNotice(payload?.nextStep || "Tunnel bootstrap rotated.");
      await refresh(entry.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Token rotation failed.", "error");
    } finally {
      state.rotating = false;
    }
  }

  async function createPairing() {
    const entry = findSelected();
    if (!entry) return;
    state.pairing = true;
    setNotice("Creating one-time connector pairing…");
    try {
      const response = await fetch("/api/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tunnelId: entry.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to create pairing.");
      state.latestPairingSecret = payload.pairingSecret || null;
      setNotice("One-time pairing created. Hand it to the connector before it expires.");
      await refresh(entry.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create pairing.", "error");
    } finally {
      state.pairing = false;
    }
  }

  async function deleteRoute() {
    const entry = findSelected();
    if (!entry) return;
    state.deleting = true;
    setNotice("Deleting route…");
    try {
      const response = await fetch(config.tunnelsEndpoint + "/" + encodeURIComponent(entry.id), {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Route deletion failed.");
      setNotice("Route deleted.");
      await refresh(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Route deletion failed.", "error");
    } finally {
      state.deleting = false;
    }
  }

  ui.routeList.addEventListener("click", async (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-route-id]")
      : null;
    if (!target) return;
    const routeId = target.getAttribute("data-route-id");
    if (!routeId) return;
    state.selectedId = routeId;
    await loadTunnelDetails(routeId);
    await loadTunnelObservability(routeId);
    const entry = findSelected();
    if (state.latestPairingSecret?.tunnelId !== routeId) {
      state.latestPairingSecret = null;
    }
    renderRouteList();
    populateForm(entry);
    await runHostnameValidation().catch((error) => {
      state.hostnameValidation = {
        status: "invalid",
        hostname: ui.routeForm.elements.publicHostname.value.trim(),
        zone: null,
        matchedBy: "none",
        suggestedZoneId: null,
        suggestedTunnelName: "",
        conflicts: [],
        existingTunnelRecordConflict: false,
        message: error instanceof Error ? error.message : "Hostname validation failed.",
      };
      renderValidation();
    });
    renderStepper(entry);
    renderDiagnostics(entry);
    renderObservability(entry);
    renderPairings(entry);
  });

  ui.routeForm.addEventListener("submit", saveRoute);
  ui.testButton.addEventListener("click", runTest);
  ui.rotateButton.addEventListener("click", rotateToken);
  ui.pairButton.addEventListener("click", createPairing);
  ui.deleteButton.addEventListener("click", deleteRoute);
  ui.routeForm.elements.publicHostname.addEventListener("blur", () => {
    runHostnameValidation().catch((error) => {
      setNotice(error instanceof Error ? error.message : "Hostname validation failed.", "error");
    });
  });
  ui.routeForm.elements.cloudflareZoneId.addEventListener("change", () => {
    runHostnameValidation().catch((error) => {
      setNotice(error instanceof Error ? error.message : "Hostname validation failed.", "error");
    });
  });
  ui.resetButton.addEventListener("click", async () => {
    state.selectedId = null;
    state.selectedDetails = null;
    state.selectedObservability = null;
    state.latestPairingSecret = null;
    state.hostnameValidation = null;
    populateForm(null);
    renderValidation();
    renderStepper(null);
    renderDiagnostics(null);
    renderObservability(null);
    renderPairings(null);
    setNotice(null);
  });

  refresh(null).catch((error) => {
    setNotice(error instanceof Error ? error.message : "Failed to load tunnel workspace.", "error");
  });
`;

export function renderTunnelControlPlaneApp(config: TunnelAppConfig): string {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>EdgeIntel Tunnel Control Plane</title>
      <style>${TUNNEL_APP_STYLES}</style>
    </head>
    <body>
      <div class="viewport">
        <div class="shell">
          <aside class="sidebar">
            <div class="brand">
              <div class="brand-mark"></div>
              <div>
                <h1>EdgeIntel</h1>
                <p>Cloudflare-native local model orchestration</p>
              </div>
            </div>

            <div class="sidebar-card">
              <strong>Local model routes</strong>
              <p class="sidebar-copy">
                Provider onboarding stays separate from runtime route orchestration so the operator can wire credentials and local infrastructure independently.
              </p>
            </div>

            <nav class="nav-group">
              <a class="nav-item" href="/app">
                <span>Overview</span>
                <span class="badge">live</span>
              </a>
              <a class="nav-item" href="/app/providers">
                <span>Provider control plane</span>
                <span class="badge">API</span>
              </a>
              <a class="nav-item" href="/app/scans">
                <span>Scans</span>
                <span class="badge">ops</span>
              </a>
              <a class="nav-item" href="/app/exports">
                <span>Exports</span>
                <span class="badge">brief</span>
              </a>
              <a class="nav-item active" href="/app/tunnels">
                <span>Local model routes</span>
                <span class="badge">Tunnel</span>
              </a>
            </nav>

            <div class="sidebar-card">
              <strong>Connector path</strong>
              <p class="sidebar-copy">
                The Worker provisions Tunnel, DNS, and Access. A local connector or <code>cloudflared</code> process still has to run on the machine hosting the model.
              </p>
            </div>

            <div class="sidebar-card">
              <strong>Review rule</strong>
              <p class="sidebar-copy">
                Create route, run tunnel test, confirm heartbeat, then move to the next phase. The UI is built around that exact workflow.
              </p>
            </div>
          </aside>

          <main class="main">
            <div class="topbar">
              <div class="search">Local model onboarding, tunnel control, and connector diagnostics all live inside the same Worker-served app shell.</div>
              <div class="top-actions">
                <div class="pill"><span class="dot"></span><span id="control-plane-meta">Checking Cloudflare control plane…</span></div>
                <a class="pill" href="/app/providers" style="text-decoration:none;color:inherit">Provider settings</a>
              </div>
            </div>

            <section class="hero">
              <div class="hero-panel">
                <div class="eyebrow">Phase 7C to 7E</div>
                <div class="hero-title">Provision the local route once, then let the connector keep it alive.</div>
                <p class="hero-copy">
                  This workspace handles the Cloudflare side of the system: remotely managed Tunnel creation, proxied DNS routing, optional Access protection, runtime tests, token rotation, and one-time pairing delivery for the local connector.
                </p>
                <div class="hero-grid">
                  <div class="hero-stat">
                    <div class="eyebrow">Total routes</div>
                    <strong id="stat-total-routes">00</strong>
                  </div>
                  <div class="hero-stat">
                    <div class="eyebrow">Access protected</div>
                    <strong id="stat-protected-routes">00</strong>
                  </div>
                  <div class="hero-stat">
                    <div class="eyebrow">Connector online</div>
                    <strong id="stat-connected-routes">00</strong>
                  </div>
                  <div class="hero-stat">
                    <div class="eyebrow">Passing tests</div>
                    <strong id="stat-passing-routes">00/00</strong>
                  </div>
                </div>
              </div>

              <div class="surface">
                <div class="eyebrow">Wizard steps</div>
                <h3 style="margin-top:10px">The route wizard is the product.</h3>
                <div class="stepper" style="margin-top:16px">
                  <div id="step-connect" class="step">
                    <div class="step-label">Step 1</div>
                    <strong>Link the provider route</strong>
                    <div class="muted">Pick the provider record this tunnel should feed so tests can use the right probe path and auth assumptions.</div>
                  </div>
                  <div id="step-publish" class="step">
                    <div class="step-label">Step 2</div>
                    <strong>Publish the hostname</strong>
                    <div class="muted">EdgeIntel provisions the remotely managed tunnel and the proxied CNAME to <code>&lt;tunnel-id&gt;.cfargotunnel.com</code>.</div>
                  </div>
                  <div id="step-protect" class="step">
                    <div class="step-label">Step 3</div>
                    <strong>Gate with Access</strong>
                    <div class="muted">Optional service-token protection is created in the same flow so local models are not exposed without an auth layer.</div>
                  </div>
                  <div id="step-run" class="step">
                    <div class="step-label">Step 4</div>
                    <strong>Run the connector</strong>
                    <div class="muted">The connector exchanges a one-time pairing for scoped bootstrap and keeps heartbeats flowing back to EdgeIntel.</div>
                  </div>
                </div>
              </div>
            </section>

            <section class="grid">
              <div class="stack">
                <div class="surface">
                  <div class="eyebrow">Tunnel roster</div>
                  <h3 style="margin-top:10px">Provisioned routes</h3>
                  <div id="route-empty" class="empty-state" hidden>
                    <strong>No routes provisioned yet.</strong>
                    <div class="muted" style="margin-top:6px">Use the wizard to create the first local model route for your cloudflared connector.</div>
                  </div>
                  <div id="route-list" class="route-table" style="margin-top:14px"></div>
                </div>

                <div class="surface-dark">
                  <div class="eyebrow">Diagnostics</div>
                  <h3 style="margin-top:10px">Route health and runtime proof</h3>
                  <div id="route-diagnostics-meta" class="muted" style="margin-top:10px">Awaiting route selection</div>
                  <div id="route-diagnostics" class="diagnostic-list" style="margin-top:14px"></div>
                </div>

                <div class="surface">
                  <div class="eyebrow">Observability</div>
                  <h3 style="margin-top:10px">Event history and drift</h3>
                  <div id="route-observability-meta" class="muted" style="margin-top:10px">Observability loads after a route is selected.</div>
                  <div id="route-observability" class="diagnostic-list" style="margin-top:14px">
                    <div class="empty-state">
                      <strong>No observability loaded.</strong>
                      <div class="muted" style="margin-top:6px">Select a route to inspect event history, version drift, and the last known good runtime test.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="surface">
                <div class="eyebrow">Provisioning wizard</div>
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:10px">
                  <h3 id="route-mode">Provision local model route</h3>
                  <div class="muted">Cloudflare Tunnel, DNS, Access, pairings</div>
                </div>
                <form id="route-form" class="form-stack" style="margin-top:16px">
                  <input type="hidden" name="tunnelId" />
                  <div id="route-notice" class="notice" hidden></div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="providerSettingId">Linked provider</label>
                      <select id="providerSettingId" name="providerSettingId"></select>
                    </div>
                    <div class="field">
                      <label for="cloudflareZoneId">Cloudflare zone</label>
                      <select id="cloudflareZoneId" name="cloudflareZoneId"></select>
                    </div>
                  </div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="publicHostname">Public hostname</label>
                      <input id="publicHostname" name="publicHostname" placeholder="llm.example.com" required />
                    </div>
                    <div class="field">
                      <label for="tunnelName">Tunnel name</label>
                      <input id="tunnelName" name="tunnelName" placeholder="edgeintel-llm-example-com" />
                    </div>
                  </div>

                  <div class="field">
                    <label for="localServiceUrl">Local service URL</label>
                    <input id="localServiceUrl" name="localServiceUrl" placeholder="http://localhost:11434" required />
                  </div>

                  <label class="toggle">
                    <input id="accessProtected" name="accessProtected" type="checkbox" checked />
                    <span>Protect the route with Cloudflare Access service tokens</span>
                  </label>

                  <div class="surface" style="padding:16px">
                    <div class="eyebrow">Hostname validation</div>
                    <div id="route-validation-meta" class="muted" style="margin-top:10px">Auto-match the zone from the hostname or pick one manually.</div>
                    <div id="route-validation" class="diagnostic-list" style="margin-top:14px">
                      <div class="empty-state">
                        <strong>No hostname validation yet.</strong>
                        <div class="muted" style="margin-top:6px">Enter a hostname to discover the matching Cloudflare zone and catch DNS conflicts before provisioning.</div>
                      </div>
                    </div>
                  </div>

                  <div class="button-row">
                    <button id="reset-route" class="button secondary" type="button">New route</button>
                    <button id="delete-route" class="button danger" type="button">Delete</button>
                    <button id="test-route" class="button secondary" type="button">Run test</button>
                    <button id="pair-route" class="button secondary" type="button">Create pairing</button>
                    <button id="rotate-route" class="button warn" type="button">Rotate bootstrap</button>
                    <button class="button primary" type="submit">Save route</button>
                  </div>
                </form>
              </div>

              <div class="stack">
                <div class="surface-dark">
                  <div class="eyebrow">Connector pairing</div>
                  <h3 style="margin-top:10px">Scoped handoff to the local agent</h3>
                  <div class="muted" style="margin-top:10px">
                    Pairings are one-time operator handoffs. The connector exchanges the pairing token for scoped tunnel bootstrap plus its own bearer token, so raw secrets never live in ordinary tunnel responses.
                  </div>
                  <div id="route-pairing-meta" class="muted" style="margin-top:10px">Awaiting route selection</div>
                  <div id="route-pairing-list" class="diagnostic-list" style="margin-top:14px"></div>
                  <pre id="route-pairing-output" class="code-block" style="margin-top:14px">{}</pre>
                </div>

                <div class="surface">
                  <div class="eyebrow">Operator notes</div>
                  <h3 style="margin-top:10px">What this page proves</h3>
                  <div class="summary-grid">
                    <div class="summary-stat">
                      <div class="eyebrow">Control plane</div>
                      <strong>Provisioned</strong>
                      <div class="muted">Tunnel, DNS, and Access come from one Worker API.</div>
                    </div>
                    <div class="summary-stat">
                      <div class="eyebrow">Runtime</div>
                      <strong>Tested</strong>
                      <div class="muted">The route test checks both Cloudflare state and the public hostname.</div>
                    </div>
                    <div class="summary-stat">
                      <div class="eyebrow">Connector</div>
                      <strong>Scoped</strong>
                      <div class="muted">Pairing exchange keeps bootstrap off the ordinary operator API surface.</div>
                    </div>
                    <div class="summary-stat">
                      <div class="eyebrow">Roadmap fit</div>
                      <strong>Packagable</strong>
                      <div class="muted">This same pairing contract can be wrapped in a native desktop onboarding experience later.</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <script>window.EDGEINTEL_TUNNEL_APP = ${JSON.stringify(config)};</script>
      <script>${TUNNEL_APP_SCRIPT}</script>
    </body>
  </html>`;
}
