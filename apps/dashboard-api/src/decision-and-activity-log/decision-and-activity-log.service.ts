import { Injectable } from "@nestjs/common";
import type { AuditEventEntity } from "@webdesk/database";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";
import { DECISION_AND_ACTIVITY_LOG_EVENT_TYPES } from "./decision-and-activity-log.constants.js";
import type { ListDecisionAndActivityLogEventsQueryDto } from "./decision-and-activity-log.dto.js";

/**
 * The Decision and Activity Log module's own service — a thin,
 * read-only query layer over the existing, already-live ADR-0017
 * `audit_events` table via `AuditService.list()`. Closes the "query HTTP
 * surface" gap `docs/task-packages/phase-1e-audit-foundation.md` itself
 * deferred. `docs/implementation/module-decision-and-activity-log.md`
 * records the full account.
 *
 * `beforeState`/`afterState` are returned unredacted — a deliberate,
 * documented decision, not an oversight. This module's own module-registry
 * `confidentialityLevel` is `null` (migration `00015`'s own seed
 * comment names it as `system_settings`-gated only, no confidentiality
 * axis of its own); access is already the narrowest RBAC gate in the
 * whole seeded matrix (`system_settings:view` is held by ONLY
 * `super_admin`/`owner_growth_approver` — migration `00013`'s own
 * `system_settings: { super_admin: "VCERM", owner_growth_approver: "VM" }`
 * row, the two most trusted roles); and this exact "the audit trail
 * carries raw pre-redaction content" shape is already accepted, tracked
 * debt on the WRITE side across multiple already-shipped modules
 * (Business Knowledge Center's/Service Library's/Persona Library's own
 * `update()` `afterState` calls all log the unredacted patch verbatim —
 * see e.g. `docs/project-state/module-business-knowledge-center-approval-checklist.md`).
 * This read surface doesn't introduce a new exposure; it makes visible,
 * to the same two roles, data that was already being written. Building
 * genuine per-event confidential-field redaction here would also need a
 * generic mechanism keyed to "which module/entity type produced this
 * row, and what are ITS confidential fields" — no such mechanism exists
 * anywhere in this codebase (every existing redaction call, e.g.
 * `confidential-field.util.ts`, is scoped to one module's own known
 * field names) — a disproportionate, novel build for a light,
 * backend-only query-surface module.
 */
@Injectable()
export class DecisionAndActivityLogService {
  constructor(private readonly audit: AuditService) {}

  async list(
    query: ListDecisionAndActivityLogEventsQueryDto,
  ): Promise<readonly AuditEventEntity[]> {
    return this.audit.list({
      eventTypes: query.eventType ?? DECISION_AND_ACTIVITY_LOG_EVENT_TYPES,
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
