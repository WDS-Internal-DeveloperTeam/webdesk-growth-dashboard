import type { DesignReviewDecisionEntity, DesignReviewEntity } from "./entities.js";

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`review-and-approval-center/entity-mapping.ts`, `content-template-library/entity-mapping.ts`,
 *  etc.) — no shared cross-module version exists in this codebase, by established precedent.
 *  Parameterized by the caller's own date-field list, since `design_reviews` has
 *  `createdAt`/`updatedAt`/`decidedAt` while `design_review_decisions` has only `decidedAt`. */
function toEntityWithIsoDates<TEntity>(
  instance: { toJSON(): Record<string, unknown> },
  dateFields: readonly string[],
): TEntity {
  const json = instance.toJSON();
  for (const field of dateFields) {
    const value = json[field];
    if (value instanceof Date) {
      json[field] = value.toISOString();
    }
  }
  return json as TEntity;
}

const DESIGN_REVIEW_DATE_FIELDS = ["createdAt", "updatedAt", "decidedAt"] as const;
const DESIGN_REVIEW_DECISION_DATE_FIELDS = ["decidedAt"] as const;

export function toDesignReviewEntity(instance: {
  toJSON(): Record<string, unknown>;
}): DesignReviewEntity {
  return toEntityWithIsoDates<DesignReviewEntity>(instance, DESIGN_REVIEW_DATE_FIELDS);
}

export function toDesignReviewDecisionEntity(instance: {
  toJSON(): Record<string, unknown>;
}): DesignReviewDecisionEntity {
  return toEntityWithIsoDates<DesignReviewDecisionEntity>(
    instance,
    DESIGN_REVIEW_DECISION_DATE_FIELDS,
  );
}
