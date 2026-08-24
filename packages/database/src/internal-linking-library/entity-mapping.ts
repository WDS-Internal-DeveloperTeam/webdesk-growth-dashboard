const DATE_FIELDS = ["implementedAt", "verifiedAt", "createdAt", "updatedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`keyword-and-entity-library/entity-mapping.ts`, `page-inventory/entity-mapping.ts`,
 *  `persona-library/entity-mapping.ts`, etc.) — no shared cross-module version exists in this
 *  codebase, by established precedent. Extends `DATE_FIELDS` with `implementedAt`/`verifiedAt` —
 *  the two server-stamped, nullable timestamp columns unique to this module — so a `null` column
 *  passes through untouched (`instanceof Date` is `false` for `null`) while a real, populated
 *  value gets the same ISO-string conversion as `createdAt`/`updatedAt`. */
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
