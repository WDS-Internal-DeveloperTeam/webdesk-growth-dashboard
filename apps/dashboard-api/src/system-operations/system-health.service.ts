import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  SystemComponentEntity,
  SystemComponentRepository,
  SystemHealthCheckRepository,
  SystemHealthStatus,
} from "@webdesk/database";
import {
  SYSTEM_COMPONENT_REPOSITORY,
  SYSTEM_HEALTH_CHECK_REPOSITORY,
} from "./system-operations.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";

export interface RecordCheckInput {
  componentKey: string;
  status: SystemHealthStatus;
  detail?: string | null;
  checkedByUserId?: string | null;
  source?: string;
  correlationId?: string | null;
}

export interface CurrentStatus {
  readonly componentKey: string;
  readonly status: SystemHealthStatus;
  readonly detail: string | null;
  readonly checkedAt: string | null;
  readonly source: string | null;
}

/**
 * The system-health service (brief §25). `getCurrentStatus()` is the
 * literal mechanical enforcement of "do not show 'Healthy' for an
 * integration that has never been tested": a component with zero
 * recorded checks resolves to a synthetic `"unknown"`, never `"healthy"`
 * or any other status implying something was actually observed. No real
 * probe exists for any of the 10 seeded components in this slice — §25's
 * own instruction ("do not connect all systems yet") — `recordCheck()` is
 * a real, tested mechanism that a future probe (or a human, via the HTTP
 * endpoint) calls.
 */
@Injectable()
export class SystemHealthService {
  constructor(
    @Inject(SYSTEM_COMPONENT_REPOSITORY) private readonly components: SystemComponentRepository,
    @Inject(SYSTEM_HEALTH_CHECK_REPOSITORY) private readonly checks: SystemHealthCheckRepository,
    private readonly auditService: AuditService,
  ) {}

  async listComponents(): Promise<readonly SystemComponentEntity[]> {
    return this.components.listAll();
  }

  async recordCheck(input: RecordCheckInput) {
    const component = await this.components.findByKey(input.componentKey);
    if (!component) {
      throw new NotFoundException(`Unknown system component: ${input.componentKey}`);
    }

    const check = await this.checks.record(input);

    if (input.checkedByUserId) {
      await this.auditService.record({
        eventType: "system_health_check_recorded",
        actorUserId: input.checkedByUserId,
        actorType: "human",
        entityType: "system_component",
        entityId: input.componentKey,
        action: "record_check",
        reason: `status:${input.status}`,
        // Without this, the audit event and the system_health_checks row it describes can't be
        // joined back together via correlationId like every other request-scoped pair in this
        // codebase — the check row has it (persisted via `input` above), the audit row didn't.
        correlationId: input.correlationId ?? null,
        retentionCategory: "security-log-1y",
      });
    }

    return check;
  }

  /**
   * Validates `componentKey` against the seeded component list first — without this, an unknown
   * or mistyped key silently resolved to the same `"unknown"` status a real, never-checked
   * component would report, masking a monitoring-dashboard typo as "not yet checked" instead of
   * a real 404. `recordCheck()` above already validates this the same way; this brings the read
   * path to the same standard rather than leaving it asymmetric.
   */
  async getCurrentStatus(componentKey: string): Promise<CurrentStatus> {
    const component = await this.components.findByKey(componentKey);
    if (!component) {
      throw new NotFoundException(`Unknown system component: ${componentKey}`);
    }

    const mostRecent = await this.checks.findMostRecentForComponent(componentKey);
    if (!mostRecent) {
      return { componentKey, status: "unknown", detail: null, checkedAt: null, source: null };
    }
    return {
      componentKey,
      status: mostRecent.status,
      detail: mostRecent.detail,
      checkedAt: mostRecent.createdAt,
      source: mostRecent.source,
    };
  }

  async getAllCurrentStatuses(): Promise<readonly CurrentStatus[]> {
    const components = await this.components.listAll();
    return Promise.all(components.map((component) => this.getCurrentStatus(component.key)));
  }
}
