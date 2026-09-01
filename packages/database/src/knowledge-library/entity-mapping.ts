const DATE_FIELDS = ["createdAt", "updatedAt", "lastReviewedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`packages/database/src/business-knowledge/entity-mapping.ts`, `projects/entity-mapping.ts`,
 *  etc.) — no shared cross-module version exists in this codebase, by established precedent.
 *  `sourceDate` is a `DATEONLY` column — Sequelize already returns it as a plain `YYYY-MM-DD`
 *  string, not a `Date`, so it needs no conversion here. */
export function toEntityWithIsoDates<TEntity>(instance: {
  toJSON(): Record<string, unknown>;
}): TEntity {
  const json = instance.toJSON();
  for (const field of DATE_FIELDS) {
    const value = json[field];
    if (value instanceof Date) {
      json[field] = value.toISOString();
    }
  }
  return json as TEntity;
}
