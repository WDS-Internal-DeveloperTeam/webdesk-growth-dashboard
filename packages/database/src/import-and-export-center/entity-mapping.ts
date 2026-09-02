// Union of every DATE-typed column across all five Import and Export Center tables — a row from
// any one table only ever carries a subset of these keys, and the loop below is a no-op for a key
// that's absent (`json[field]` is `undefined`, not a `Date`), so one shared helper (mirroring
// `scan-center/entity-mapping.ts`'s own multi-entity-type version) covers all five repositories
// instead of five near-identical files.
const DATE_FIELDS = ["startedAt", "completedAt", "createdAt", "updatedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently — no
 *  shared cross-module version exists in this codebase, by established precedent. */
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
