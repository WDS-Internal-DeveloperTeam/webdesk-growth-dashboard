import { z } from "zod";

export const createJobSchema = z.object({
  jobType: z.string().min(1).max(64),
  projectId: z.string().uuid().nullish(),
  resourceType: z.string().min(1).max(64).nullish(),
  resourceId: z.string().min(1).max(128).nullish(),
  idempotencyKey: z.string().min(1).max(255).nullish(),
  maxAttempts: z.number().int().min(1).max(50).optional(),
  timeoutSeconds: z.number().int().min(1).nullish(),
});
export type CreateJobDto = z.infer<typeof createJobSchema>;

export const listJobsQuerySchema = z.object({
  status: z
    .enum([
      "pending",
      "queued",
      "running",
      "retrying",
      "succeeded",
      "failed",
      "cancelled",
      "expired",
    ])
    .optional(),
  projectId: z.string().uuid().optional(),
  jobType: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListJobsQueryDto = z.infer<typeof listJobsQuerySchema>;
