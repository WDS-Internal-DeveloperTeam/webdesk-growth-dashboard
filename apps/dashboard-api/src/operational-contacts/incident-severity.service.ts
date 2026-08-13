import { Inject, Injectable } from "@nestjs/common";
import type {
  IncidentSeverity,
  IncidentSeverityPolicyEntity,
  IncidentSeverityPolicyRepository,
} from "@webdesk/database";
import { INCIDENT_SEVERITY_POLICY_REPOSITORY } from "./operational-contacts.constants.js";

export type ResponseTargetReasonCode =
  "policy_not_found" | "not_a_fixed_duration_target" | "evaluated";

export interface ResponseTargetEvaluation {
  readonly applicable: boolean;
  readonly met: boolean | null;
  readonly reasonCode: ResponseTargetReasonCode;
  readonly policy: IncidentSeverityPolicyEntity | null;
  readonly elapsedMs: number | null;
  readonly thresholdMs: number | null;
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Counts whole calendar days between two instants that are not Saturday/Sunday — a
 * straightforward, bounded implementation; does not account for holidays.
 *
 * Iterates exactly `Math.floor((to - from) / 1 day)` times — a WHOLE-days count, not "does
 * `cursor` still fall before `to`". The latter rounds any partial day UP to a full day: e.g.
 * `from` and `to` eight hours apart on the same weekday would satisfy `cursor < to` on the first
 * iteration and get counted as 1 full business day elapsed, when in reality zero full days have
 * passed. Flooring first fixes that without changing any of the whole-day cases.
 */
function businessDaysBetween(from: Date, to: Date): number {
  const wholeDaysElapsed = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
  let count = 0;
  const cursor = new Date(from);
  for (let i = 0; i < wholeDaysElapsed; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
  }
  return count;
}

/**
 * The incident-severity response-target service (brief §18). Never
 * fabricates SLA compliance: `evaluateResponseTarget` requires the caller
 * to supply real timestamps (no incident-tracking system exists yet to
 * read them from — §18's own exclusion), and returns `applicable: false`
 * for `low`, whose approved target ("scheduled maintenance") isn't a
 * duration at all rather than inventing one.
 */
@Injectable()
export class IncidentSeverityService {
  constructor(
    @Inject(INCIDENT_SEVERITY_POLICY_REPOSITORY)
    private readonly policies: IncidentSeverityPolicyRepository,
  ) {}

  async listPolicies(): Promise<readonly IncidentSeverityPolicyEntity[]> {
    return this.policies.listAll();
  }

  async evaluateResponseTarget(
    severity: IncidentSeverity,
    incidentOpenedAt: Date,
    now: Date = new Date(),
  ): Promise<ResponseTargetEvaluation> {
    const policy = await this.policies.findBySeverity(severity);
    if (!policy) {
      return {
        applicable: false,
        met: null,
        reasonCode: "policy_not_found",
        policy: null,
        elapsedMs: null,
        thresholdMs: null,
      };
    }
    if (
      !policy.isFixedDuration ||
      policy.responseTargetValue === null ||
      !policy.responseTargetUnit
    ) {
      return {
        applicable: false,
        met: null,
        reasonCode: "not_a_fixed_duration_target",
        policy,
        elapsedMs: null,
        thresholdMs: null,
      };
    }

    const elapsedMs = now.getTime() - incidentOpenedAt.getTime();
    let thresholdMs: number;
    if (policy.responseTargetUnit === "minutes") {
      thresholdMs = policy.responseTargetValue * MS_PER_MINUTE;
    } else if (policy.responseTargetUnit === "hours") {
      thresholdMs = policy.responseTargetValue * MS_PER_HOUR;
    } else {
      // business_days — compare business-day count directly rather than a fixed millisecond
      // threshold, since "1 business day" has no constant duration.
      const businessDaysElapsed = businessDaysBetween(incidentOpenedAt, now);
      return {
        applicable: true,
        met: businessDaysElapsed <= policy.responseTargetValue,
        reasonCode: "evaluated",
        policy,
        elapsedMs,
        thresholdMs: null,
      };
    }

    return {
      applicable: true,
      met: elapsedMs <= thresholdMs,
      reasonCode: "evaluated",
      policy,
      elapsedMs,
      thresholdMs,
    };
  }
}
