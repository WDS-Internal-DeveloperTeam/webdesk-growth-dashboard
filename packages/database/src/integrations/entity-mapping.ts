const DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "lastVerifiedAt",
  "receivedAt",
  "lastRotatedAt",
  "rotationDueAt",
] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`brand-library/entity-mapping.ts`, `scan-center/entity-mapping.ts`, etc.) — no shared
 *  cross-module version exists in this codebase, by established precedent. A superset date-field
 *  list is safe here since a field absent from a given table's own JSON is simply skipped below. */
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
