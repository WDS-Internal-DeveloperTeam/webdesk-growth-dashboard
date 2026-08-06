/**
 * Shared Zod validation foundations. Phase 1A ships only cross-cutting
 * schemas (pagination, health checks) — module-specific schemas (Project,
 * CaseStudy, etc.) land with their owning module's own authorization.
 */
import { z } from "zod";

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationParamsInput = z.infer<typeof paginationParamsSchema>;

export const healthStatusSchema = z.enum(["ok", "degraded", "down"]);

export const healthCheckResultSchema = z.object({
  status: healthStatusSchema,
  service: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z.record(z.string(), healthStatusSchema).optional(),
});
export type HealthCheckResultInput = z.infer<typeof healthCheckResultSchema>;

export const correlationIdSchema = z.string().uuid();
