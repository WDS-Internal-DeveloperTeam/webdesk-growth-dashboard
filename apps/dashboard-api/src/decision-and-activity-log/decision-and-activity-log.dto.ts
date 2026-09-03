import type { AuditEventType } from "@webdesk/database";
import { z } from "zod";
import { DECISION_AND_ACTIVITY_LOG_EVENT_TYPES } from "./decision-and-activity-log.constants.js";

const eventTypeEnum = z.enum(
  DECISION_AND_ACTIVITY_LOG_EVENT_TYPES as [AuditEventType, ...AuditEventType[]],
);

/**
 * `eventType` may be repeated (`?eventType=approval&eventType=rollback`) — Express's `qs` query
 * parser already turns that into a real array before this schema ever runs, so this only needs to
 * normalize the single-value case (`?eventType=approval`) into the same array shape. Anything
 * outside the module's own allowlist (`DECISION_AND_ACTIVITY_LOG_EVENT_TYPES`) is rejected with a
 * clean 400 by `eventTypeEnum` itself, never silently ignored.
 */
export const listDecisionAndActivityLogEventsQuerySchema = z.object({
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
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListDecisionAndActivityLogEventsQueryDto = z.infer<
  typeof listDecisionAndActivityLogEventsQuerySchema
>;
