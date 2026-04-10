import type {
  ControlPlaneHealthSnapshot,
  OperatorSessionView,
} from "@edgeintel/shared-contracts";

const session: OperatorSessionView = {
  authenticated: true,
  authStrategy: "cloudflare-access",
  email: "operator@edgeintel.local",
  identity: "access://operator-demo",
  name: "EdgeIntel Operator",
  groups: ["edgeintel-admin", "tunnel-ops"],
};

const health: ControlPlaneHealthSnapshot = {
  workerPackage: "@edgeintel/worker",
  workspaceMode: "monorepo",
  providerRouteCount: 5,
  tunnelRouteCount: 6,
};

const pillars = [
  {
    title: "Worker Control Plane",
    detail:
      "Keeps orchestration, secrets, tunnel provisioning, and Cloudflare-side diagnostics in one place.",
  },
  {
    title: "React Operator Surface",
    detail:
      "Replaces the Worker-served HTML strings with a maintainable app shell that can grow into the private product workspace.",
  },
  {
    title: "Desktop Connector",
    detail:
      "Owns machine-local responsibilities such as cloudflared install, runtime lifecycle, and local health reporting.",
  },
];

const milestones = [
  "Phase 9: Access-first auth and scoped bootstrap delivery",
  "Phase 10: Zone discovery and hostname validation",
  "Phase 11: tunnel event history, drift, and failure deltas",
  "Phase 12: packaged macOS tray app with guided onboarding",
];

export function App() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <p className="eyebrow">EdgeIntel</p>
            <h1>Control Plane</h1>
          </div>
        </div>
        <div className="sidebar-card">
          <p className="eyebrow">Operator</p>
          <strong>{session.name}</strong>
          <span>{session.email}</span>
          <div className="tags">
            {session.groups.map((group) => (
              <span key={group} className="tag">
                {group}
              </span>
            ))}
          </div>
        </div>
        <div className="sidebar-card">
          <p className="eyebrow">Workspace Mode</p>
          <strong>Monorepo uplift active</strong>
          <span>
            The Worker stays authoritative while the React app and desktop
            connector grow beside it.
          </span>
        </div>
      </aside>

      <section className="main">
        <header className="hero">
          <div>
            <p className="eyebrow">Phase 8</p>
            <h2>Private app shell, shared contracts, and desktop foundations.</h2>
            <p className="lede">
              This package is the future operator workspace for provider
              settings, tunnels, observability, and SE-grade commercial output.
            </p>
          </div>
          <div className="hero-metrics">
            <div className="metric-card">
              <span className="metric-label">Worker package</span>
              <strong>{health.workerPackage}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Provider routes</span>
              <strong>{health.providerRouteCount}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Tunnel routes</span>
              <strong>{health.tunnelRouteCount}</strong>
            </div>
          </div>
        </header>

        <section className="grid">
          <article className="panel panel-dark">
            <p className="eyebrow">Architecture pillar</p>
            <h3>What this app replaces</h3>
            <p>
              The current Worker-served HTML surfaces were correct for proving
              the control plane. This React workspace is the maintainable path
              for the long-term private operator experience.
            </p>
          </article>

          {pillars.map((pillar) => (
            <article key={pillar.title} className="panel">
              <p className="eyebrow">Pillar</p>
              <h3>{pillar.title}</h3>
              <p>{pillar.detail}</p>
            </article>
          ))}

          <article className="panel panel-wide">
            <p className="eyebrow">Near-term roadmap</p>
            <h3>Next implementation slices</h3>
            <ul className="roadmap">
              {milestones.map((milestone) => (
                <li key={milestone}>{milestone}</li>
              ))}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
