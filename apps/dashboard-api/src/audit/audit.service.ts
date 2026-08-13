import { Inject, Injectable } from "@nestjs/common";
import { AUDIT_RETENTION_CATEGORIES } from "@webdesk/database";
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
  "job_created",
  "job_completed",
  "job_failed",
  "job_retry_requested",
  "job_cancellation_requested",
  "retention_hold_created",
  "retention_hold_released",
  "emergency_admin_login",
  "account_recovery_request",
  "account_recovery_decision",
];

/**
 * `AUDIT_RETENTION_CATEGORIES` itself now lives in `@webdesk/database` (`packages/database/src/audit/entities.ts`)
 * — a single source of truth `AuditEventRepository.record()` validates against too, instead of
 * this file maintaining its own separate copy that could drift out of sync. Not exhaustive:
 * knowledge/11-retention-backup-and-operations.md's full matrix has more categories (e.g.
 * deployment-audit events), added there as later Phase 1E slices actually emit them, not
 * pre-declared speculatively.
 */
export type AuditRetentionCategory = (typeof AUDIT_RETENTION_CATEGORIES)[number];

/**
 * Exhaustive `event_type` → `event_category` mapping (migration 00019) —
 * `Record<AuditEventType, string>` forces a compile error if a new
 * `event_type` is ever added to `AUDIT_EVENT_TYPES` without a category
 * decision, so this can never silently fall out of sync. Every caller gets
 * a meaningful category without having to know or pass one — the same
 * "derive it centrally, don't trust each call site" reasoning
 * `AuthorizationService` already applies to permission checks.
 */
const AUDIT_EVENT_CATEGORIES: Record<AuditEventType, string> = {
  login: "authentication",
  login_rejected: "authentication",
  logout: "authentication",
  session_revoked: "authentication",
  permission_change: "access_control",
  confidential_field_access_change: "access_control",
  user_activation: "access_control",
  user_deactivation: "access_control",
  data_change: "content_lifecycle",
  approval: "approval",
  rejection: "approval",
  revision_requested: "approval",
  publish: "content_lifecycle",
  unpublish: "content_lifecycle",
  release: "content_lifecycle",
  rollback: "content_lifecycle",
  backup: "operational",
  restore: "operational",
  retention_run: "operational",
  security_exception: "security",
  scan_run: "operational",
  import_run: "operational",
  export_run: "operational",
  git_sync: "operational",
  webhook_processed: "operational",
  job_created: "operational",
  job_completed: "operational",
  job_failed: "operational",
  job_retry_requested: "operational",
  job_cancellation_requested: "operational",
  retention_hold_created: "operational",
  retention_hold_released: "operational",
  emergency_admin_login: "authentication",
  account_recovery_request: "identity_recovery",
  account_recovery_decision: "identity_recovery",
};

/** Default `confidentiality_classification` when a caller doesn't specify one — the conservative, non-elevated value; grants no special visibility beyond standard `audit.view`. */
const DEFAULT_CONFIDENTIALITY_CLASSIFICATION = "internal";

/** The only application that has ever emitted audit events — `AuditModule` is wired into `dashboard-api`'s `AuthModule`/`AuthzModule` only, never `dashboard-worker` or `dashboard-web` (which never touches PostgreSQL, per knowledge/01). */
const DEFAULT_SOURCE_APPLICATION = "dashboard-api";

/**
 * Same three-value vocabulary as `packages/configuration`'s already-approved
 * `NODE_ENV` schema — not an invented environment name. Read directly from
 * `process.env` rather than injecting the full `AuthEnv`/`loadEnv` machinery,
 * since this is the only field `AuditService` needs from it.
 */
function resolveEnvironment(): string {
  const nodeEnv = process.env["NODE_ENV"];
  return nodeEnv === "production" || nodeEnv === "test" ? nodeEnv : "development";
}

export interface RecordAuditEventInput {
  eventType: AuditEventType;
  actorUserId?: string | null;
  actorType: AuditActorType;
  sessionId?: string | null;
  projectId?: string | null;
  entityType: string;
  entityId: string;
  entityVersion?: number | null;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  relatedGateOrApprovalId?: string | null;
  gitCommitSha?: string | null;
  correlationId?: string | null;
  confidentialityClassification?: string;
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
      eventCategory: AUDIT_EVENT_CATEGORIES[input.eventType],
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      sessionId: input.sessionId ?? null,
      projectId: input.projectId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion ?? null,
      action: input.action,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      reason: input.reason ?? null,
      relatedGateOrApprovalId: input.relatedGateOrApprovalId ?? null,
      gitCommitSha: input.gitCommitSha ?? null,
      correlationId: input.correlationId ?? null,
      sourceApplication: DEFAULT_SOURCE_APPLICATION,
      environment: resolveEnvironment(),
      confidentialityClassification:
        input.confidentialityClassification ?? DEFAULT_CONFIDENTIALITY_CLASSIFICATION,
      retentionCategory: input.retentionCategory,
      legalHold: input.legalHold ?? false,
      legalHoldReason: input.legalHoldReason ?? null,
    });
  }
}
