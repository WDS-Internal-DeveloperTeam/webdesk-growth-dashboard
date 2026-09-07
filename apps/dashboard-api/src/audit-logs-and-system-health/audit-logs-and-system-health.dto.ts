import type { AuditEventType } from "@webdesk/database";
import { z } from "zod";
import { AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES } from "./audit-logs-and-system-health.constants.js";

const eventTypeEnum = z.enum(
  AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES as [AuditEventType, ...AuditEventType[]],
);

/**
 * `eventType` may be repeated (`?eventType=login&eventType=job_failed`) — Express's `qs` query
 * parser already turns that into a real array before this schema ever runs, so this only needs to
 * normalize the single-value case (`?eventType=login`) into the same array shape. Anything outside
 * the module's own allowlist (`AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES`) — including a value that
 * belongs to Decision and Activity Log's own allowlist instead — is rejected with a clean 400 by
 * `eventTypeEnum` itself, never silently ignored.
 */
export const listAuditLogsAndSystemHealthEventsQuerySchema = z.object({
  eventType: z.preprocess(
    (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
    z.array(eventTypeEnum).min(1).optional(),
  ),
  projectId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  entityType: z.string().min(1).max(64).optional(),
  entityId: z.string().min(1).max(128).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListAuditLogsAndSystemHealthEventsQueryDto = z.infer<
  typeof listAuditLogsAndSystemHealthEventsQuerySchema
>;
