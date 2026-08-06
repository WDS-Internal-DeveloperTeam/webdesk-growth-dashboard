/**
 * EXAMPLE / NON-PRODUCTION handler. Demonstrates the handler pattern
 * (payload validation, retry vs. permanent failure, idempotent success) —
 * it is not wired to any real trigger and must not be deployed or invoked
 * outside tests. Remove or replace once the first real job type (Phase
 * 1B+, e.g. a Scan Center run) is implemented.
 */
import { z } from "zod";
import type { JobHandler, JobResult } from "../handler-types.js";
import { jobFailure, jobRetry, jobSuccess } from "../handler-types.js";

const examplePayloadSchema = z.object({
  message: z.string().min(1),
  simulate: z.enum(["success", "retry", "permanent-failure"]).default("success"),
});
export type ExampleEchoPayload = z.infer<typeof examplePayloadSchema>;

export interface ExampleEchoOutput {
  readonly echoed: string;
}

export const exampleEchoHandler: JobHandler<ExampleEchoPayload, ExampleEchoOutput> = async (
  payload,
  context,
): Promise<JobResult<ExampleEchoOutput>> => {
  const parsed = examplePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return jobFailure(`Invalid payload: ${parsed.error.message}`, true);
  }

  switch (parsed.data.simulate) {
    case "retry":
      return jobRetry(`Simulated transient failure on attempt ${context.attempt}`, 30);
    case "permanent-failure":
      return jobFailure("Simulated permanent failure", true);
    case "success":
    default:
      return jobSuccess({ echoed: parsed.data.message });
  }
};
