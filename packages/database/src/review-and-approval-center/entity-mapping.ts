import type { ReviewCommentEntity, ReviewDecisionEntity, ReviewEntity } from "./entities.js";

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`content-template-library/entity-mapping.ts`, `persona-library/entity-mapping.ts`, etc.) — no
 *  shared cross-module version exists in this codebase, by established precedent. Parameterized by
 *  the caller's own date-field list, since each of this module's three entities has a different
 *  shape (`reviews` has `createdAt`/`updatedAt`/`decidedAt`; `review_comments` has only
 *  `createdAt`; `review_decisions` has only `decidedAt`). */
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

const REVIEW_DATE_FIELDS = ["createdAt", "updatedAt", "decidedAt"] as const;
const REVIEW_COMMENT_DATE_FIELDS = ["createdAt"] as const;
const REVIEW_DECISION_DATE_FIELDS = ["decidedAt"] as const;

export function toReviewEntity(instance: { toJSON(): Record<string, unknown> }): ReviewEntity {
  return toEntityWithIsoDates<ReviewEntity>(instance, REVIEW_DATE_FIELDS);
}

export function toReviewCommentEntity(instance: {
  toJSON(): Record<string, unknown>;
}): ReviewCommentEntity {
  return toEntityWithIsoDates<ReviewCommentEntity>(instance, REVIEW_COMMENT_DATE_FIELDS);
}

export function toReviewDecisionEntity(instance: {
  toJSON(): Record<string, unknown>;
}): ReviewDecisionEntity {
  return toEntityWithIsoDates<ReviewDecisionEntity>(instance, REVIEW_DECISION_DATE_FIELDS);
}
