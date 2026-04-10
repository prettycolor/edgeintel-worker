interface ProviderAppConfig {
  providersEndpoint: string;
  providerCatalogEndpoint: string;
}

const APP_STYLES = `
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
    --signal-soft: rgba(142, 240, 97, 0.18);
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

  .brand p,
  .nav-meta {
    color: rgba(255, 255, 255, 0.54);
  }

  .brand p {
    margin: 4px 0 0;
  }

  .workspace-chip,
  .sidebar-footer {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .workspace-chip strong,
  .sidebar-footer strong {
    display: block;
    margin-bottom: 6px;
  }

  .workspace-chip span,
  .sidebar-footer p {
    color: rgba(255, 255, 255, 0.64);
    font-size: 13px;
    line-height: 1.55;
  }

  .nav-group {
    margin: 20px 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.82);
    font-size: 14px;
    margin-top: 6px;
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

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

  .topbar,
  .hero-row,
  .content-grid,
  .footer-band {
    position: relative;
    z-index: 1;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
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
    background: rgba(255, 255, 255, 0.66);
    border: 1px solid rgba(20, 23, 26, 0.07);
  }

  .search span {
    color: var(--ink-soft);
    font-size: 14px;
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
    background: rgba(255, 255, 255, 0.66);
    border: 1px solid rgba(20, 23, 26, 0.06);
    font-size: 13px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--signal);
    box-shadow: 0 0 0 8px rgba(142, 240, 97, 0.12);
  }

  .hero-row {
    display: grid;
    grid-template-columns: 1.35fr 0.92fr;
    gap: 16px;
    margin-bottom: 18px;
  }

  .surface,
  .surface-dark {
    border-radius: var(--radius-xl);
    padding: 24px;
    box-shadow: 0 16px 42px rgba(20, 23, 26, 0.07);
  }

  .surface {
    background: var(--surface);
    border: 1px solid rgba(20, 23, 26, 0.08);
  }

  .surface-dark {
    background: linear-gradient(180deg, var(--surface-dark), var(--surface-dark-2));
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .eyebrow {
    color: var(--signal);
    margin-bottom: 12px;
  }

  .surface p,
  .surface li {
    color: var(--ink-soft);
    line-height: 1.6;
  }

  .surface-dark p,
  .surface-dark li {
    color: rgba(255, 255, 255, 0.68);
  }

  .hero-row h2 {
    font-size: clamp(30px, 3vw, 44px);
    max-width: 12ch;
  }

  .hero-row h3 {
    font-size: 28px;
    margin-bottom: 10px;
  }

  .stat-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 22px;
  }

  .stat {
    padding-top: 14px;
    border-top: 1px solid rgba(20, 23, 26, 0.08);
  }

  .surface-dark .stat {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .stat strong {
    display: block;
    margin-top: 8px;
    font-size: 24px;
  }

  .hero-row .surface-dark .stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-row .surface-dark .stat strong {
    font-size: 20px;
    line-height: 1.25;
    word-break: break-word;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1.12fr 0.88fr;
    gap: 16px;
  }

  .stack {
    display: grid;
    gap: 16px;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
  }

  .tab {
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(20, 23, 26, 0.05);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tab.active {
    background: rgba(20, 23, 26, 0.9);
    color: white;
  }

  .provider-table,
  .diagnostic-list,
  .mini-log {
    display: grid;
    gap: 10px;
  }

  .provider-row {
    width: 100%;
    border: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) auto auto;
    gap: 14px;
    align-items: center;
    padding: 15px 0;
    background: transparent;
    border-bottom: 1px solid rgba(20, 23, 26, 0.08);
    text-align: left;
    color: inherit;
    transition: transform 180ms ease, opacity 180ms ease;
  }

  .provider-row:hover {
    transform: translateX(4px);
  }

  .provider-row:last-child {
    border-bottom: 0;
  }

  .provider-row.active {
    opacity: 1;
  }

  .provider-row:not(.active) {
    opacity: 0.78;
  }

  .provider-row strong,
  .diagnostic-item strong,
  .mini-log-line strong {
    display: block;
    margin-bottom: 4px;
    font-size: 15px;
  }

  .provider-row span,
  .diagnostic-item span,
  .muted,
  .mini-log-line time {
    color: var(--ink-soft);
    font-size: 13px;
  }

  .status,
  .status-live {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .status::before,
  .status-live::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warn);
  }

  .status[data-state="passed"]::before,
  .status[data-state="ready"]::before,
  .status-live::before {
    background: var(--signal);
  }

  .status[data-state="failed"]::before,
  .status[data-state="error"]::before,
  .status[data-state="disabled"]::before {
    background: var(--danger);
  }

  .status-live {
    color: white;
  }

  .status-live.testing::before {
    animation: pulse 1.1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.72;
    }
    50% {
      transform: scale(1.35);
      opacity: 1;
    }
  }

  .surface-dark .muted,
  .surface-dark .provider-row span,
  .surface-dark .diagnostic-item span,
  .surface-dark .mini-log-line time {
    color: rgba(255, 255, 255, 0.62);
  }

  .diagnostic-item,
  .mini-log-line {
    display: grid;
    gap: 8px;
    padding: 14px 0;
    border-bottom: 1px solid rgba(20, 23, 26, 0.08);
  }

  .diagnostic-item:last-child,
  .mini-log-line:last-child {
    border-bottom: 0;
  }

  .wizard-header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .wizard-header h3 {
    font-size: 28px;
  }

  .panel-note {
    margin-top: 10px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.66);
  }

  .step-grid {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 16px;
  }

  .step-list,
  .form-stack {
    display: grid;
    gap: 10px;
  }

  .step {
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .step.active {
    background: rgba(255, 255, 255, 0.1);
  }

  .step strong {
    display: block;
    margin-bottom: 4px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .field,
  .field-wide {
    display: grid;
    gap: 8px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .field-wide {
    grid-column: 1 / -1;
  }

  .field label,
  .field-wide label {
    color: rgba(255, 255, 255, 0.58);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field input,
  .field select,
  .field-wide input,
  .field-wide textarea {
    width: 100%;
    border: 0;
    outline: none;
    color: white;
    background: transparent;
    padding: 0;
  }

  .field input::placeholder,
  .field-wide input::placeholder,
  .field-wide textarea::placeholder {
    color: rgba(255, 255, 255, 0.38);
  }

  .field-hint {
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.52);
  }

  .field-wide textarea {
    min-height: 74px;
    resize: vertical;
    border: 0;
    outline: none;
    color: white;
    background: transparent;
  }

  .check-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }

  .checkbox input {
    width: 16px;
    height: 16px;
  }

  .button-row,
  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .button {
    appearance: none;
    border: 0;
    border-radius: 999px;
    padding: 13px 16px;
    font-weight: 600;
    transition: transform 180ms ease, opacity 180ms ease, background 180ms ease;
  }

  .button:hover {
    transform: translateY(-1px);
  }

  .button.primary {
    color: var(--surface-dark);
    background: linear-gradient(135deg, #f7ffec, white);
  }

  .button.secondary {
    color: white;
    background: rgba(255, 255, 255, 0.08);
  }

  .button.ghost {
    color: var(--ink);
    background: rgba(20, 23, 26, 0.05);
  }

  .button.danger {
    color: white;
    background: rgba(243, 106, 92, 0.16);
    border: 1px solid rgba(243, 106, 92, 0.3);
  }

  .button:disabled {
    opacity: 0.46;
    cursor: default;
    transform: none;
  }

  .capability-panel,
  .auth-panel {
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    padding: 14px;
  }

  .chip-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .mini-chip {
    display: inline-flex;
    align-items: center;
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mini-chip.recommended {
    background: rgba(142, 240, 97, 0.12);
    border-color: rgba(142, 240, 97, 0.22);
  }

  .mini-chip.warning {
    background: rgba(255, 174, 109, 0.12);
    border-color: rgba(255, 174, 109, 0.24);
  }

  .capability-list {
    margin: 12px 0 0;
    padding-left: 18px;
    color: rgba(255, 255, 255, 0.68);
    line-height: 1.6;
  }

  .notice {
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(142, 240, 97, 0.12);
    color: white;
    font-size: 13px;
    border: 1px solid rgba(142, 240, 97, 0.22);
  }

  .notice.error {
    background: rgba(243, 106, 92, 0.14);
    border-color: rgba(243, 106, 92, 0.22);
  }

  .footer-band {
    margin-top: 16px;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 16px;
  }

  .code-block {
    margin: 0;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.84);
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }

  .empty-state {
    padding: 18px;
    border-radius: 22px;
    background: rgba(20, 23, 26, 0.04);
    border: 1px dashed rgba(20, 23, 26, 0.12);
  }

  @media (max-width: 1180px) {
    .shell,
    .hero-row,
    .content-grid,
    .footer-band,
    .step-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 860px) {
    .viewport {
      width: calc(100vw - 16px);
      margin: 8px auto;
      padding: 8px;
      border-radius: 24px;
    }

    .shell {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .sidebar,
    .main {
      padding: 16px;
    }

    .topbar,
    .wizard-header,
    .button-row,
    .modal-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .field-grid,
    .stat-strip,
    .provider-row {
      grid-template-columns: 1fr;
    }
  }
`;

const APP_SCRIPT = `
  const config = window.EDGEINTEL_APP;
  const state = {
    catalog: [],
    providers: [],
    selectedId: null,
    testingId: null,
    saving: false,
    deleting: false,
    clearingSecretId: null,
    draftPresetCode: "openai",
    notice: null
  };

  const ui = {
    providerList: document.getElementById("provider-list"),
    emptyState: document.getElementById("provider-empty"),
    providerForm: document.getElementById("provider-form"),
    providerSelectMode: document.getElementById("provider-mode"),
    deleteButton: document.getElementById("delete-provider"),
    testButton: document.getElementById("test-provider"),
    resetButton: document.getElementById("reset-provider"),
    clearSecretButton: document.getElementById("clear-provider-secret"),
    notice: document.getElementById("provider-notice"),
    diagnostics: document.getElementById("provider-diagnostics"),
    diagnosticsMeta: document.getElementById("provider-diagnostics-meta"),
    diagnosticsCode: document.getElementById("provider-diagnostics-code"),
    presetSelect: document.getElementById("providerPreset"),
    capabilityPanel: document.getElementById("provider-capability"),
    authPanel: document.getElementById("provider-auth-guidance"),
    statTotal: document.getElementById("stat-total-providers"),
    statReady: document.getElementById("stat-ready-providers"),
    statLocal: document.getElementById("stat-local-providers"),
    statPassing: document.getElementById("stat-passing-providers"),
    runtimeRoute: document.getElementById("runtime-route"),
    runtimeHost: document.getElementById("runtime-host"),
    runtimeModel: document.getElementById("runtime-model"),
    runtimeProtection: document.getElementById("runtime-protection"),
    lastRefresh: document.getElementById("last-refresh")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isLocalKind(kind) {
    return kind === "local-direct" || kind === "local-gateway";
  }

  function providerCapability(providerCode, kind) {
    const normalizedCode = String(providerCode || "custom-openai-compatible").trim().toLowerCase();
    const found = state.catalog.find(function(entry) {
      return entry.providerCode === normalizedCode;
    });

    if (found) return found;

    const fallback = state.catalog.find(function(entry) {
      return entry.providerCode === "custom-openai-compatible";
    });

    if (!fallback) {
      return {
        providerCode: normalizedCode,
        title: normalizedCode,
        description: "Custom provider",
        supportedKinds: [kind || "hosted-api-key"],
        recommendedKind: kind || "hosted-api-key",
        defaultBaseUrl: null,
        modelPlaceholder: null,
        supportsAiGateway: true,
        authOptions: [
          {
            strategy: "api-key",
            label: "API key",
            description: "Use a bearer token for custom OpenAI-compatible routes.",
            requiredSecretFields: ["apiKey"],
            optionalSecretFields: ["accessClientId", "accessClientSecret"],
            recommended: true
          }
        ],
        connectionTest: {
          transport: "openai-compatible-models",
          summary: "Model inventory request against the configured endpoint.",
          billable: false
        },
        notes: ["EdgeIntel treats unknown providers as custom OpenAI-compatible routes."]
      };
    }

    return {
      ...fallback,
      providerCode: normalizedCode,
      title: normalizedCode
        .split(/[-_]/g)
        .filter(Boolean)
        .map(function(part) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ")
    };
  }

  function authOption(capability, strategy) {
    return capability.authOptions.find(function(option) {
      return option.strategy === strategy;
    }) || capability.authOptions[0] || null;
  }

  function defaultAuthStrategy(capability) {
    return capability.authOptions.find(function(option) {
      return option.recommended;
    })?.strategy || capability.authOptions[0]?.strategy || "api-key";
  }

  function providerStatus(provider) {
    return provider.lastTestStatus || provider.status || "draft";
  }

  function providerStatusLabel(provider) {
    const status = providerStatus(provider);
    if (status === "passed") return "Healthy";
    if (status === "warning") return "Review";
    if (status === "failed") return "Failed";
    if (status === "ready") return "Ready";
    if (status === "disabled") return "Disabled";
    if (status === "error") return "Needs fix";
    return "Draft";
  }

  function relativeTimestamp(iso) {
    if (!iso) return "Never tested";
    const diffMs = Date.now() - Date.parse(iso);
    const diffSeconds = Math.max(0, Math.round(diffMs / 1000));
    if (diffSeconds < 60) return diffSeconds + "s ago";
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return diffMinutes + "m ago";
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 48) return diffHours + "h ago";
    return new Date(iso).toLocaleString();
  }

  function setNotice(message, tone) {
    if (!message) {
      ui.notice.hidden = true;
      ui.notice.textContent = "";
      ui.notice.classList.remove("error");
      return;
    }
    ui.notice.hidden = false;
    ui.notice.textContent = message;
    ui.notice.classList.toggle("error", tone === "error");
  }

  function selectedProvider() {
    return state.providers.find((provider) => provider.id === state.selectedId) || null;
  }

  function syncAuthOptions(capability, selectedStrategy) {
    const authSelect = ui.providerForm.elements.authStrategy;
    const options = capability.authOptions
      .map(function(option) {
        return '<option value="' + escapeHtml(option.strategy) + '"' +
          (option.strategy === selectedStrategy ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      })
      .join("");
    authSelect.innerHTML = options;
  }

  function renderCapabilityPanel(capability, provider) {
    const authChips = capability.authOptions
      .map(function(option) {
        return '<span class="mini-chip' + (option.recommended ? ' recommended' : '') + '">' +
          escapeHtml(option.label) + '</span>';
      })
      .join("");
    const notes = capability.notes
      .map(function(note) {
        return '<li>' + escapeHtml(note) + '</li>';
      })
      .join("");
    ui.capabilityPanel.innerHTML =
      '<div><strong>' + escapeHtml(capability.title) + '</strong><div class="field-hint">' +
      escapeHtml(capability.description) + '</div></div>' +
      '<div class="chip-row">' + authChips + '</div>' +
      '<ul class="capability-list">' +
      '<li>Recommended kind: ' + escapeHtml(capability.recommendedKind) + '</li>' +
      '<li>Connection test: ' + escapeHtml(capability.connectionTest.summary) + '</li>' +
      '<li>AI Gateway: ' + escapeHtml(capability.supportsAiGateway ? "supported" : "not required") + '</li>' +
      (provider?.secretHealth?.summary
        ? '<li>Secret health: ' + escapeHtml(provider.secretHealth.summary) + '</li>'
        : "") +
      notes +
      '</ul>';
  }

  function renderAuthPanel(capability, provider) {
    const authStrategy = ui.providerForm.elements.authStrategy.value || defaultAuthStrategy(capability);
    const option = authOption(capability, authStrategy);
    const accessProtected = provider?.secretHealth?.requiresAccessHeaders || false;
    const missing = provider?.secretHealth?.missingRequiredSecretFields || [];
    ui.authPanel.innerHTML = option
      ? '<div><strong>' + escapeHtml(option.label) + '</strong><div class="field-hint">' +
        escapeHtml(option.description) + '</div></div>' +
        '<div class="chip-row">' +
        option.requiredSecretFields.map(function(field) {
          return '<span class="mini-chip recommended">' + escapeHtml(field) + '</span>';
        }).join("") +
        option.optionalSecretFields.map(function(field) {
          return '<span class="mini-chip">' + escapeHtml(field) + '</span>';
        }).join("") +
        (accessProtected ? '<span class="mini-chip warning">Access headers expected</span>' : '') +
        '</div>' +
        '<ul class="capability-list">' +
        '<li>Primary auth strategy: ' + escapeHtml(authStrategy) + '</li>' +
        '<li>Required secrets: ' + escapeHtml(option.requiredSecretFields.length ? option.requiredSecretFields.join(", ") : "none") + '</li>' +
        '<li>Optional extras: ' + escapeHtml(option.optionalSecretFields.length ? option.optionalSecretFields.join(", ") : "none") + '</li>' +
        '<li>' + escapeHtml(missing.length ? "Missing required secrets: " + missing.join(", ") : "Selected auth path is satisfiable with the currently stored secrets.") + '</li>' +
        '</ul>'
      : '<div class="field-hint">No supported auth path is defined for this provider yet.</div>';
  }

  function resetSecretFields() {
    ui.providerForm.elements.apiKey.value = "";
    ui.providerForm.elements.accessClientId.value = "";
    ui.providerForm.elements.accessClientSecret.value = "";
  }

  function applyPreset(presetCode, provider) {
    const capability = providerCapability(presetCode, provider?.kind || ui.providerForm.elements.kind.value);
    state.draftPresetCode = capability.providerCode;
    ui.presetSelect.value = capability.providerCode;
    ui.providerForm.elements.providerCode.value = capability.providerCode;

    if (!provider) {
      ui.providerForm.elements.kind.value = capability.recommendedKind;
      ui.providerForm.elements.displayName.value = capability.title;
      ui.providerForm.elements.baseUrl.value = capability.defaultBaseUrl || "";
      ui.providerForm.elements.defaultModel.value = "";
      ui.providerForm.elements.usesAiGateway.checked = capability.supportsAiGateway && capability.providerCode !== "openrouter";
    }

    ui.providerForm.elements.defaultModel.placeholder = capability.modelPlaceholder || "Model identifier";

    syncAuthOptions(capability, provider?.authStrategy || defaultAuthStrategy(capability));
    renderCapabilityPanel(capability, provider || null);
    renderAuthPanel(capability, provider || null);
  }

  function populateForm(provider) {
    ui.providerForm.elements.providerId.value = provider?.id || "";
    ui.providerForm.elements.kind.value = provider?.kind || "hosted-api-key";
    ui.providerForm.elements.providerCode.value = provider?.providerCode || state.draftPresetCode;
    ui.providerForm.elements.displayName.value = provider?.displayName || "";
    ui.providerForm.elements.baseUrl.value = provider?.baseUrl || "";
    ui.providerForm.elements.defaultModel.value = provider?.defaultModel || "";
    ui.providerForm.elements.usesAiGateway.checked = Boolean(provider?.usesAiGateway);
    ui.providerForm.elements.status.value = provider?.status || "draft";
    ui.providerForm.elements.metadataJson.value = provider?.metadata
      ? JSON.stringify(provider.metadata, null, 2)
      : "";
    resetSecretFields();
    ui.providerSelectMode.textContent = provider ? "Update selected provider" : "Create provider";
    ui.deleteButton.disabled = !provider || state.deleting;
    ui.clearSecretButton.disabled = !provider || !provider.secretConfigured || state.clearingSecretId === provider?.id;
    applyPreset(provider?.providerCode || state.draftPresetCode, provider || null);
  }

  function renderStats() {
    const providers = state.providers;
    const ready = providers.filter((provider) => provider.status === "ready").length;
    const local = providers.filter((provider) => isLocalKind(provider.kind)).length;
    const passing = providers.filter((provider) => provider.lastTestStatus === "passed").length;

    ui.statTotal.textContent = String(providers.length).padStart(2, "0");
    ui.statReady.textContent = String(ready).padStart(2, "0");
    ui.statLocal.textContent = String(local).padStart(2, "0");
    ui.statPassing.textContent = providers.length
      ? passing + "/" + providers.length
      : "00/00";
  }

  function renderRuntimeSummary(provider) {
    const target = provider || state.providers[0] || null;
    ui.runtimeRoute.textContent = target ? target.capability.title : "No provider";
    ui.runtimeHost.textContent = target?.baseUrl || "Pending";
    ui.runtimeModel.textContent = target?.defaultModel || "Unset";
    ui.runtimeProtection.textContent = target
      ? target.authStrategy + (target.secretHealth.requiresAccessHeaders ? " + access" : "")
      : "Open";
  }

  function renderDiagnostics(provider) {
    if (!provider) {
      ui.diagnostics.innerHTML = '<div class="empty-state"><strong>No provider selected.</strong><div class="muted">Create or select a provider to inspect its last connection test and persisted status.</div></div>';
      ui.diagnosticsMeta.textContent = "Awaiting provider selection";
      ui.diagnosticsCode.textContent = "{}";
      return;
    }

    const result = provider.lastTestResult;
    const details = result?.details || {};
    ui.diagnosticsMeta.textContent = result
      ? providerStatusLabel(provider) + " · " + relativeTimestamp(result.testedAt)
      : "No test result stored yet";

    const diagnostics = [
      {
        title: "Transport",
        detail: result?.transport || "Not tested",
        helper: result?.targetUrl || provider.baseUrl || "No target URL stored"
      },
      {
        title: "Auth path",
        detail: provider.authStrategy,
        helper: provider.capability.authOptions.map(function(option) {
          return option.label;
        }).join(" · ")
      },
      {
        title: "Secret posture",
        detail: provider.secretHealth.summary,
        helper: provider.secretHealth.configuredSecretFields.length
          ? "Configured: " + provider.secretHealth.configuredSecretFields.join(", ")
          : "No secret material stored yet"
      },
      {
        title: "Connection test",
        detail: provider.capability.connectionTest.summary,
        helper: provider.capability.connectionTest.billable
          ? "This test path makes a small billable request."
          : "This test path is expected to be non-billable."
      }
    ];

    ui.diagnostics.innerHTML = diagnostics
      .map(function(entry) {
        return '<div class="diagnostic-item"><div><strong>' + escapeHtml(entry.title) + '</strong><span>' +
          escapeHtml(entry.detail) + '</span></div><div class="muted">' + escapeHtml(entry.helper) + '</div></div>';
      })
      .join("");

    ui.diagnosticsCode.textContent = JSON.stringify(
      {
        providerId: provider.id,
        capability: provider.capability,
        secretHealth: provider.secretHealth,
        lastTestResult: result,
        metadata: provider.metadata
      },
      null,
      2
    );
  }

  function renderProviderList() {
    const providers = state.providers;
    ui.emptyState.hidden = providers.length > 0;
    if (!providers.length) {
      ui.providerList.innerHTML = "";
      return;
    }

    ui.providerList.innerHTML = providers
      .map(function(provider) {
        const isActive = provider.id === state.selectedId;
        const testing = state.testingId === provider.id;
        const subtitle = [
          provider.capability.title,
          provider.authStrategy,
          provider.secretHealth.summary
        ].join(" · ");
        return '<button class="provider-row' + (isActive ? ' active' : '') + '" type="button" data-provider-id="' +
          escapeHtml(provider.id) + '">' +
          '<div><strong>' + escapeHtml(provider.displayName) + '</strong><span>' + escapeHtml(subtitle) + '</span></div>' +
          '<span>' + escapeHtml(relativeTimestamp(provider.lastTestedAt)) + '</span>' +
          '<span class="' + (testing ? 'status-live testing' : 'status') + '" data-state="' +
          escapeHtml(providerStatus(provider)) + '">' + escapeHtml(providerStatusLabel(provider)) + '</span>' +
          '</button>';
      })
      .join("");
  }

  function render() {
    renderStats();
    renderProviderList();
    renderRuntimeSummary(selectedProvider());
    renderDiagnostics(selectedProvider());
    populateForm(selectedProvider());
    ui.testButton.disabled = !selectedProvider() || state.testingId !== null;
    setNotice(state.notice?.message || "", state.notice?.tone || "info");
    ui.lastRefresh.textContent = "Last sync " + new Date().toLocaleTimeString();
  }

  async function loadProviders(preferredId) {
    const response = await fetch(config.providersEndpoint, {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load providers.");
    }
    state.providers = payload.providers || [];
    const preferredExists = state.providers.some(function(provider) {
      return provider.id === preferredId;
    });
    state.selectedId = preferredExists
      ? preferredId
      : state.providers[0]?.id || null;
    render();
  }

  async function loadCatalog() {
    const response = await fetch(config.providerCatalogEndpoint, {
      headers: { Accept: "application/json" }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load provider catalog.");
    }
    state.catalog = payload.catalog || [];
    ui.presetSelect.innerHTML = state.catalog
      .map(function(entry) {
        return '<option value="' + escapeHtml(entry.providerCode) + '">' +
          escapeHtml(entry.title) + '</option>';
      })
      .join("");
    if (state.catalog.length && !state.draftPresetCode) {
      state.draftPresetCode = state.catalog[0].providerCode;
    }
  }

  function formPayload() {
    let metadata = {};
    const metadataValue = ui.providerForm.elements.metadataJson.value.trim();
    if (metadataValue) {
      metadata = JSON.parse(metadataValue);
    }

    const secret = {};
    if (ui.providerForm.elements.apiKey.value.trim()) {
      secret.apiKey = ui.providerForm.elements.apiKey.value.trim();
    }
    if (ui.providerForm.elements.accessClientId.value.trim()) {
      secret.accessClientId = ui.providerForm.elements.accessClientId.value.trim();
    }
    if (ui.providerForm.elements.accessClientSecret.value.trim()) {
      secret.accessClientSecret = ui.providerForm.elements.accessClientSecret.value.trim();
    }

    return {
      kind: ui.providerForm.elements.kind.value,
      providerCode: ui.providerForm.elements.providerCode.value.trim(),
      displayName: ui.providerForm.elements.displayName.value.trim(),
      baseUrl: ui.providerForm.elements.baseUrl.value.trim() || null,
      defaultModel: ui.providerForm.elements.defaultModel.value.trim() || null,
      authStrategy: ui.providerForm.elements.authStrategy.value,
      usesAiGateway: ui.providerForm.elements.usesAiGateway.checked,
      status: ui.providerForm.elements.status.value,
      metadata: metadata,
      secret: Object.keys(secret).length ? secret : undefined
    };
  }

  async function saveProvider(event) {
    event.preventDefault();
    state.saving = true;
    state.notice = null;
    render();

    try {
      const providerId = ui.providerForm.elements.providerId.value || null;
      const method = providerId ? "PATCH" : "POST";
      const target = providerId
        ? config.providersEndpoint + "/" + encodeURIComponent(providerId)
        : config.providersEndpoint;

      const response = await fetch(target, {
        method: method,
        headers: {
          "content-type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(formPayload())
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Provider save failed.");
      }

      state.notice = {
        tone: "info",
        message: providerId ? "Provider updated." : "Provider created."
      };
      await loadProviders(payload.provider?.id || providerId);
    } catch (error) {
      state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Provider save failed."
      };
      render();
    } finally {
      state.saving = false;
    }
  }

  async function testSelectedProvider() {
    const provider = selectedProvider();
    if (!provider) return;
    state.testingId = provider.id;
    state.notice = null;
    render();

    try {
      const response = await fetch(
        config.providersEndpoint + "/" + encodeURIComponent(provider.id) + "/test",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ persistResult: true })
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.testResult?.message || payload?.error || "Connection test failed.");
      }
      state.notice = {
        tone: payload?.testResult?.status === "failed" ? "error" : "info",
        message: payload?.testResult?.message || "Provider test completed."
      };
      await loadProviders(provider.id);
    } catch (error) {
      state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Connection test failed."
      };
      render();
    } finally {
      state.testingId = null;
    }
  }

  async function deleteSelectedProvider() {
    const provider = selectedProvider();
    if (!provider) return;
    state.deleting = true;
    state.notice = null;
    render();

    try {
      const response = await fetch(
        config.providersEndpoint + "/" + encodeURIComponent(provider.id),
        {
          method: "DELETE",
          headers: { Accept: "application/json" }
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.");
      }
      state.notice = {
        tone: "info",
        message: "Provider deleted."
      };
      await loadProviders(null);
    } catch (error) {
      state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Delete failed."
      };
      render();
    } finally {
      state.deleting = false;
    }
  }

  async function clearSelectedProviderSecret() {
    const provider = selectedProvider();
    if (!provider) return;
    state.clearingSecretId = provider.id;
    state.notice = null;
    render();

    try {
      const response = await fetch(
        config.providersEndpoint + "/" + encodeURIComponent(provider.id) + "/secret",
        {
          method: "DELETE",
          headers: { Accept: "application/json" }
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Secret clear failed.");
      }
      state.notice = {
        tone: "info",
        message: "Stored provider secrets cleared."
      };
      await loadProviders(provider.id);
    } catch (error) {
      state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Secret clear failed."
      };
      render();
    } finally {
      state.clearingSecretId = null;
    }
  }

  ui.providerList.addEventListener("click", function(event) {
    const target = event.target instanceof HTMLElement
      ? event.target.closest("[data-provider-id]")
      : null;
    if (!target) return;
    const providerId = target.getAttribute("data-provider-id");
    if (!providerId) return;
    state.selectedId = providerId;
    state.notice = null;
    render();
  });

  ui.providerForm.addEventListener("submit", saveProvider);
  ui.testButton.addEventListener("click", testSelectedProvider);
  ui.deleteButton.addEventListener("click", deleteSelectedProvider);
  ui.clearSecretButton.addEventListener("click", clearSelectedProviderSecret);
  ui.presetSelect.addEventListener("change", function() {
    if (selectedProvider()) return;
    applyPreset(ui.presetSelect.value, null);
  });
  ui.providerForm.elements.providerCode.addEventListener("change", function() {
    applyPreset(ui.providerForm.elements.providerCode.value.trim() || "custom-openai-compatible", selectedProvider());
  });
  ui.providerForm.elements.kind.addEventListener("change", function() {
    applyPreset(ui.providerForm.elements.providerCode.value.trim() || state.draftPresetCode, selectedProvider());
  });
  ui.providerForm.elements.authStrategy.addEventListener("change", function() {
    const capability = providerCapability(
      ui.providerForm.elements.providerCode.value.trim() || state.draftPresetCode,
      ui.providerForm.elements.kind.value
    );
    renderAuthPanel(capability, selectedProvider());
  });
  ui.resetButton.addEventListener("click", function() {
    state.selectedId = null;
    state.draftPresetCode = "openai";
    state.notice = {
      tone: "info",
      message: "Create mode ready."
    };
    render();
  });

  Promise.all([loadCatalog(), loadProviders()])
    .then(function() {
      render();
    })
    .catch(function(error) {
      state.notice = {
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load providers."
      };
      render();
    });
`;

export function renderProviderControlPlaneApp(
  config: ProviderAppConfig,
): string {
  const bootConfig = JSON.stringify(config);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EdgeIntel Provider Control Plane</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <style>${APP_STYLES}</style>
  </head>
  <body>
    <div class="viewport">
      <div class="shell">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-mark"></div>
            <div>
              <h1>EdgeIntel</h1>
              <p>Provider control plane</p>
            </div>
          </div>

          <div class="workspace-chip">
            <strong>hostingtool.dev</strong>
            <span>Single environment · Worker-native control plane</span>
          </div>

          <div class="nav-group">
            <div class="nav-meta">Workspace</div>
            <div class="nav-item">
              Overview
              <span class="badge">core</span>
            </div>
            <div class="nav-item active">
              AI connectivity
              <span class="badge">live</span>
            </div>
            <div class="nav-item">
              Scans
              <span class="badge">api</span>
            </div>
            <div class="nav-item">
              Exports
              <span class="badge">ready</span>
            </div>
          </div>

          <div class="nav-group">
            <div class="nav-meta">Runtime</div>
            <a class="nav-item" href="/app/tunnels" style="text-decoration:none">
              Tunnel orchestration
              <span class="badge">live</span>
            </a>
            <div class="nav-item">Connector pairing</div>
            <div class="nav-item">Local wizard</div>
            <div class="nav-item">Health history</div>
          </div>

          <div class="sidebar-footer">
            <strong>Why this surface exists</strong>
            <p>
              EdgeIntel is being built as an authenticated app shell on Cloudflare,
              not as a separate marketing site and not as an embedded Cloudflare
              dashboard module.
            </p>
          </div>
        </aside>

        <main class="main">
          <div class="topbar">
            <div class="search">
              <span>Provider settings, local routes, and diagnostics stay inside the app shell.</span>
            </div>
            <div class="top-actions">
              <div class="pill">
                <span class="dot"></span>
                Worker route live
              </div>
              <a class="pill" href="/app/tunnels" style="text-decoration:none;color:inherit">
                Tunnel workspace
              </a>
              <div class="pill" id="last-refresh">Syncing…</div>
            </div>
          </div>

          <section class="hero-row">
            <article class="surface">
              <div class="eyebrow">Phase 13</div>
              <h2>Provider auth is now explicit, testable, and capability-driven.</h2>
              <p>
                This surface now distinguishes route kind, provider preset,
                primary auth path, Access posture, and test strategy. Operators
                should never have to guess whether a provider expects an API key,
                a Workers binding, or no upstream secret at all.
              </p>
              <div class="stat-strip">
                <div class="stat">
                  <div class="label">Providers</div>
                  <strong id="stat-total-providers">00</strong>
                </div>
                <div class="stat">
                  <div class="label">Ready</div>
                  <strong id="stat-ready-providers">00</strong>
                </div>
                <div class="stat">
                  <div class="label">Local routes</div>
                  <strong id="stat-local-providers">00</strong>
                </div>
                <div class="stat">
                  <div class="label">Tests passing</div>
                  <strong id="stat-passing-providers">00/00</strong>
                </div>
              </div>
            </article>

            <article class="surface-dark">
              <div class="eyebrow">Runtime</div>
              <h3>Selected route snapshot</h3>
              <p>
                The active provider record and the future tunnel or connector state
                need to be visible separately, so operators can distinguish stored
                configuration from the route that is actually live.
              </p>
              <div class="stat-strip">
                <div class="stat">
                  <div class="label">Route kind</div>
                  <strong id="runtime-route">No provider</strong>
                </div>
                <div class="stat">
                  <div class="label">Base URL</div>
                  <strong id="runtime-host">Pending</strong>
                </div>
                <div class="stat">
                  <div class="label">Model</div>
                  <strong id="runtime-model">Unset</strong>
                </div>
                <div class="stat">
                  <div class="label">Protection</div>
                  <strong id="runtime-protection">Open</strong>
                </div>
              </div>
            </article>
          </section>

          <section class="content-grid">
            <div class="stack">
              <article class="surface">
                <div class="tabs">
                  <div class="tab active">Providers</div>
                  <div class="tab">Hosted routes</div>
                  <div class="tab">Local routes</div>
                  <div class="tab">Diagnostics</div>
                </div>

                <div id="provider-empty" class="empty-state" hidden>
                  <strong>No providers configured yet.</strong>
                  <div class="muted">
                    Start with a hosted route or a Tunnel-backed local model path.
                    The form on the right will create the first provider record.
                  </div>
                </div>

                <div id="provider-list" class="provider-table"></div>
              </article>

              <article class="surface">
                <div class="eyebrow" style="color: var(--ink-faint)">Diagnostics</div>
                <h3 style="font-size: 28px; margin-bottom: 8px">Connection tests should read like operator evidence.</h3>
                <div id="provider-diagnostics-meta" class="muted" style="margin-bottom: 12px">
                  Awaiting provider selection
                </div>
                <div id="provider-diagnostics" class="diagnostic-list"></div>
              </article>
            </div>

            <article class="surface-dark">
              <div class="wizard-header">
                <div>
                  <div class="eyebrow">Settings</div>
                  <h3 id="provider-mode">Create provider</h3>
                  <p class="panel-note">
                    The provider record is now capability-driven. Pick a preset,
                    confirm the route kind, choose the primary auth strategy,
                    and only then enter the secrets that actually belong to that path.
                  </p>
                </div>
                <div class="status-live">app shell</div>
              </div>

              <div class="step-grid">
                <div class="step-list">
                  <div class="step active">
                    <strong>Choose capability</strong>
                    <span>Select the provider preset and route kind that match reality.</span>
                  </div>
                  <div class="step">
                    <strong>Set auth path</strong>
                    <span>API key, Workers binding, or no upstream secret.</span>
                  </div>
                  <div class="step">
                    <strong>Run test</strong>
                    <span>Verify auth, target URL, and route readiness.</span>
                  </div>
                  <div class="step">
                    <strong>Link tunnel</strong>
                    <span>Attach hostname and Access once the route is stable.</span>
                  </div>
                </div>

                <form id="provider-form" class="form-stack">
                  <input type="hidden" name="providerId" />
                  <div id="provider-notice" class="notice" hidden></div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="providerPreset">Provider preset</label>
                      <select id="providerPreset" name="providerPreset"></select>
                    </div>

                    <div class="field">
                      <label for="kind">Provider kind</label>
                      <select id="kind" name="kind">
                        <option value="hosted-api-key">Hosted API key</option>
                        <option value="local-direct">Local direct</option>
                        <option value="local-gateway">Local gateway</option>
                      </select>
                      <div class="field-hint">Route shape, not credential type.</div>
                    </div>

                    <div class="field">
                      <label for="status">Status</label>
                      <select id="status" name="status">
                        <option value="draft">Draft</option>
                        <option value="ready">Ready</option>
                        <option value="error">Error</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                  </div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="providerCode">Provider code</label>
                      <input id="providerCode" name="providerCode" placeholder="openai, anthropic, ollama, workers-ai" required />
                      <div class="field-hint">Editable for advanced custom routes.</div>
                    </div>

                    <div class="field">
                      <label for="displayName">Display name</label>
                      <input id="displayName" name="displayName" placeholder="Anthropic via AI Gateway" required />
                    </div>
                  </div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="authStrategy">Auth strategy</label>
                      <select id="authStrategy" name="authStrategy"></select>
                    </div>

                    <div class="field">
                      <label for="baseUrl">Base URL</label>
                      <input id="baseUrl" name="baseUrl" placeholder="https://api.openai.com/v1" />
                    </div>

                    <div class="field">
                      <label for="defaultModel">Default model</label>
                      <input id="defaultModel" name="defaultModel" placeholder="gpt-5.4 or gemma3:27b" />
                    </div>
                  </div>

                  <div class="field-wide">
                    <div id="provider-capability" class="capability-panel"></div>
                  </div>

                  <div class="field-wide">
                    <div id="provider-auth-guidance" class="auth-panel"></div>
                  </div>

                  <div class="field-grid">
                    <div class="field">
                      <label for="apiKey">API key / bearer token</label>
                      <input id="apiKey" name="apiKey" type="password" placeholder="Stored only if re-entered" />
                      <div class="field-hint">Only used when the selected auth strategy requires a bearer credential.</div>
                    </div>

                    <div class="field">
                      <label for="accessClientId">Access client ID</label>
                      <input id="accessClientId" name="accessClientId" placeholder="Optional for Tunnel-protected routes" />
                    </div>
                  </div>

                  <div class="field-wide">
                    <label for="accessClientSecret">Access client secret</label>
                    <input id="accessClientSecret" name="accessClientSecret" type="password" placeholder="Optional for Access-protected local routes" />
                    <div class="field-hint">These headers are separate from the provider auth strategy and only exist to traverse Cloudflare Access when required.</div>
                  </div>

                  <div class="field-wide">
                    <label for="metadataJson">Metadata JSON</label>
                    <textarea id="metadataJson" name="metadataJson" placeholder='{"accessProtected": true, "notes": "Primary local route"}'></textarea>
                  </div>

                  <div class="field-wide">
                    <div class="check-row">
                      <label class="checkbox">
                        <input id="usesAiGateway" name="usesAiGateway" type="checkbox" />
                        Route through AI Gateway
                      </label>
                    </div>
                  </div>

                  <div class="modal-footer">
                    <span class="muted">
                      Secrets remain encrypted at rest. Leave secret fields blank
                      when you only want to update metadata or route settings.
                    </span>
                    <div class="button-group">
                      <button id="reset-provider" class="button secondary" type="button">New provider</button>
                      <button id="delete-provider" class="button danger" type="button">Delete</button>
                      <button id="clear-provider-secret" class="button secondary" type="button">Clear stored secrets</button>
                      <button id="test-provider" class="button secondary" type="button">Run test</button>
                      <button class="button primary" type="submit">Save provider</button>
                    </div>
                  </div>
                </form>
              </div>
            </article>
          </section>

          <section class="footer-band">
            <article class="surface">
              <div class="eyebrow" style="color: var(--ink-faint)">Quality of life</div>
              <h3 style="font-size: 24px; margin-bottom: 8px">The next wizard layer already has a home.</h3>
              <div class="mini-log">
                <div class="mini-log-line">
                  <strong>No fake universal OAuth</strong>
                  <span>EdgeIntel now exposes the auth path each provider actually expects instead of implying that every model route supports delegated OAuth.</span>
                </div>
                <div class="mini-log-line">
                  <strong>Secret posture stays visible</strong>
                  <span>Primary provider auth and Access traversal are shown separately so operators can understand which secret solves which problem.</span>
                </div>
                <div class="mini-log-line">
                  <strong>Diagnostics stay visible</strong>
                  <span>Tests now explain transport, target URL, auth strategy, and failure mode instead of dumping generic “connected” language into the app.</span>
                </div>
              </div>
            </article>

            <article class="surface-dark">
              <div class="eyebrow">Selected provider payload</div>
              <h3 style="font-size: 24px; margin-bottom: 12px">Persisted view</h3>
              <pre id="provider-diagnostics-code" class="code-block">{}</pre>
            </article>
          </section>
        </main>
      </div>
    </div>

    <script>
      window.EDGEINTEL_APP = ${bootConfig};
    </script>
    <script type="module">${APP_SCRIPT}</script>
  </body>
</html>`;
}
