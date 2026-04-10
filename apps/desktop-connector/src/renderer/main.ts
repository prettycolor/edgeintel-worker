import type { OperatorSessionView } from "@edgeintel/shared-contracts";

declare global {
  interface Window {
    edgeIntelDesktop: {
      platform: string;
      versions: Record<string, string>;
    };
  }
}

const demoSession: OperatorSessionView = {
  authenticated: true,
  authStrategy: "cloudflare-access",
  email: "paired-machine@edgeintel.local",
  identity: "desktop://seed",
  name: "EdgeIntel Connector",
  groups: ["connector-local"],
};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f141b;
      --panel: rgba(255,255,255,0.06);
      --line: rgba(255,255,255,0.08);
      --text: rgba(255,255,255,0.92);
      --text-soft: rgba(255,255,255,0.64);
      --signal: #90f65d;
      --cyan: #7dd6ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top right, rgba(125,214,255,0.18), transparent 26%),
        linear-gradient(180deg, #121821 0%, var(--bg) 100%);
    }
    main {
      min-height: 100vh;
      padding: 24px;
      display: grid;
      gap: 16px;
      grid-template-columns: 1.2fr 0.8fr;
    }
    .panel {
      padding: 22px;
      border-radius: 24px;
      background: var(--panel);
      border: 1px solid var(--line);
      backdrop-filter: blur(18px);
    }
    .hero {
      min-height: 280px;
      background:
        radial-gradient(circle at top right, rgba(144,246,93,0.18), transparent 28%),
        linear-gradient(145deg, #161d26 0%, #10161d 100%);
    }
    .eyebrow {
      margin: 0 0 10px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-soft);
    }
    h1, h2 {
      margin: 0 0 12px;
      font-family: "Space Grotesk", "Avenir Next", sans-serif;
      letter-spacing: -0.04em;
    }
    p {
      margin: 0;
      color: var(--text-soft);
      line-height: 1.65;
    }
    ul {
      margin: 14px 0 0;
      padding-left: 18px;
      color: var(--text-soft);
      line-height: 1.7;
    }
    code {
      color: var(--cyan);
    }
    .meta {
      display: grid;
      gap: 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.08);
      margin-top: 14px;
      font-size: 13px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--signal);
      box-shadow: 0 0 0 8px rgba(144,246,93,0.12);
    }
    @media (max-width: 880px) {
      main { grid-template-columns: 1fr; }
    }
  </style>
  <main>
    <section class="panel hero">
      <p class="eyebrow">Desktop connector scaffold</p>
      <h1>macOS tray app foundation for local-model pairing and tunnel runtime.</h1>
      <p>
        This workspace exists so the Worker stops owning machine-local problems.
        Later phases will add pairing, one-click <code>cloudflared</code> install,
        process supervision, logs, and route health.
      </p>
      <div class="chip">
        <span class="dot"></span>
        ${demoSession.name} on ${window.edgeIntelDesktop.platform}
      </div>
    </section>
    <section class="meta">
      <article class="panel">
        <p class="eyebrow">What comes next</p>
        <h2>Connector responsibilities</h2>
        <ul>
          <li>Pair to EdgeIntel with a short-lived bootstrap exchange.</li>
          <li>Install and supervise <code>cloudflared</code> locally.</li>
          <li>Report version drift, heartbeats, and last-known-good state.</li>
          <li>Expose local diagnostics without requiring CLI use.</li>
        </ul>
      </article>
      <article class="panel">
        <p class="eyebrow">Runtime</p>
        <h2>Platform versions</h2>
        <p>${JSON.stringify(window.edgeIntelDesktop.versions, null, 2)}</p>
      </article>
    </section>
  </main>
`;
