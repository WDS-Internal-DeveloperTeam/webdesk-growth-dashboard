import { Inject, Injectable } from "@nestjs/common";
import type {
  AuditActorType,
  AuditEventEntity,
  AuditEventRepository,
  AuditEventType,
} from "@webdesk/database";
import { AUDIT_EVENT_REPOSITORY } from "./audit.constants.js";

/** The full `event_type` enum per `contracts/audit-event.schema.json` — validated here so a typo'd caller fails fast instead of silently writing an unrecognized value into a 7-year-retained record. */
const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
  "login",
  "login_rejected",
  "logout",
  "session_revoked",
  "permission_change",
  "confidential_field_access_change",
  "user_activation",
  "user_deactivation",
  "data_change",
  "approval",
  "rejection",
  "revision_requested",
  "publish",
  "unpublish",
  "release",
  "rollback",
  "backup",
  "restore",
  "retention_run",
  "security_exception",
  "scan_run",
  "import_run",
  "export_run",
  "git_sync",
  "webhook_processed",
  "job_completed",
  "job_failed",
  "system_health_check_recorded",
  "emergency_admin_login",
  "account_recovery_request",
  "account_recovery_decision",
];

/**
 * The initial controlled `retention_category` set — the schema's own three
 * worked examples (`contracts/audit-event.schema.json`'s `retention_category`
 * description). Not exhaustive: knowledge/11-retention-backup-and-operations.md's
 * full matrix has more categories (e.g. deployment-audit events), added here
 * as later Phase 1E slices actually emit them, not pre-declared speculatively.
 */
const AUDIT_RETENTION_CATEGORIES = ["audit-7y", "approval-audit-7y", "security-log-1y"] as const;

export type AuditRetentionCategory = (typeof AUDIT_RETENTION_CATEGORIES)[number];

export interface RecordAuditEventInput {
  eventType: AuditEventType;
  actorUserId?: string | null;
  actorType: AuditActorType;
  entityType: string;
  entityId: string;
  entityVersion?: number | null;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  relatedGateOrApprovalId?: string | null;
  gitCommitSha?: string | null;
  retentionCategory: AuditRetentionCategory;
  legalHold?: boolean;
  legalHoldReason?: string | null;
}

/**
 * The single shared audit-emission point (docs/task-packages/phase-1e-audit-foundation.md) —
 * every service records a general, ADR-0017-governed audit event by calling `record` here,
 * rather than each caller writing its own ad-hoc `AuditEventRepository` call. Centralizing this
 * is what makes a gap like the one closed in `RecoveryService.decide()` (a denial that was
 * correctly enforced but never recorded anywhere) structurally harder to reintroduce next time —
 * the same rationale `AuthorizationService` already established for permission *checks* in
 * Phase 1D-expanded, applied here to audit *recording*.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_EVENT_REPOSITORY) private readonly events: AuditEventRepository) {}

  async record(input: RecordAuditEventInput): Promise<AuditEventEntity> {
    if (!AUDIT_EVENT_TYPES.includes(input.eventType)) {
      throw new Error(`Unrecognized audit event_type: ${input.eventType}`);
    }
    if (!AUDIT_RETENTION_CATEGORIES.includes(input.retentionCategory)) {
      throw new Error(`Unrecognized audit retention_category: ${input.retentionCategory}`);
    }

    return this.events.record({
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion ?? null,
      action: input.action,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      reason: input.reason ?? null,
      relatedGateOrApprovalId: input.relatedGateOrApprovalId ?? null,
      gitCommitSha: input.gitCommitSha ?? null,
      retentionCategory: input.retentionCategory,
      legalHold: input.legalHold ?? false,
      legalHoldReason: input.legalHoldReason ?? null,
    });
  }
}
