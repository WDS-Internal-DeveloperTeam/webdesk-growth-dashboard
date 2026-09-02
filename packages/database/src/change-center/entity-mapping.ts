// Every DATE-typed column on `change_records` — same per-module local helper pattern every
// `packages/database` module owns independently (no shared cross-module version exists in this
// codebase, by established precedent), mirroring `scan-center/entity-mapping.ts`'s own shape for a
// module with a single entity type.
const DATE_FIELDS = ["decidedAt", "appliedAt", "verifiedAt", "createdAt", "updatedAt"] as const;

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
