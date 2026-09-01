const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

/** Same per-module local helper pattern every `packages/database` module owns independently
 *  (`brand-library/entity-mapping.ts`, `persona-library/entity-mapping.ts`,
 *  `service-library/entity-mapping.ts`, etc.) — no shared cross-module version exists in this
 *  codebase, by established precedent. No `publishedAt` field here — this module has no
 *  publish/unpublish mechanism. */
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
