import type { HealthCheckResult } from "@webdesk/shared-types";
import type { JobContext, JobHandler, JobResult } from "../handler-types.js";
import { jobSuccess } from "../handler-types.js";

/**
 * Health/status handler — the one handler expected to exist even before
 * any real job type is implemented. Reports this worker's own liveness
 * only; it does not (and at Phase 1A cannot) check downstream dependencies
 * like a database, since none is connected yet.
 */
export const healthHandler: JobHandler<Record<string, never>, HealthCheckResult> = async (
  _payload,
  context: JobContext,
): Promise<JobResult<HealthCheckResult>> => {
  const result: HealthCheckResult = {
    status: "ok",
    service: "dashboard-worker",
    timestamp: new Date().toISOString(),
  };
  void context;
  return jobSuccess(result);
};
