/**
 * Shared Zod validation foundations. Phase 1A ships only cross-cutting
 * schemas (pagination, health checks) — module-specific schemas (Project,
 * CaseStudy, etc.) land with their owning module's own authorization.
 */
import { z } from "zod";

export {
  sanitizeRichTextHtml,
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
} from "./sanitize-html.js";
export { isSequelizeUniqueConstraintError } from "./sequelize-errors.js";

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

/**
 * `z.string().url()` alone accepts any scheme, including `javascript:` — a stored-XSS vector once
 * a value validated this way is later rendered as a clickable link (the exact issue
 * `dashboard-web`'s Project Detail page review found and fixed client-side via its own
 * `isSafeHttpUrl()`, flagging the schema that originally accepted the value as the real place to
 * close it). Shared here — not re-declared per module — so every future module that accepts a
 * user-supplied URL gets a safe value by construction (code-review finding,
 * `module-projects-backend-closeout` branch: an earlier version of this schema was defined locally
 * in `apps/dashboard-api/src/projects/projects.dto.ts` only).
 */
export const safeHttpUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "must be an http:// or https:// URL" },
  );
