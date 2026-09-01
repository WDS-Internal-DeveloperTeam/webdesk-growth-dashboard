const DATE_FIELDS = ["createdAt", "updatedAt", "publishedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`content-template-library/entity-mapping.ts`, `persona-library/entity-mapping.ts`, etc.) — no
 *  shared cross-module version exists in this codebase, by established precedent. `launchDate` is
 *  deliberately excluded — it's a `DATEONLY` column, mapped to a plain `YYYY-MM-DD` string by
 *  Sequelize already, not a `Date` instance (mirrors `case-study-studio/entity-mapping.ts`'s own
 *  `embargoDate` exclusion). */
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
