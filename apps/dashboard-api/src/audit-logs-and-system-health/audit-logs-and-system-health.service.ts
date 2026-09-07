import { Injectable } from "@nestjs/common";
import type { AuditEventEntity } from "@webdesk/database";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";
import { AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES } from "./audit-logs-and-system-health.constants.js";
import type { ListAuditLogsAndSystemHealthEventsQueryDto } from "./audit-logs-and-system-health.dto.js";

/**
 * The Audit Logs and System Health module's own service (module #43) — a thin, read-only query
 * layer over the existing, already-live ADR-0017 `audit_events` table via `AuditService.list()`,
 * mirroring the Decision and Activity Log module's own identical shape (module #37) file-for-file
 * with only the event-type allowlist swapped for the complementary set.
 * `docs/implementation/module-audit-logs-and-system-health.md` records the full account.
 *
 * `beforeState`/`afterState` are returned unredacted — the same deliberate, documented decision
 * Decision and Activity Log's own service already makes, for the same reasons: this module's own
 * module-registry `confidentialityLevel` names no redaction axis of its own, access is already the
 * narrowest RBAC gate in the whole seeded matrix (`system_settings:view` held by ONLY
 * `super_admin`/`owner_growth_approver`), and this exact "the audit trail carries raw
 * pre-redaction content" shape is already accepted, tracked debt on the WRITE side across
 * multiple already-shipped modules. This read surface doesn't introduce a new exposure; it makes
 * visible, to the same two roles, data that was already being written.
 */
@Injectable()
export class AuditLogsAndSystemHealthService {
  constructor(private readonly audit: AuditService) {}

  async list(
    query: ListAuditLogsAndSystemHealthEventsQueryDto,
  ): Promise<readonly AuditEventEntity[]> {
    return this.audit.list({
      eventTypes: query.eventType ?? AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES,
      projectId: query.projectId,
      actorUserId: query.actorUserId,
      entityType: query.entityType,
      entityId: query.entityId,
      createdAfter: query.from,
      createdBefore: query.to,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
