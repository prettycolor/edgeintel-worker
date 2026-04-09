import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { PersistedJobState, ScanJobStatus, ScanRunStatus } from "../types";
import { nowIso } from "../lib/utils";

interface JobEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

function defaultState(jobId: string): PersistedJobState {
  return {
    jobId,
    status: "queued",
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    progress: 0,
    domains: [],
    updatedAt: nowIso(),
  };
}

export class JobCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    });
  }

  async initialize(jobId: string, domains: Array<{ scanRunId: string; domain: string }>): Promise<void> {
    const snapshot: PersistedJobState = {
      ...defaultState(jobId),
      totalRuns: domains.length,
      domains: domains.map((target) => ({
        scanRunId: target.scanRunId,
        domain: target.domain,
        status: "queued",
        finalUrl: null,
      })),
      updatedAt: nowIso(),
    };

    await this.saveSnapshot(snapshot);
    await this.appendEvent("job.initialized", {
      jobId,
      domains,
    });
  }

  async markJobStatus(status: ScanJobStatus): Promise<PersistedJobState> {
    const snapshot = await this.getSnapshot();
    snapshot.status = status;
    snapshot.updatedAt = nowIso();
    await this.saveSnapshot(snapshot);
    await this.appendEvent("job.status", { status });
    return snapshot;
  }

  async markRunStatus(update: {
    scanRunId: string;
    domain: string;
    status: ScanRunStatus;
    finalUrl?: string | null;
    error?: string;
  }): Promise<PersistedJobState> {
    const snapshot = await this.getSnapshot();
    const match = snapshot.domains.find((domain) => domain.scanRunId === update.scanRunId);
    if (match) {
      match.status = update.status;
      match.finalUrl = update.finalUrl ?? match.finalUrl;
      match.error = update.error;
    }

    snapshot.completedRuns = snapshot.domains.filter(
      (domain) => domain.status === "completed",
    ).length;
    snapshot.failedRuns = snapshot.domains.filter(
      (domain) => domain.status === "failed",
    ).length;
    snapshot.progress =
      snapshot.totalRuns > 0
        ? Math.round(
            ((snapshot.completedRuns + snapshot.failedRuns) / snapshot.totalRuns) * 100,
          )
        : 0;

    if (snapshot.completedRuns + snapshot.failedRuns === snapshot.totalRuns) {
      snapshot.status =
        snapshot.failedRuns > 0 ? "completed_with_failures" : "completed";
    } else if (
      snapshot.domains.some((domain) => domain.status === "processing")
    ) {
      snapshot.status = "running";
    }

    snapshot.updatedAt = nowIso();
    await this.saveSnapshot(snapshot);
    await this.appendEvent("run.status", {
      ...update,
      progress: snapshot.progress,
    });
    return snapshot;
  }

  async getSnapshot(): Promise<PersistedJobState> {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>(`SELECT value FROM kv WHERE key = 'snapshot'`)
      .one();
    if (!row?.value) {
      return defaultState(this.ctx.id.toString());
    }

    try {
      return JSON.parse(row.value) as PersistedJobState;
    } catch {
      return defaultState(this.ctx.id.toString());
    }
  }

  async getEvents(afterSeq = 0): Promise<JobEvent[]> {
    const rows = this.ctx.storage.sql.exec<{
      seq: number;
      type: string;
      payload: string;
      created_at: string;
    }>(
      `SELECT seq, type, payload, created_at FROM events WHERE seq > ? ORDER BY seq ASC`,
      afterSeq,
    );

    return rows.toArray().map((row) => ({
      seq: row.seq,
      type: row.type,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  private async saveSnapshot(snapshot: PersistedJobState): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO kv (key, value) VALUES ('snapshot', ?)`,
      JSON.stringify(snapshot),
    );
  }

  private async appendEvent(
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO events (type, payload, created_at) VALUES (?, ?, ?)`,
      type,
      JSON.stringify(payload),
      nowIso(),
    );
  }
}
