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
      "Keeps scans, secrets, tunnel provisioning, observability, and commercial outputs in one Cloudflare-native control plane.",
  },
  {
    title: "React Operator Surface",
    detail:
      "Provides the long-term private operator workspace for providers, tunnels, diagnostics, and customer-facing commercial narratives.",
  },
  {
    title: "Desktop Connector",
    detail:
      "Owns machine-local responsibilities such as cloudflared install, runtime lifecycle, and local health reporting.",
  },
];

const milestones = [
  "Phase 13: provider capability catalog and auth-strategy-aware credential UX",
  "Phase 14: hosting intelligence uplift and commercial brief output",
  "Phase 15: demo script, architecture story, and interview packaging",
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
          <strong>Implementation roadmap complete</strong>
          <span>
            The Worker remains authoritative while the React app and desktop
            connector package the system into an operator-grade product.
          </span>
        </div>
      </aside>

      <section className="main">
        <header className="hero">
          <div>
            <p className="eyebrow">Phase 15</p>
            <h2>Commercial output, control plane, and demo-ready architecture.</h2>
            <p className="lede">
              This package is the private operator workspace for provider
              settings, tunnels, observability, and SE-grade Cloudflare motions.
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
            <h3>What this app now carries</h3>
            <p>
              The Worker-served HTML surfaces proved the control plane. This
              React workspace is the long-term surface for provider onboarding,
              tunnel observability, and commercial Cloudflare fit reporting.
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
