const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`business-knowledge/entity-mapping.ts`, `projects/entity-mapping.ts`, etc.) — no shared
 *  cross-module version exists in this codebase, by established precedent. Join-table rows have
 *  no `updatedAt` column; the `instanceof Date` check simply skips it when absent. */
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
