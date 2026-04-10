import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env";
import type { PersistedJobState, ScanWorkflowParams } from "../types";

export class EdgeIntelScanWorkflow extends WorkflowEntrypoint<Env, ScanWorkflowParams> {
  async run(
    event: Readonly<WorkflowEvent<ScanWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<unknown> {
    const coordinator = this.env.JOB_COORDINATOR.getByName(event.payload.jobId);

    await step.do("mark-job-running", async () => {
      await coordinator.markJobStatus("running");
      return { ok: true };
    });

    for (const target of event.payload.targets) {
      await step.do(`enqueue-${target.scanRunId}`, async () => {
        await this.env.SCAN_QUEUE.send({
          jobId: event.payload.jobId,
          scanRunId: target.scanRunId,
          domain: target.domain,
          queuedAt: new Date().toISOString(),
        });
        return { scanRunId: target.scanRunId };
      });
    }

    for (let attempt = 0; attempt < 90; attempt += 1) {
      const snapshot = await step.do<PersistedJobState>(
        `check-progress-${attempt}`,
        async () =>
          JSON.parse(
            JSON.stringify(await coordinator.getSnapshot()),
          ) as PersistedJobState,
      );

      if (
        snapshot.status === "completed" ||
        snapshot.status === "completed_with_failures"
      ) {
        return JSON.parse(JSON.stringify(snapshot));
      }

      await step.sleep(`wait-for-workers-${attempt}`, 2000);
    }

    await step.do("mark-job-failed", async () => {
      await coordinator.markJobStatus("failed");
      return { ok: true };
    });

    throw new Error(
      `Workflow timed out waiting for job ${event.payload.jobId} to finish.`,
    );
  }
}
