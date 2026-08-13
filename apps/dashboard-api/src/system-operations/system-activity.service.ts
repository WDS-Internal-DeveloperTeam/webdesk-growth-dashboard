import { Inject, Injectable } from "@nestjs/common";
import type {
  SystemEventEntity,
  SystemEventRepository,
  SystemEventSeverity,
} from "@webdesk/database";
import { SYSTEM_EVENT_REPOSITORY } from "./system-operations.constants.js";

export interface RecordActivityInput {
  eventType: string;
  category?: string | null;
  severity?: SystemEventSeverity | null;
  sourceApplication?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  correlationId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  /** Set only when a caller has ALSO separately written a real `audit_events` row for the same occurrence — never inferred or created automatically. See docs/task-packages/phase-1e-system-events-health.md §4. */
  relatedAuditEventId?: string | null;
}

/**
 * The user-facing activity-feed service (brief §24) — deliberately NOT
 * the compliance audit trail. Most activity is routine, potentially
 * high-volume operational telemetry (job status changes, notifications
 * queued, scans completed) — recording it here never implies or creates
 * an `audit_events` row, matching the "don't audit routine telemetry"
 * pattern every prior Phase 1E slice has followed for its own automatic
 * state transitions. A caller that genuinely needs both makes both calls
 * explicitly and links them via `relatedAuditEventId`.
 */
@Injectable()
export class SystemActivityService {
  constructor(@Inject(SYSTEM_EVENT_REPOSITORY) private readonly events: SystemEventRepository) {}

  async record(input: RecordActivityInput): Promise<SystemEventEntity> {
    return this.events.record(input);
  }

  async findById(id: string): Promise<SystemEventEntity | null> {
    return this.events.findById(id);
  }

  async list(filter: {
    eventType?: string;
    category?: string;
    severity?: SystemEventSeverity;
    relatedEntityType?: string;
    relatedEntityId?: string;
    correlationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly SystemEventEntity[]> {
    return this.events.list(filter);
  }
}
