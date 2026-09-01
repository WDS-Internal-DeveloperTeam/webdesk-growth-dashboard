const DATE_FIELDS = ["createdAt", "updatedAt"] as const;
const EXTRA_DATE_FIELDS = ["decidedAt", "grantedAt", "scheduledPublishAt", "publishedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`persona-library/entity-mapping.ts`, `proof-and-claims-library/entity-mapping.ts`, etc.) — no
 *  shared cross-module version exists in this codebase, by established precedent. `embargoDate`
 *  is deliberately excluded — it's a `DATEONLY` column, mapped to a plain `YYYY-MM-DD` string by
 *  Sequelize already, not a `Date` instance. */
export function toEntityWithIsoDates<TEntity>(instance: {
  toJSON(): Record<string, unknown>;
}): TEntity {
  const json = instance.toJSON();
  for (const field of [...DATE_FIELDS, ...EXTRA_DATE_FIELDS]) {
    const value = json[field];
    if (value instanceof Date) {
      json[field] = value.toISOString();
    }
  }
  return json as TEntity;
}
