import { Inject, Injectable } from "@nestjs/common";
import type {
  RetentionHoldEntity,
  RetentionHoldRepository,
  RetentionPolicyEntity,
  RetentionPolicyRepository,
} from "@webdesk/database";
import { RETENTION_HOLD_REPOSITORY, RETENTION_POLICY_REPOSITORY } from "./retention.constants.js";

export type EligibilityReasonCode =
  "policy_not_found" | "not_yet_eligible" | "active_hold" | "active_dependency" | "eligible";

export interface EligibilityInput {
  readonly categoryKey: string;
  readonly resourceType: string;
  readonly resourceId: string;
  /** The date the policy's retention clock starts from for this specific record (its `anchor` field, e.g. `finished_at` for a job). */
  readonly anchorDate: Date;
  /** Caller-supplied — a generic dependency check has no meaning without knowing what depends on what; see docs/task-packages/phase-1e-retention-architecture.md §4. */
  readonly hasActiveDependency?: boolean;
}

export interface EligibilityDecision {
  readonly eligible: boolean;
  readonly reasonCode: EligibilityReasonCode;
  readonly policy: RetentionPolicyEntity | null;
  readonly activeHold: RetentionHoldEntity | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

function policyThresholdMs(policy: RetentionPolicyEntity): number {
  const days =
    policy.retentionUnit === "years"
      ? policy.retentionValue * DAYS_PER_YEAR
      : policy.retentionValue;
  return days * MS_PER_DAY;
}

/**
 * The eligibility half of §22's 9-step cleanup process (steps 1-5):
 * determine policy → determine record age → check hold → check active
 * dependency → determine eligible/not eligible. `RetentionCleanupService`
 * (steps 6-9: dry-run counts, execution mode, deletion result, audit
 * event) calls this for every candidate rather than duplicating the
 * decision logic.
 */
@Injectable()
export class RetentionEligibilityService {
  constructor(
    @Inject(RETENTION_POLICY_REPOSITORY) private readonly policies: RetentionPolicyRepository,
    @Inject(RETENTION_HOLD_REPOSITORY) private readonly holds: RetentionHoldRepository,
  ) {}

  async evaluate(input: EligibilityInput): Promise<EligibilityDecision> {
    const policy = await this.policies.findByCategoryKey(input.categoryKey);
    if (!policy) {
      return { eligible: false, reasonCode: "policy_not_found", policy: null, activeHold: null };
    }

    const ageMs = Date.now() - input.anchorDate.getTime();
    if (ageMs < policyThresholdMs(policy)) {
      return { eligible: false, reasonCode: "not_yet_eligible", policy, activeHold: null };
    }

    const [entityHolds, categoryHolds] = await Promise.all([
      this.holds.findActiveForResource(input.resourceType, input.resourceId),
      this.holds.findActiveForCategory(input.categoryKey),
    ]);
    const activeHold = entityHolds[0] ?? categoryHolds[0] ?? null;
    if (activeHold) {
      return { eligible: false, reasonCode: "active_hold", policy, activeHold };
    }

    if (input.hasActiveDependency) {
      return { eligible: false, reasonCode: "active_dependency", policy, activeHold: null };
    }

    return { eligible: true, reasonCode: "eligible", policy, activeHold: null };
  }
}
