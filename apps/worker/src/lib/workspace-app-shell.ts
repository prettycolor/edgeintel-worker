interface WorkspaceOverviewAppConfig {
  sessionEndpoint: string;
  providersEndpoint: string;
  tunnelsEndpoint: string;
  recentScansEndpoint: string;
}

interface ScanWorkspaceAppConfig {
  createScanEndpoint: string;
  recentScansEndpoint: string;
  scanEndpointBase: string;
  domainEndpointBase: string;
  exportEndpointBase: string;
  initialView?: "scans" | "exports";
}

const WORKSPACE_STYLES = `
  :root {
    --bg: #ebe5d8;
    --surface: rgba(255, 255, 255, 0.72);
    --surface-strong: #fffaf2;
    --surface-dark: #12171d;
    --surface-dark-2: #171d24;
    --ink: #14171a;
    --ink-soft: rgba(20, 23, 26, 0.66);
    --ink-faint: rgba(20, 23, 26, 0.42);
    --line: rgba(20, 23, 26, 0.08);
    --line-dark: rgba(255, 255, 255, 0.08);
    --signal: #8ef061;
    --signal-soft: rgba(142, 240, 97, 0.16);
    --cyan: #7fd6ff;
    --warn: #ffae6d;
    --danger: #f36a5c;
    --radius-xl: 30px;
    --radius-lg: 22px;
    --radius-md: 16px;
    --shadow: 0 24px 70px rgba(20, 23, 26, 0.12);
  }

  * {
    box-sizing: border-box;
  }

  html {
    color-scheme: light;
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.68), transparent 22%),
      linear-gradient(180deg, #f0eadf 0%, var(--bg) 100%);
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  a {
    color: inherit;
  }

  .viewport {
    width: min(1520px, calc(100vw - 36px));
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
    margin-bottom: 26px;
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

  .brand h1 {
    font-size: 22px;
  }

  .nav-meta,
  .eyebrow,
  .label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nav-group {
    display: grid;
    gap: 10px;
    margin-top: 24px;
  }

  .nav-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    text-decoration: none;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      background 180ms ease;
  }

  .nav-item:hover {
    transform: translateX(3px);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .nav-item.active {
    background: rgba(142, 240, 97, 0.12);
    border-color: rgba(142, 240, 97, 0.2);
    color: white;
  }

  .badge {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
  }

  .sidebar-card,
  .sidebar-footer {
    margin-top: 24px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sidebar-copy,
  .sidebar-footer p {
    margin: 8px 0 0;
    color: rgba(255, 255, 255, 0.68);
    line-height: 1.5;
    font-size: 14px;
  }

  .main {
    padding: 22px 24px 28px;
    display: grid;
    gap: 18px;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .search {
    flex: 1;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid var(--line);
    color: var(--ink-soft);
  }

  .top-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid var(--line);
    font-size: 13px;
    color: var(--ink-soft);
    text-decoration: none;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--signal);
    box-shadow: 0 0 0 5px var(--signal-soft);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr);
    gap: 18px;
  }

  .surface,
  .surface-dark {
    border-radius: var(--radius-xl);
    padding: 24px;
    border: 1px solid var(--line);
  }

  .surface {
    background: var(--surface);
  }

  .surface-dark {
    color: white;
    background:
      radial-gradient(circle at top right, rgba(127, 214, 255, 0.18), transparent 28%),
      linear-gradient(180deg, var(--surface-dark), var(--surface-dark-2));
    border-color: rgba(255, 255, 255, 0.08);
  }

  .surface-dark p,
  .surface-dark .muted {
    color: rgba(255, 255, 255, 0.68);
  }

  .hero-copy,
  .surface p {
    margin: 12px 0 0;
    color: var(--ink-soft);
    line-height: 1.65;
    font-size: 15px;
  }

  .surface-dark .hero-copy {
    color: rgba(255, 255, 255, 0.72);
  }

  .stat-strip,
  .card-grid {
    display: grid;
    gap: 14px;
    margin-top: 20px;
  }

  .stat-strip {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }

  .card-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .stat,
  .mini-card {
    border-radius: 18px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid var(--line);
  }

  .surface-dark .stat {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .stat strong,
  .mini-card strong {
    display: block;
    margin-top: 10px;
    font-size: 28px;
    letter-spacing: -0.06em;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.05fr);
    gap: 18px;
  }

  .stack {
    display: grid;
    gap: 18px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .section-header p {
    margin: 8px 0 0;
    color: var(--ink-soft);
  }

  .muted {
    color: var(--ink-soft);
    font-size: 14px;
  }

  .small {
    font-size: 13px;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .button,
  button.button {
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px solid transparent;
    font-weight: 600;
    background: linear-gradient(135deg, #1d262e, #273341);
    color: white;
  }

  .button.secondary,
  button.button.secondary {
    background: rgba(20, 23, 26, 0.04);
    border-color: var(--line);
    color: var(--ink);
  }

  .button.warn,
  button.button.warn {
    background: rgba(255, 174, 109, 0.18);
    border-color: rgba(255, 174, 109, 0.34);
    color: #8b4d0f;
  }

  .button.danger,
  button.button.danger {
    background: rgba(243, 106, 92, 0.16);
    border-color: rgba(243, 106, 92, 0.28);
    color: #a33529;
  }

  .button[disabled],
  button[disabled] {
    opacity: 0.58;
    cursor: not-allowed;
  }

  .form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    margin-top: 18px;
  }

  input[type="text"],
  textarea,
  select {
    width: 100%;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(20, 23, 26, 0.12);
    background: rgba(255, 255, 255, 0.78);
    color: var(--ink);
  }

  textarea {
    min-height: 150px;
    resize: vertical;
  }

  .notice,
  .empty-state,
  .code-block {
    border-radius: 18px;
    padding: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.6);
  }

  .notice {
    margin-top: 16px;
  }

  .notice.warn {
    background: rgba(255, 174, 109, 0.12);
    border-color: rgba(255, 174, 109, 0.26);
  }

  .notice.danger {
    background: rgba(243, 106, 92, 0.12);
    border-color: rgba(243, 106, 92, 0.26);
  }

  .notice.success {
    background: rgba(142, 240, 97, 0.14);
    border-color: rgba(142, 240, 97, 0.26);
  }

  .scan-list,
  .meta-list {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .scan-row {
    width: 100%;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.64);
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .scan-row:hover {
    transform: translateY(-2px);
    border-color: rgba(20, 23, 26, 0.16);
  }

  .scan-row.active {
    border-color: rgba(127, 214, 255, 0.4);
    background: rgba(127, 214, 255, 0.14);
  }

  .row-top,
  .row-bottom {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .row-bottom {
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .row-domain {
    font-size: 17px;
    font-weight: 700;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .status-chip.completed,
  .status-chip.ready,
  .status-chip.connected,
  .status-chip.passed {
    background: rgba(142, 240, 97, 0.18);
    color: #315f17;
  }

  .status-chip.completed_with_failures,
  .status-chip.warning,
  .status-chip.processing {
    background: rgba(255, 174, 109, 0.18);
    color: #8a4d10;
  }

  .status-chip.failed,
  .status-chip.error,
  .status-chip.offline {
    background: rgba(243, 106, 92, 0.18);
    color: #932c22;
  }

  .status-chip.queued,
  .status-chip.draft,
  .status-chip.unpaired,
  .status-chip.awaiting_connector {
    background: rgba(20, 23, 26, 0.08);
    color: var(--ink-soft);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .fact {
    padding: 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.58);
    border: 1px solid var(--line);
  }

  .fact strong {
    display: block;
    margin-top: 8px;
    font-size: 20px;
    letter-spacing: -0.05em;
  }

  .list-card {
    display: grid;
    gap: 10px;
    margin-top: 16px;
  }

  .list-row {
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.58);
  }

  .list-row strong {
    display: block;
  }

  .markdown-preview {
    white-space: pre-wrap;
    line-height: 1.6;
    font-size: 14px;
  }

  .anchor-target {
    scroll-margin-top: 24px;
  }

  @media (max-width: 1200px) {
    .hero-grid,
    .content-grid {
      grid-template-columns: 1fr;
    }

    .topbar {
      flex-direction: column;
      align-items: stretch;
    }
  }

  @media (max-width: 900px) {
    .viewport {
      width: min(100vw, calc(100vw - 18px));
      margin: 9px;
      padding: 12px;
      border-radius: 24px;
    }

    .shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: 0;
      border-bottom: 1px solid var(--line-dark);
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
`;

function navItem(
  href: string,
  label: string,
  badge: string,
  active: boolean,
): string {
  return `<a class="nav-item${active ? " active" : ""}" href="${href}">
    <span>${label}</span>
    <span class="badge">${badge}</span>
  </a>`;
}

function renderSidebar(active: "overview" | "providers" | "scans" | "exports" | "tunnels"): string {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <h1>EdgeIntel</h1>
          <p>Authenticated operator workspace</p>
        </div>
      </div>

      <div class="sidebar-card">
        <strong>Operator surface</strong>
        <p class="sidebar-copy">
          The Worker now serves a real control-plane workspace: overview, provider controls,
          scan operations, export generation, and tunnel orchestration all live on the same
          protected domain.
        </p>
      </div>

      <div class="nav-group">
        <div class="nav-meta">Workspace</div>
        ${navItem("/app", "Overview", "live", active === "overview")}
        ${navItem("/app/providers", "AI connectivity", "live", active === "providers")}
        ${navItem("/app/scans", "Scans", "live", active === "scans")}
        ${navItem("/app/exports", "Exports", "live", active === "exports")}
      </div>

      <div class="nav-group">
        <div class="nav-meta">Runtime</div>
        ${navItem("/app/tunnels", "Local model routes", "tunnel", active === "tunnels")}
        ${navItem("/app/tunnels#route-pairing-output", "Connector pairing", "route", false)}
        ${navItem("/app/tunnels#route-form", "Local wizard", "wizard", false)}
        ${navItem("/app/tunnels#route-observability", "Health history", "obs", false)}
      </div>

      <div class="sidebar-footer">
        <strong>Review rule</strong>
        <p>
          The dashboard should only advertise routes the Worker can actually serve. This shell
          removes dead navigation and exposes scan/export workflows that were previously API-only.
        </p>
      </div>
    </aside>
  `;
}

function renderOverviewScript(config: WorkspaceOverviewAppConfig): string {
  return `
    <script>
      window.EDGEINTEL_WORKSPACE_APP = ${JSON.stringify(config)};

      (() => {
        const config = window.EDGEINTEL_WORKSPACE_APP;
        const state = { providers: [], tunnels: [], scans: [] };

        const byId = (id) => document.getElementById(id);
        const statusClass = (value) => String(value || 'draft').replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
        const formatTime = (value) => {
          if (!value) return 'Pending';
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
        };
        const escapeHtml = (value) =>
          String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        async function fetchJson(url) {
          const response = await fetch(url, { headers: { accept: 'application/json' } });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || ('Request failed for ' + url));
          }
          return payload;
        }

        function renderProviders(providers) {
          const host = byId('overview-providers');
          if (!host) return;
          if (!providers.length) {
            host.innerHTML = '<div class="empty-state">No provider records yet. Start in the AI connectivity workspace.</div>';
            return;
          }
          host.innerHTML = providers.slice(0, 4).map((provider) => {
            const capability = provider.capability || {};
            return '<div class="list-row">' +
              '<div class="row-top"><strong>' + escapeHtml(provider.displayName) + '</strong>' +
              '<span class="status-chip ' + statusClass(provider.status) + '">' + escapeHtml(provider.status) + '</span></div>' +
              '<div class="row-bottom small muted">' +
              '<span>' + escapeHtml(provider.providerCode) + '</span>' +
              '<span>' + escapeHtml(capability.primaryAuthLabel || provider.authStrategy) + '</span>' +
              '<span>' + escapeHtml(provider.defaultModel || 'No default model') + '</span>' +
              '</div></div>';
          }).join('');
        }

        function renderRoutes(tunnels) {
          const host = byId('overview-routes');
          if (!host) return;
          if (!tunnels.length) {
            host.innerHTML = '<div class="empty-state">No local model routes yet. Use the tunnel workspace to provision one.</div>';
            return;
          }
          host.innerHTML = tunnels.slice(0, 4).map((route) => {
            return '<div class="list-row">' +
              '<div class="row-top"><strong>' + escapeHtml(route.publicHostname) + '</strong>' +
              '<span class="status-chip ' + statusClass(route.status) + '">' + escapeHtml(route.status) + '</span></div>' +
              '<div class="row-bottom small muted">' +
              '<span>' + escapeHtml(route.localServiceUrl) + '</span>' +
              '<span>Connector ' + escapeHtml(route.connectorStatus) + '</span>' +
              '<span>' + (route.accessProtected ? 'Access protected' : 'Open route') + '</span>' +
              '</div></div>';
          }).join('');
        }

        function renderScans(scans) {
          const host = byId('overview-scans');
          if (!host) return;
          if (!scans.length) {
            host.innerHTML = '<div class="empty-state">No scans yet. Kick off a domain scan from the scan workspace.</div>';
            return;
          }
          host.innerHTML = scans.slice(0, 5).map((entry) => {
            return '<div class="list-row">' +
              '<div class="row-top"><strong>' + escapeHtml(entry.run.domain) + '</strong>' +
              '<span class="status-chip ' + statusClass(entry.run.status) + '">' + escapeHtml(entry.run.status) + '</span></div>' +
              '<div class="row-bottom small muted">' +
              '<span>' + escapeHtml(String(entry.metrics.findingCount)) + ' findings</span>' +
              '<span>' + escapeHtml(String(entry.metrics.recommendationCount)) + ' recommendations</span>' +
              '<span>' + escapeHtml(formatTime(entry.run.createdAt)) + '</span>' +
              '</div></div>';
          }).join('');
        }

        async function load() {
          try {
            const [sessionData, providerData, tunnelData, scanData] = await Promise.all([
              fetchJson(config.sessionEndpoint),
              fetchJson(config.providersEndpoint),
              fetchJson(config.tunnelsEndpoint),
              fetchJson(config.recentScansEndpoint),
            ]);

            state.providers = providerData.providers || [];
            state.tunnels = tunnelData.tunnels || [];
            state.scans = scanData.scans || [];

            const readyProviders = state.providers.filter((provider) => provider.status === 'ready').length;
            const localProviders = state.providers.filter((provider) => String(provider.kind || '').startsWith('local')).length;
            const activeRoutes = state.tunnels.filter((route) => route.status === 'ready').length;
            const connectedRoutes = state.tunnels.filter((route) => route.connectorStatus === 'connected').length;
            const passedScans = state.scans.filter((entry) => entry.run.status === 'completed').length;

            byId('operator-email').textContent = sessionData.session?.email || sessionData.session?.subject || 'Access operator';
            byId('stat-provider-ready').textContent = readyProviders + '/' + state.providers.length;
            byId('stat-provider-local').textContent = String(localProviders);
            byId('stat-route-ready').textContent = activeRoutes + '/' + state.tunnels.length;
            byId('stat-route-connected').textContent = String(connectedRoutes);
            byId('stat-scan-recent').textContent = String(state.scans.length);
            byId('stat-scan-passing').textContent = passedScans + '/' + state.scans.length;
            byId('workspace-sync').textContent = 'Synced ' + new Date().toLocaleTimeString();

            renderProviders(state.providers);
            renderRoutes(state.tunnels);
            renderScans(state.scans);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load workspace.';
            byId('workspace-error').hidden = false;
            byId('workspace-error').textContent = message;
          }
        }

        load();
      })();
    </script>
  `;
}

function renderScanScript(config: ScanWorkspaceAppConfig & { initialView: "scans" | "exports" }): string {
  return `
    <script>
      window.EDGEINTEL_SCAN_WORKSPACE = ${JSON.stringify(config)};

      (() => {
        const config = window.EDGEINTEL_SCAN_WORKSPACE;
        const state = {
          scans: [],
          selectedRunId: null,
          selectedRun: null,
          selectedBrief: null,
          selectedExports: [],
          selectedHistory: [],
          currentJobId: null,
          pollTimer: null,
        };

        const byId = (id) => document.getElementById(id);
        const escapeHtml = (value) =>
          String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const statusClass = (value) => String(value || 'draft').replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
        const formatTime = (value) => {
          if (!value) return 'Pending';
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
        };
        const findScan = (scanRunId) => state.scans.find((entry) => entry.run.id === scanRunId) || null;

        async function fetchJson(url, options) {
          const response = await fetch(url, {
            headers: { accept: 'application/json', ...(options?.headers || {}) },
            ...options,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || ('Request failed for ' + url));
          }
          return payload;
        }

        function showNotice(message, tone) {
          const host = byId('scan-notice');
          host.hidden = false;
          host.className = 'notice' + (tone ? ' ' + tone : '');
          host.textContent = message;
        }

        function clearNotice() {
          const host = byId('scan-notice');
          host.hidden = true;
          host.className = 'notice';
          host.textContent = '';
        }

        function renderScanList() {
          const host = byId('scan-run-list');
          if (!state.scans.length) {
            host.innerHTML = '<div class="empty-state">No scan runs yet. Enter a domain and create the first job.</div>';
            return;
          }

          host.innerHTML = state.scans.map((entry) => {
            const active = entry.run.id === state.selectedRunId;
            const failedModules = Array.isArray(entry.metrics.failedModules) && entry.metrics.failedModules.length
              ? entry.metrics.failedModules.join(', ')
              : 'none';

            return '<button class="scan-row' + (active ? ' active' : '') + '" data-scan-id="' + escapeHtml(entry.run.id) + '">' +
              '<div class="row-top"><span class="row-domain">' + escapeHtml(entry.run.domain) + '</span>' +
              '<span class="status-chip ' + statusClass(entry.run.status) + '">' + escapeHtml(entry.run.status) + '</span></div>' +
              '<div class="row-bottom small muted">' +
              '<span>' + escapeHtml(String(entry.metrics.findingCount)) + ' findings</span>' +
              '<span>' + escapeHtml(String(entry.metrics.recommendationCount)) + ' recommendations</span>' +
              '<span>Module failures: ' + escapeHtml(failedModules) + '</span>' +
              '</div></button>';
          }).join('');
        }

        function renderRunDetails() {
          const detailHost = byId('scan-detail');
          const recommendationsHost = byId('scan-recommendations');
          const artifactsHost = byId('scan-artifacts');
          const historyHost = byId('scan-history');
          const briefHost = byId('scan-brief');
          const exportHost = byId('scan-exports');

          if (!state.selectedRun) {
            const empty = '<div class="empty-state">Pick a scan run to review posture, recommendations, commercial brief, and exports.</div>';
            detailHost.innerHTML = empty;
            recommendationsHost.innerHTML = empty;
            artifactsHost.innerHTML = empty;
            historyHost.innerHTML = empty;
            briefHost.innerHTML = empty;
            exportHost.innerHTML = empty;
            return;
          }

          const run = state.selectedRun.run;
          const findings = Array.isArray(state.selectedRun.findings) ? state.selectedRun.findings : [];
          const recommendations = Array.isArray(state.selectedRun.recommendations) ? state.selectedRun.recommendations : [];
          const artifacts = Array.isArray(state.selectedRun.artifacts) ? state.selectedRun.artifacts : [];
          const summary = findScan(run.id)?.summary || {};

          detailHost.innerHTML =
            '<div class="facts">' +
              '<div class="fact"><div class="label">Status</div><strong>' + escapeHtml(run.status) + '</strong></div>' +
              '<div class="fact"><div class="label">Final URL</div><strong>' + escapeHtml(run.finalUrl || summary.finalUrl || 'Pending') + '</strong></div>' +
              '<div class="fact"><div class="label">Findings</div><strong>' + escapeHtml(String(findings.length)) + '</strong></div>' +
              '<div class="fact"><div class="label">Recommendations</div><strong>' + escapeHtml(String(recommendations.length)) + '</strong></div>' +
            '</div>' +
            '<div class="meta-list">' +
              '<div class="list-row"><strong>Edge provider</strong><span class="small muted">' + escapeHtml(summary.edgeProvider?.provider || 'Unknown') + '</span></div>' +
              '<div class="list-row"><strong>DNS provider</strong><span class="small muted">' + escapeHtml(summary.dnsProvider?.provider || 'Unknown') + '</span></div>' +
              '<div class="list-row"><strong>Created</strong><span class="small muted">' + escapeHtml(formatTime(run.createdAt)) + '</span></div>' +
              '<div class="list-row"><strong>Completed</strong><span class="small muted">' + escapeHtml(formatTime(run.completedAt)) + '</span></div>' +
            '</div>';

          recommendationsHost.innerHTML = recommendations.length
            ? recommendations.slice(0, 8).map((recommendation) =>
                '<div class="list-row"><div class="row-top"><strong>' + escapeHtml(recommendation.title) + '</strong>' +
                '<span class="status-chip ' + statusClass(recommendation.priority) + '">' + escapeHtml(recommendation.priority) + '</span></div>' +
                '<div class="small muted" style="margin-top:8px">' + escapeHtml(recommendation.executiveSummary || recommendation.rationale) + '</div></div>'
              ).join('')
            : '<div class="empty-state">No recommendations persisted for this run.</div>';

          artifactsHost.innerHTML = artifacts.length
            ? artifacts.map((artifact) =>
                '<div class="list-row"><div class="row-top"><strong>' + escapeHtml(artifact.kind) + '</strong>' +
                '<span class="small muted">' + escapeHtml(formatTime(artifact.createdAt)) + '</span></div>' +
                '<div class="small muted" style="margin-top:8px">' + escapeHtml(artifact.objectKey) + '</div></div>'
              ).join('')
            : '<div class="empty-state">No artifacts persisted for this run yet.</div>';

          historyHost.innerHTML = state.selectedHistory.length
            ? state.selectedHistory.slice(0, 6).map((entry) =>
                '<div class="list-row"><div class="row-top"><strong>' + escapeHtml(entry.run.domain) + '</strong>' +
                '<span class="status-chip ' + statusClass(entry.run.status) + '">' + escapeHtml(entry.run.status) + '</span></div>' +
                '<div class="row-bottom small muted"><span>' + escapeHtml(String(entry.metrics.findingCount)) + ' findings</span>' +
                '<span>' + escapeHtml(String(entry.metrics.recommendationCount)) + ' recommendations</span>' +
                '<span>' + escapeHtml(formatTime(entry.run.createdAt)) + '</span></div></div>'
              ).join('')
            : '<div class="empty-state">No domain history returned for this run.</div>';

          briefHost.innerHTML = state.selectedBrief
            ? '<div class="markdown-preview">' + escapeHtml(state.selectedBrief.markdown) + '</div>'
            : '<div class="empty-state">Commercial brief unavailable for this run.</div>';

          exportHost.innerHTML = state.selectedExports.length
            ? state.selectedExports.map((record) =>
                '<div class="list-row"><div class="row-top"><strong>' + escapeHtml(record.format) + '</strong>' +
                '<a class="button secondary" href="' + escapeHtml(record.downloadUrl) + '">Download</a></div>' +
                '<div class="row-bottom small muted"><span>' + escapeHtml(record.objectKey) + '</span>' +
                '<span>' + escapeHtml(formatTime(record.createdAt)) + '</span></div></div>'
              ).join('')
            : '<div class="empty-state">No exports generated for this run yet.</div>';

          byId('selected-run-domain').textContent = run.domain;
          byId('selected-run-status').className = 'status-chip ' + statusClass(run.status);
          byId('selected-run-status').textContent = run.status;
        }

        async function loadRecentScans(preferredRunId) {
          const payload = await fetchJson(config.recentScansEndpoint);
          state.scans = payload.scans || [];
          renderScanList();

          const activeId = preferredRunId || state.selectedRunId || state.scans[0]?.run.id || null;
          if (activeId) {
            await selectRun(activeId);
          } else {
            renderRunDetails();
          }
        }

        async function selectRun(scanRunId) {
          state.selectedRunId = scanRunId;
          renderScanList();

          const selected = findScan(scanRunId);
          if (!selected) {
            return;
          }

          const [scanData, briefData, exportData, historyData] = await Promise.all([
            fetchJson(config.scanEndpointBase + '/' + encodeURIComponent(scanRunId)),
            fetchJson(config.scanEndpointBase + '/' + encodeURIComponent(scanRunId) + '/commercial-brief'),
            fetchJson(config.scanEndpointBase + '/' + encodeURIComponent(scanRunId) + '/exports'),
            fetchJson(config.domainEndpointBase + '/' + encodeURIComponent(selected.run.domain) + '/history'),
          ]);

          state.selectedRun = scanData;
          state.selectedBrief = briefData.brief || null;
          state.selectedExports = exportData.exports || [];
          state.selectedHistory = historyData.history || [];
          renderRunDetails();
        }

        async function createScan(event) {
          event.preventDefault();
          clearNotice();

          const domain = byId('scan-domain').value.trim();
          if (!domain) {
            showNotice('A public domain is required before EdgeIntel can queue a scan.', 'warn');
            return;
          }

          byId('create-scan').disabled = true;
          try {
            const payload = await fetchJson(config.createScanEndpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ domain }),
            });
            state.currentJobId = payload.jobId;
            showNotice('Scan queued for ' + domain + '. Polling the job state until the run settles.', 'success');
            startPolling(payload.jobId, payload.scanRuns?.[0]?.id || null);
          } catch (error) {
            showNotice(error instanceof Error ? error.message : 'Failed to create scan.', 'danger');
          } finally {
            byId('create-scan').disabled = false;
          }
        }

        function startPolling(jobId, initialRunId) {
          stopPolling();
          const targetUrl = '/api/jobs/' + encodeURIComponent(jobId);
          state.pollTimer = setInterval(async () => {
            try {
              const payload = await fetchJson(targetUrl);
              const job = payload.job || {};
              byId('job-meta').textContent = 'Job ' + escapeHtml(jobId) + ' · ' + escapeHtml(job.status || 'queued');
              if (job.status === 'completed' || job.status === 'completed_with_failures' || job.status === 'failed') {
                stopPolling();
                await loadRecentScans(initialRunId || payload.runs?.[0]?.id || null);
              }
            } catch (error) {
              stopPolling();
              showNotice(error instanceof Error ? error.message : 'Failed to poll job state.', 'danger');
            }
          }, 3000);
        }

        function stopPolling() {
          if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
          }
        }

        async function createExport(format) {
          if (!state.selectedRunId) {
            showNotice('Select a scan run before generating an export.', 'warn');
            return;
          }

          clearNotice();
          try {
            await fetchJson(config.exportEndpointBase + '/' + encodeURIComponent(state.selectedRunId), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ format }),
            });
            const domainName =
              state.selectedRun?.run?.domain ||
              findScan(state.selectedRunId)?.run.domain ||
              'the selected domain';
            showNotice(format + ' export generated for ' + domainName + '.', 'success');
            await selectRun(state.selectedRunId);
          } catch (error) {
            showNotice(error instanceof Error ? error.message : 'Failed to create export.', 'danger');
          }
        }

        async function rescanSelected() {
          if (!state.selectedRun) {
            showNotice('Select a scan run before requesting a rescan.', 'warn');
            return;
          }

          clearNotice();
          try {
            const payload = await fetchJson(
              config.domainEndpointBase + '/' + encodeURIComponent(state.selectedRun.run.domain) + '/rescan',
              { method: 'POST' },
            );
            state.currentJobId = payload.jobId;
            showNotice('Manual rescan queued for ' + state.selectedRun.run.domain + '.', 'success');
            startPolling(payload.jobId, payload.scanRuns?.[0]?.id || null);
          } catch (error) {
            showNotice(error instanceof Error ? error.message : 'Failed to queue rescan.', 'danger');
          }
        }

        document.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const row = target.closest('[data-scan-id]');
          if (row) {
            const scanRunId = row.getAttribute('data-scan-id');
            if (scanRunId) {
              selectRun(scanRunId).catch((error) => {
                showNotice(error instanceof Error ? error.message : 'Failed to load scan run.', 'danger');
              });
            }
            return;
          }

          const exportButton = target.closest('[data-export-format]');
          if (exportButton) {
            const format = exportButton.getAttribute('data-export-format');
            if (format) {
              createExport(format).catch((error) => {
                showNotice(error instanceof Error ? error.message : 'Failed to create export.', 'danger');
              });
            }
            return;
          }

          if (target.closest('#rescan-selected')) {
            rescanSelected().catch((error) => {
              showNotice(error instanceof Error ? error.message : 'Failed to queue rescan.', 'danger');
            });
          }
        });

        byId('scan-form').addEventListener('submit', createScan);

        loadRecentScans()
          .then(() => {
            byId('workspace-sync').textContent = 'Synced ' + new Date().toLocaleTimeString();
            byId('job-meta').textContent = config.initialView === 'exports'
              ? 'Export studio ready.'
              : 'Scan workspace ready.';
            if (config.initialView === 'exports') {
              byId('export-studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          })
          .catch((error) => {
              showNotice(error instanceof Error ? error.message : 'Failed to load scan workspace.', 'danger');
          });
      })();
    </script>
  `;
}

export function renderWorkspaceOverviewApp(
  config: WorkspaceOverviewAppConfig,
): string {
  const script = renderOverviewScript(config);

  return `
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>EdgeIntel Operator Workspace</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      <style>${WORKSPACE_STYLES}</style>
    </head>
    <body>
      <div class="viewport">
        <div class="shell">
          ${renderSidebar("overview")}
          <main class="main">
            <div class="topbar">
              <div class="search">
                <span>The overview page now reflects real provider, scan, and tunnel state instead of forcing every operator into the provider editor first.</span>
              </div>
              <div class="top-actions">
                <div class="pill"><span class="dot"></span><span id="operator-email">Loading operator session…</span></div>
                <a class="pill" href="/app/scans">Open scan workspace</a>
                <div class="pill" id="workspace-sync">Syncing…</div>
              </div>
            </div>

            <div id="workspace-error" class="notice danger" hidden></div>

            <section class="hero-grid">
              <article class="surface">
                <div class="eyebrow">Overview</div>
                <h2>Cloudflare-native posture, routing, and local-model operations in one authenticated shell.</h2>
                <p class="hero-copy">
                  The operator workspace is now route-complete enough to navigate without dead ends:
                  provider setup, scan execution, export generation, and tunnel orchestration each map
                  to a real page and a real API surface.
                </p>
                <div class="stat-strip">
                  <div class="stat">
                    <div class="label">Providers ready</div>
                    <strong id="stat-provider-ready">0/0</strong>
                  </div>
                  <div class="stat">
                    <div class="label">Local routes</div>
                    <strong id="stat-provider-local">0</strong>
                  </div>
                  <div class="stat">
                    <div class="label">Routes ready</div>
                    <strong id="stat-route-ready">0/0</strong>
                  </div>
                  <div class="stat">
                    <div class="label">Connector online</div>
                    <strong id="stat-route-connected">0</strong>
                  </div>
                  <div class="stat">
                    <div class="label">Recent scans</div>
                    <strong id="stat-scan-recent">0</strong>
                  </div>
                  <div class="stat">
                    <div class="label">Passing runs</div>
                    <strong id="stat-scan-passing">0/0</strong>
                  </div>
                </div>
              </article>

              <article class="surface-dark">
                <div class="eyebrow">Quick actions</div>
                <h3 style="margin-top:10px">The core operator motions are now first-class routes.</h3>
                <p class="hero-copy">
                  Start where the operational question lives. The shell should not force a provider-centric
                  workflow when the user is actually trying to scan a domain or export a customer brief.
                </p>
                <div class="card-grid">
                  <a class="mini-card" href="/app/providers" style="text-decoration:none">
                    <div class="label">AI connectivity</div>
                    <strong>Review provider auth posture</strong>
                    <div class="small muted" style="margin-top:10px">Keys, bindings, local-route secrets, and connection tests.</div>
                  </a>
                  <a class="mini-card" href="/app/scans" style="text-decoration:none">
                    <div class="label">Scans</div>
                    <strong>Run a posture scan</strong>
                    <div class="small muted" style="margin-top:10px">Queue domains, inspect findings, and review commercial narratives.</div>
                  </a>
                  <a class="mini-card" href="/app/exports" style="text-decoration:none">
                    <div class="label">Exports</div>
                    <strong>Generate deliverables</strong>
                    <div class="small muted" style="margin-top:10px">Markdown, JSON, Terraform, and Cloudflare API payloads.</div>
                  </a>
                  <a class="mini-card" href="/app/tunnels" style="text-decoration:none">
                    <div class="label">Local routes</div>
                    <strong>Provision local-model ingress</strong>
                    <div class="small muted" style="margin-top:10px">Tunnel, DNS, Access, pairing, and runtime observability.</div>
                  </a>
                </div>
              </article>
            </section>

            <section class="content-grid">
              <div class="stack">
                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Provider snapshot</div>
                      <h3>What auth and model routes are actually ready?</h3>
                    </div>
                    <a class="button secondary" href="/app/providers">Open providers</a>
                  </div>
                  <div id="overview-providers" class="list-card"></div>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Recent scans</div>
                      <h3>Latest posture movement</h3>
                    </div>
                    <a class="button secondary" href="/app/scans">Open scans</a>
                  </div>
                  <div id="overview-scans" class="list-card"></div>
                </article>
              </div>

              <article class="surface">
                <div class="section-header">
                  <div>
                    <div class="eyebrow">Route snapshot</div>
                    <h3>Local model ingress and connector state</h3>
                  </div>
                  <a class="button secondary" href="/app/tunnels">Open tunnel workspace</a>
                </div>
                <div id="overview-routes" class="list-card"></div>
              </article>
            </section>
          </main>
        </div>
      </div>
      ${script}
    </body>
  </html>
  `;
}

export function renderScanWorkspaceApp(config: ScanWorkspaceAppConfig): string {
  const initialView = config.initialView ?? "scans";
  const script = renderScanScript({ ...config, initialView });
  const activeNav = initialView === "exports" ? "exports" : "scans";
  const title =
    initialView === "exports"
      ? "EdgeIntel Export Studio"
      : "EdgeIntel Scan Workspace";
  const heroTitle =
    initialView === "exports"
      ? "Generate customer-facing outputs from the latest verified scan."
      : "Run posture scans and review the full finding-to-export pipeline.";
  const heroCopy =
    initialView === "exports"
      ? "Exports now have a real operator surface instead of hiding behind API calls. Select a run, review the commercial brief, and generate the exact deliverable the customer or SE flow needs."
      : "The scan workspace now exposes the real loop: queue a job, review the run, inspect findings and recommendations, then turn the scan into a brief or export without leaving the app shell.";

  return `
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      <style>${WORKSPACE_STYLES}</style>
    </head>
    <body>
      <div class="viewport">
        <div class="shell">
          ${renderSidebar(activeNav)}
          <main class="main">
            <div class="topbar">
              <div class="search">
                <span>The dashboard now exposes the scan pipeline end to end: queue, inspect, brief, export, and rescan.</span>
              </div>
              <div class="top-actions">
                <a class="pill" href="/app">Overview</a>
                <a class="pill" href="/app/providers">Provider settings</a>
                <div class="pill" id="workspace-sync">Syncing…</div>
              </div>
            </div>

            <section class="hero-grid">
              <article class="surface">
                <div class="eyebrow">${initialView === "exports" ? "Exports" : "Scans"}</div>
                <h2>${heroTitle}</h2>
                <p class="hero-copy">${heroCopy}</p>
                <div class="button-row">
                  <a class="button secondary" href="/app/scans">Scan workspace</a>
                  <a class="button secondary" href="/app/exports">Export studio</a>
                  <a class="button secondary" href="/app/tunnels">Local model routes</a>
                </div>
              </article>

              <article class="surface-dark">
                <div class="eyebrow">Selected run</div>
                <h3 style="margin-top:10px" id="selected-run-domain">Awaiting scan selection</h3>
                <p class="hero-copy">
                  The right side of this workspace hydrates from persisted scan context only. It should
                  never invent findings or narrate a domain the Worker has not actually scanned.
                </p>
                <div class="button-row">
                  <span class="status-chip queued" id="selected-run-status">queued</span>
                  <button class="button secondary" id="rescan-selected" type="button">Rescan selected domain</button>
                </div>
                <div class="notice" style="margin-top:18px">
                  <strong>Job status</strong>
                  <div class="small muted" id="job-meta" style="margin-top:8px">Waiting for the first scan.</div>
                </div>
              </article>
            </section>

            <div id="scan-notice" class="notice" hidden></div>

            <section class="content-grid">
              <div class="stack">
                <article class="surface anchor-target" id="scan-lab">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Queue a scan</div>
                      <h3>Run the Worker against a public domain</h3>
                      <p>EdgeIntel enforces public-domain validation here so scan orchestration stays production-safe.</p>
                    </div>
                  </div>
                  <form id="scan-form">
                    <div class="form-grid">
                      <input id="scan-domain" name="domain" type="text" placeholder="example.com" />
                      <button class="button" id="create-scan" type="submit">Create scan</button>
                    </div>
                  </form>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Recent runs</div>
                      <h3>Pick a persisted scan context</h3>
                    </div>
                  </div>
                  <div id="scan-run-list" class="scan-list"></div>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Domain history</div>
                      <h3>How the same hostname has moved over time</h3>
                    </div>
                  </div>
                  <div id="scan-history" class="list-card"></div>
                </article>
              </div>

              <div class="stack">
                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Run details</div>
                      <h3>Persisted posture snapshot</h3>
                    </div>
                  </div>
                  <div id="scan-detail"></div>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Recommendations</div>
                      <h3>Upgrade motions from the scan</h3>
                    </div>
                  </div>
                  <div id="scan-recommendations" class="list-card"></div>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Artifacts</div>
                      <h3>Evidence generated by the run</h3>
                    </div>
                  </div>
                  <div id="scan-artifacts" class="list-card"></div>
                </article>

                <article class="surface">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Commercial brief</div>
                      <h3>Customer-safe narrative</h3>
                    </div>
                  </div>
                  <div id="scan-brief"></div>
                </article>

                <article class="surface anchor-target" id="export-studio">
                  <div class="section-header">
                    <div>
                      <div class="eyebrow">Export studio</div>
                      <h3>Generate the deliverable from the selected run</h3>
                    </div>
                    <div class="button-row" style="margin:0">
                      <button class="button secondary" type="button" data-export-format="markdown">Markdown</button>
                      <button class="button secondary" type="button" data-export-format="json">JSON</button>
                      <button class="button secondary" type="button" data-export-format="terraform">Terraform</button>
                      <button class="button secondary" type="button" data-export-format="cf-api">CF API</button>
                    </div>
                  </div>
                  <div id="scan-exports" class="list-card"></div>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>
      ${script}
    </body>
  </html>
  `;
}
