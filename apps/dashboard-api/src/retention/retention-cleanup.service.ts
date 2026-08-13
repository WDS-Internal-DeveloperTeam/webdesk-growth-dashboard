import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";
import type { EligibilityDecision, EligibilityInput } from "./retention-eligibility.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as AuditService above.
import { RetentionEligibilityService } from "./retention-eligibility.service.js";

export type CleanupMode = "dry_run" | "execute";

/**
 * Pluggable per-record deletion — never DI-wired to any real table in this
 * slice. §22: "Phase 1E should not execute destructive production
 * cleanup. Use safe test fixtures." The only implementation that exists
 * anywhere in this codebase lives in the real-database integration test,
 * targeting `_framework_probe` (the same test-only table Phase 1B's own
 * database foundation established for exactly this "prove the mechanism,
 * touch nothing real" purpose) — never registered as a provider in
 * `RetentionModule`, so no HTTP route can reach it.
 */
export interface RetentionRecordDeleter {
  softDelete(candidate: EligibilityInput): Promise<void>;
}

export interface CleanupCandidateResult {
  readonly candidate: EligibilityInput;
  readonly decision: EligibilityDecision;
  readonly deleted: boolean;
}

export interface CleanupRunResult {
  readonly mode: CleanupMode;
  readonly evaluated: number;
  readonly eligible: number;
  readonly ineligible: number;
  readonly deleted: number;
  readonly results: readonly CleanupCandidateResult[];
}

/**
 * §22's steps 6-9 (dry-run counts, execution mode, deletion result, audit
 * event) — steps 1-5 (policy → age → hold → dependency → eligibility) are
 * `RetentionEligibilityService`'s job, called once per candidate here so
 * the decision logic isn't duplicated.
 */
@Injectable()
export class RetentionCleanupService {
  constructor(
    private readonly eligibility: RetentionEligibilityService,
    private readonly auditService: AuditService,
  ) {}

  async run(
    candidates: readonly EligibilityInput[],
    mode: CleanupMode,
    executedByUserId: string,
    deleter?: RetentionRecordDeleter,
  ): Promise<CleanupRunResult> {
    if (mode === "execute" && !deleter) {
      throw new BadRequestException("execute mode requires a RetentionRecordDeleter");
    }

    const results: CleanupCandidateResult[] = [];
    // The audit record is emitted from `finally`, not after the loop: if `deleter.softDelete`
    // throws partway through, every candidate already pushed to `results` (i.e. already deleted)
    // must still be audited — an aggregate event recorded only on the happy path would leave a
    // real deletion with no audit trail at all whenever a later candidate in the same run fails.
    try {
      for (const candidate of candidates) {
        const decision = await this.eligibility.evaluate(candidate);
        let deleted = false;
        if (mode === "execute" && decision.eligible) {
          await deleter!.softDelete(candidate);
          deleted = true;
        }
        results.push({ candidate, decision, deleted });
      }
    } finally {
      const eligible = results.filter((result) => result.decision.eligible).length;
      const deletedCount = results.filter((result) => result.deleted).length;

      await this.auditService.record({
        eventType: "retention_run",
        actorUserId: executedByUserId,
        actorType: "human",
        entityType: "retention_run",
        entityId: randomUUID(),
        action: mode,
        afterState: {
          mode,
          evaluated: results.length,
          eligible,
          ineligible: results.length - eligible,
          deleted: deletedCount,
          // Names exactly which records this run deleted — the aggregate counts alone can't
          // answer "which rows" if this audit trail is ever consulted after the fact.
          deletedRecords: results
            .filter((result) => result.deleted)
            .map((result) => ({
              categoryKey: result.candidate.categoryKey,
              resourceType: result.candidate.resourceType,
              resourceId: result.candidate.resourceId,
            })),
        },
        retentionCategory: "audit-7y",
      });
    }

    const eligible = results.filter((result) => result.decision.eligible).length;
    const deletedCount = results.filter((result) => result.deleted).length;

    return {
      mode,
      evaluated: results.length,
      eligible,
      ineligible: results.length - eligible,
      deleted: deletedCount,
      results,
    };
  }
}
